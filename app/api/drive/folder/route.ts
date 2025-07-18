import { google } from "googleapis";
import { NextResponse } from "next/server";
import { apiKeyManager } from "@/config/api-keys";

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

  // Extract folder ID from URL with improved pattern matching
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
    // Fetch folder metadata with error handling
    let folderResponse;
    try {
      folderResponse = await drive.files.get({
        fileId: folderId,
        fields: "id,name,mimeType,createdTime,modifiedTime",
      });
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Folder not found or not accessible" },
          { status: 404 }
        );
      } else if (error.status === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied. Make sure the folder is shared and you have permission.",
          },
          { status: 403 }
        );
      } else if (error.status === 429) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      }
      throw error;
    }

    if (folderResponse.data.mimeType !== "application/vnd.google-apps.folder") {
      return NextResponse.json(
        { error: "Provided ID is not a folder" },
        { status: 400 }
      );
    }

    // Fetch files in the folder with error handling
    let filesResponse;
    try {
      filesResponse = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: "files(id,name,mimeType,size,createdTime,modifiedTime)",
        pageSize: 1000, // Increase page size for better performance
      });
    } catch (error: any) {
      if (error.status === 403 && error.message?.includes("quota")) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      }
      throw error;
    }

    const files = filesResponse.data.files || [];

    // If downloading the first file, find the first non-folder file
    let firstFileContent = null;
    let firstFile = null;

    if (downloadFirstFile) {
      // Function to recursively find the first non-folder file
      const findFirstNonFolderFile = async (
        currentFolderId: string
      ): Promise<any> => {
        const response = await drive.files.list({
          q: `'${currentFolderId}' in parents`,
          fields: "files(id,name,mimeType,size,createdTime,modifiedTime)",
          pageSize: 100,
        });

        const currentFiles = response.data.files || [];

        // Look for non-folder files in the current folder
        for (const file of currentFiles) {
          if (file.mimeType !== "application/vnd.google-apps.folder") {
            return file;
          }
        }

        // If no non-folder files, search subfolders
        for (const file of currentFiles) {
          if (file.mimeType === "application/vnd.google-apps.folder") {
            const subfolderFile = await findFirstNonFolderFile(file.id || "");
            if (subfolderFile) {
              return subfolderFile;
            }
          }
        }

        return null; // No non-folder files found
      };

      // Find the first non-folder file starting from the main folder
      try {
        firstFile = await findFirstNonFolderFile(folderId);

        if (firstFile) {
          const fileResponse = await drive.files.get(
            { fileId: firstFile.id, alt: "media" },
            { responseType: "arraybuffer" }
          );
          firstFileContent = Buffer.from(fileResponse.data as ArrayBuffer);
        }
      } catch (error: any) {
        console.warn("Failed to download first file:", error);
        // Continue without first file content
      }
    }

    return NextResponse.json({
      folder: {
        id: folderResponse.data.id,
        name: folderResponse.data.name,
        createdTime: folderResponse.data.createdTime,
        modifiedTime: folderResponse.data.modifiedTime,
      },
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      })),
      firstFile: firstFile
        ? {
            id: firstFile.id,
            name: firstFile.name,
            mimeType: firstFile.mimeType,
            hasContent: !!firstFileContent,
            content: firstFileContent
              ? firstFileContent.toString("base64")
              : null,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error accessing folder:", error);

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

    return NextResponse.json(
      {
        error: error.message || "Failed to access folder",
        details: error.response?.data,
      },
      { status: error.status || 500 }
    );
  }
}
