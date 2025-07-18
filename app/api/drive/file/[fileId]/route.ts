import { NextResponse } from "next/server";
import { apiKeyManager } from "@/config/api-keys";

export async function GET(
  request: Request,
  { params }: { params: { fileId: string } }
) {
  const { fileId } = params;

  if (!fileId) {
    return NextResponse.json({ error: "File ID is required" }, { status: 400 });
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

  try {
    // Fetch file metadata with improved error handling
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime&key=${apiKey}`
    );

    if (!metadataResponse.ok) {
      if (metadataResponse.status === 404) {
        return NextResponse.json(
          { error: "File not found or not accessible" },
          { status: 404 }
        );
      } else if (metadataResponse.status === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied. File may be private or you don't have permission.",
          },
          { status: 403 }
        );
      } else if (metadataResponse.status === 429) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      }

      const errorData = await metadataResponse.json();
      return NextResponse.json(
        { error: errorData.error?.message || "Failed to get file metadata" },
        { status: metadataResponse.status }
      );
    }

    const metadata = await metadataResponse.json();

    // Optionally fetch file content if it's an image and small enough
    let fileContent = null;
    const maxContentSize = 10 * 1024 * 1024; // 10MB limit

    if (
      metadata.mimeType?.startsWith("image/") &&
      (!metadata.size || parseInt(metadata.size) <= maxContentSize)
    ) {
      try {
        const contentResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`,
          { headers: { Accept: metadata.mimeType } }
        );

        if (contentResponse.ok) {
          const buffer = await contentResponse.arrayBuffer();
          fileContent = Buffer.from(buffer);
        } else if (contentResponse.status === 403) {
          console.warn(
            "Access denied for file content, returning metadata only"
          );
        } else if (contentResponse.status === 429) {
          console.warn(
            "Quota exceeded for file content, returning metadata only"
          );
        }
      } catch (contentError) {
        console.warn("Failed to fetch file content:", contentError);
        // Continue with metadata only
      }
    }

    return NextResponse.json({
      metadata: {
        id: metadata.id,
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
        createdTime: metadata.createdTime,
      },
      hasContent: !!fileContent,
      // For testing, return a URL for the content (optional)
      contentUrl: fileContent
        ? `data:${metadata.mimeType};base64,${fileContent.toString("base64")}`
        : null,
      downloadUrl: `/api/drive/download-image?fileId=${fileId}`, // Use internal API
    });
  } catch (error: any) {
    console.error("Error accessing file:", error);

    // Handle network errors
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return NextResponse.json(
        { error: "Network error accessing Google Drive API" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to access file",
        details: error.response?.data,
      },
      { status: 500 }
    );
  }
}
