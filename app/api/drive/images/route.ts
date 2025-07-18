import { google } from "googleapis";
import { NextResponse } from "next/server";
import { apiKeyManager } from "@/config/api-keys";

async function getAllImages(drive: any, folderId: string): Promise<any[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents`,
    fields: "files(id,name,mimeType)",
    pageSize: 1000, // Increase page size
  });

  const files = response.data.files || [];
  let images: any[] = [];

  for (const file of files) {
    if (file.mimeType.startsWith("image/")) {
      images.push(file);
    } else if (file.mimeType === "application/vnd.google-apps.folder") {
      const subImages = await getAllImages(drive, file.id);
      images = images.concat(subImages);
    }
  }

  return images;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folderUrl = searchParams.get("folderUrl");
  const downloadFirstFile = searchParams.get("downloadFirstFile") === "true";

  if (!folderUrl) {
    return NextResponse.json(
      { error: "No folder URL provided" },
      { status: 400 }
    );
  }

  // Improved folder ID extraction
  const folderIdPatterns = [
    /folders\/([a-zA-Z0-9_-]+)/,
    /[-\w]{25,}/,
    /id=([a-zA-Z0-9_-]+)/,
  ];

  let folderId = null;
  for (const pattern of folderIdPatterns) {
    const match = folderUrl.match(pattern);
    if (match) {
      folderId = match[1] || match[0];
      break;
    }
  }

  if (!folderId) {
    return NextResponse.json({ error: "Invalid folder URL" }, { status: 400 });
  }

  // Use database-managed API keys
  let apiKey: string;
  try {
    apiKey = await apiKeyManager.getNextGoogleKey();
  } catch (error) {
    console.error("Failed to get Google API key:", error);
    return NextResponse.json(
      {
        error:
          "Google API key not configured. Please configure API keys in admin panel.",
      },
      { status: 500 }
    );
  }

  const drive = google.drive({ version: "v3", auth: apiKey });

  try {
    const images = await getAllImages(drive, folderId);

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images found in folder or subfolders" },
        { status: 404 }
      );
    }

    if (downloadFirstFile) {
      const firstImage = images[0];
      try {
        const fileResponse = await drive.files.get(
          { fileId: firstImage.id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const imageContent = Buffer.from(fileResponse.data as ArrayBuffer);

        return new NextResponse(imageContent, {
          headers: {
            "Content-Type": firstImage.mimeType || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${firstImage.name}"`,
            "Cache-Control": "public, max-age=3600", // Cache for 1 hour
          },
        });
      } catch (downloadError: any) {
        if (downloadError.status === 403) {
          return NextResponse.json(
            { error: "Access denied for downloading the first image" },
            { status: 403 }
          );
        } else if (downloadError.status === 429) {
          return NextResponse.json(
            {
              error: "Google Drive API quota exceeded. Please try again later.",
            },
            { status: 429 }
          );
        }
        throw downloadError;
      }
    }

    // Return metadata for all images
    return NextResponse.json({
      images: images.map((image) => ({
        id: image.id,
        name: image.name,
        mimeType: image.mimeType,
        downloadUrl: `/api/drive/download-image?fileId=${image.id}`, // Use internal API
      })),
      totalCount: images.length,
    });
  } catch (error: any) {
    console.error("Error accessing images:", error);

    // Handle specific Google Drive API errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: "Authentication failed. Please check API key configuration." },
        { status: 401 }
      );
    }

    if (error.status === 403) {
      if (error.message?.includes("quota") || error.message?.includes("rate")) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          {
            error:
              "Access denied. Make sure the folder is shared and you have permission.",
          },
          { status: 403 }
        );
      }
    }

    if (error.status === 404) {
      return NextResponse.json(
        { error: "Folder not found or not accessible" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to access images",
        details: error.response?.data,
      },
      { status: error.status || 500 }
    );
  }
}
