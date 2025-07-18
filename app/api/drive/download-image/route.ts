import { google } from "googleapis";
import { NextResponse } from "next/server";
import { apiKeyManager } from "@/lib/api-key-manager";
import {} from "@/lib/coop-handler";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Check for OAuth access token in Authorization header
    const authHeader = request.headers.get("authorization");
    let drive;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const accessToken = authHeader.replace("Bearer ", "");
      // Use OAuth2Client for access tokens
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      drive = google.drive({ version: "v3", auth: oauth2Client });
    } else {
      // Use database-managed API keys with load balancing
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
      drive = google.drive({ version: "v3", auth: apiKey });
    }

    // Get file metadata first with error handling
    let fileMetadata;
    try {
      fileMetadata = await drive.files.get({
        fileId: fileId,
        fields: "name,mimeType,size",
      });
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "File not found or not accessible" },
          { status: 404 }
        );
      } else if (error.status === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied. File may be private or you don't have permission.",
          },
          { status: 403 }
        );
      } else if (error.status === 429) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      }
      throw error; // Re-throw for general error handling
    }

    // Download the file with error handling
    let response;
    try {
      response = await drive.files.get(
        {
          fileId: fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        }
      );
    } catch (error: any) {
      if (error.status === 403 && error.message?.includes("quota")) {
        return NextResponse.json(
          { error: "Google Drive API quota exceeded. Please try again later." },
          { status: 429 }
        );
      }
      throw error; // Re-throw for general error handling
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.data) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    // Validate image size
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        { error: "Downloaded file is empty" },
        { status: 500 }
      );
    }

    if (imageBuffer.length > 20 * 1024 * 1024) {
      // 20MB limit
      return NextResponse.json(
        { error: "File too large (max 20MB)" },
        { status: 413 }
      );
    }

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": fileMetadata.data.mimeType || "image/jpeg",
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        "Content-Disposition": `inline; filename="${fileMetadata.data.name}"`,
        // Add CORS headers
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Unexpected error in download-image:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to download image: ${errorMessage}` },
      { status: 500 }
    );
  }
}
