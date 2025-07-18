import { google } from "googleapis";
import { NextResponse } from "next/server";

async function getImagesInFolder(drive: any, folderId: string): Promise<any[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/'`,
    fields: "files(id,name,mimeType)",
  });

  return response.data.files || [];
}

async function getSubfoldersAndImages(
  drive: any,
  folderId: string
): Promise<any> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id,name,mimeType)",
  });

  const subfolders = response.data.files || [];
  const subfolderList = [];

  for (const subfolder of subfolders) {
    const images = await getImagesInFolder(drive, subfolder.id);
    subfolderList.push({
      title: subfolder.name,
      images: images.map((image) => ({
        id: image.id,
        name: image.name,
        mimeType: image.mimeType,
      })),
    });
  }

  return subfolderList;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderUrl = searchParams.get("folderUrl");
  const accessToken = searchParams.get("accessToken");

  if (!folderUrl) {
    return NextResponse.json(
      { error: "No folder URL provided" },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Access token required for Google Drive access" },
      { status: 400 }
    );
  }

  const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!folderIdMatch || !folderIdMatch[1]) {
    return NextResponse.json({ error: "Invalid folder URL" }, { status: 400 });
  }
  const folderId = folderIdMatch[1];

  try {
    // Create OAuth2 client with access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const subfolderList = await getSubfoldersAndImages(drive, folderId);

    if (subfolderList.length === 0) {
      return NextResponse.json(
        { error: "No subfolders found in the main folder" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      subfolders: subfolderList,
    });
  } catch (error: any) {
    console.error("💥 Error accessing subfolders and images:", error);

    // Handle specific Google Drive API errors
    if (error.status === 401) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired access token. Please sign in to Google Drive again.",
        },
        { status: 401 }
      );
    }

    if (error.status === 403) {
      if (error.message?.includes("quota") || error.message?.includes("rate")) {
        return NextResponse.json(
          {
            error: "Google Drive API quota exceeded. Please try again later.",
          },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          {
            error:
              "Access denied. Make sure the folder is shared and you have permission to access it.",
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to access subfolders and images",
        details: error.response?.data,
      },
      { status: error.status || 500 }
    );
  }
}
