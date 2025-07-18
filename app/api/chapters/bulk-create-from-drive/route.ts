import { google } from "googleapis";
import { NextResponse } from "next/server";

interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
}

interface Subfolder {
  id: string;
  name: string;
  images: DriveImage[];
}

interface ProcessedChapter {
  chapterNumber: string;
  title: string;
  images: DriveImage[];
  driveFolderId: string;
  driveFolderUrl: string;
}

// Function to get images from a folder
async function getImagesInFolder(
  drive: any,
  folderId: string
): Promise<DriveImage[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/'`,
    fields: "files(id,name,mimeType)",
    orderBy: "name",
  });

  return response.data.files || [];
}

// Function to get subfolders and their images
async function getSubfoldersAndImages(
  drive: any,
  folderId: string
): Promise<Subfolder[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
    fields: "files(id,name,mimeType)",
    orderBy: "name",
  });

  const subfolders = response.data.files || [];
  const subfolderList: Subfolder[] = [];

  for (const subfolder of subfolders) {
    const images = await getImagesInFolder(drive, subfolder.id);
    subfolderList.push({
      id: subfolder.id,
      name: subfolder.name,
      images: images,
    });
  }

  return subfolderList;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folderUrl } = body;

    if (!folderUrl) {
      return NextResponse.json(
        { error: "Folder URL is required" },
        { status: 400 }
      );
    }

    // Extract folder ID from URL
    const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!folderIdMatch || !folderIdMatch[1]) {
      return NextResponse.json(
        { error: "Invalid Google Drive folder URL" },
        { status: 400 }
      );
    }
    const folderId = folderIdMatch[1];

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google API key not configured" },
        { status: 500 }
      );
    }

    const drive = google.drive({ version: "v3", auth: apiKey });

    // Get subfolders and images
    const subfolders = await getSubfoldersAndImages(drive, folderId);

    if (subfolders.length === 0) {
      return NextResponse.json(
        { error: "No subfolders found in the main folder" },
        { status: 404 }
      );
    }

    // Process chapters (no OCR, just organize data)
    const processedChapters: ProcessedChapter[] = [];

    for (let i = 0; i < subfolders.length; i++) {
      const subfolder = subfolders[i];
      const chapterNumber = (i + 1).toString();

      // Prepare chapter data
      const chapterData: ProcessedChapter = {
        chapterNumber,
        title: subfolder.name,
        images: subfolder.images,
        driveFolderId: subfolder.id,
        driveFolderUrl: `https://drive.google.com/drive/folders/${subfolder.id}`,
      };

      processedChapters.push(chapterData);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedChapters.length} chapters`,
      totalSubfolders: subfolders.length,
      processedChapters: processedChapters.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        images: chapter.images,
        driveFolderId: chapter.driveFolderId,
        driveFolderUrl: chapter.driveFolderUrl,
        imageCount: chapter.images.length,
      })),
    });
  } catch (error) {
    console.error("Error in bulk chapter processing:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process chapters: ${errorMessage}` },
      { status: 500 }
    );
  }
}
