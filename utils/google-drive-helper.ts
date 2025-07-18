declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webContentLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  files: DriveFile[];
}

// Store the access token globally for the session
let currentAccessToken: string | null = null;

// localStorage keys
const ACCESS_TOKEN_KEY = "google_drive_access_token";
const TOKEN_EXPIRY_KEY = "google_drive_token_expiry";

// Initialize token from localStorage on module load
if (typeof window !== "undefined") {
  const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (storedToken && storedExpiry) {
    const expiryTime = parseInt(storedExpiry);
    const now = Date.now();

    if (now < expiryTime) {
      // Token is still valid
      currentAccessToken = storedToken;
    } else {
      // Token has expired, clean up
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }
}

/**
 * Set access token with expiry time
 */
export function setAccessToken(token: string, expiresIn?: number) {
  currentAccessToken = token;

  if (typeof window !== "undefined") {
    try {
      // Store in localStorage
      localStorage.setItem(ACCESS_TOKEN_KEY, token);

      // Calculate expiry time (default to 1 hour if not provided)
      const expiryTime = Date.now() + (expiresIn ? expiresIn * 1000 : 3600000); // 1 hour default
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      console.warn("Failed to store token in localStorage:", error);
      // Continue without localStorage support
    }
  }
}

/**
 * Clear access token from memory and localStorage
 */
export function clearAccessToken() {
  currentAccessToken = null;

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (error) {
      console.warn("Failed to clear token from localStorage:", error);
      // Continue anyway
    }
  }
}

/**
 * Download file content from Google Drive using the Drive API
 */
export async function downloadDriveFile(fileId: string): Promise<Blob> {
  if (!window.gapi || !window.gapi.client) {
    throw new Error(
      "Google API not initialized. Please sign in to Google Drive first."
    );
  }

  if (!currentAccessToken) {
    throw new Error(
      "No access token available. Please sign in to Google Drive."
    );
  }

  try {
    // Set the access token for this request
    window.gapi.client.setToken({ access_token: currentAccessToken });

    const response = await window.gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media",
    });

    // Check if response is valid
    if (!response || !response.body) {
      throw new Error("Empty response from Google Drive API");
    }

    // Convert response to blob with proper MIME type
    let mimeType = "image/jpeg"; // default
    try {
      // Try to get file metadata to determine MIME type
      const metadataResponse = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: "mimeType",
      });
      if (metadataResponse.result?.mimeType) {
        mimeType = metadataResponse.result.mimeType;
      }
    } catch (metadataError) {
      console.warn("Could not get file metadata, using default MIME type");
    }

    const blob = new Blob([response.body], { type: mimeType });
    return blob;
  } catch (error: any) {
    if (error.status === 401) {
      // Token expired, clear it
      clearAccessToken();
      throw new Error(
        "Access token expired. Please sign in to Google Drive again."
      );
    } else if (error.status === 403) {
      throw new Error(
        "Access denied. You may not have permission to access this file."
      );
    } else if (error.status === 404) {
      throw new Error(
        "File not found. The file may have been deleted or moved."
      );
    } else if (error.status === 429) {
      throw new Error(
        "Google Drive API quota exceeded. Please try again later."
      );
    }
    throw new Error(`Failed to download file: ${error.message || error}`);
  }
}

/**
 * Convert blob to base64 string for use with OCR APIs
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => {
      reject(new Error("Failed to convert blob to base64"));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Drive files to the format expected by your existing chapter creation logic
 */
export function convertDriveFilesToChapterImages(driveFiles: DriveFile[]) {
  return driveFiles.map((file, index) => ({
    id: file.id,
    name: file.name,
    url: file.webContentLink || "",
    mimeType: file.mimeType,
    order: index,
  }));
}

/**
 * Check if user is signed in to Google Drive
 */
export function isSignedInToGoogleDrive(): boolean {
  return !!getAccessToken();
}

/**
 * Get current user's access token for API calls
 * Also checks if token is still valid and clears if expired
 */
export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    // First check if we have a token in memory
    if (currentAccessToken) {
      // Check if token is still valid
      const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        const now = Date.now();

        if (now >= expiryTime) {
          // Token has expired, clear it
          clearAccessToken();
          return null;
        }
      }
      return currentAccessToken;
    }

    // If no token in memory, try to restore from localStorage
    try {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

      if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        const now = Date.now();

        if (now < expiryTime) {
          // Token is still valid, restore it
          currentAccessToken = storedToken;
          return currentAccessToken;
        } else {
          // Token has expired, clean up
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
        }
      }
    } catch (error) {
      console.warn("Failed to access localStorage:", error);
      // Continue without localStorage support
    }
  }

  return null;
}

/**
 * Refresh token status from localStorage (useful for checking across different components)
 */
export function refreshTokenStatus(): boolean {
  const token = getAccessToken();
  return !!token;
}

/**
 * Get token expiry time in milliseconds
 */
export function getTokenExpiry(): number | null {
  if (typeof window !== "undefined") {
    try {
      const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (storedExpiry) {
        return parseInt(storedExpiry);
      }
    } catch (error) {
      console.warn("Failed to get token expiry:", error);
    }
  }
  return null;
}

/**
 * Check if token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(): boolean {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return false;

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

  return expiryTime - now <= fiveMinutes;
}

/**
 * Get time remaining before token expires (in seconds)
 */
export function getTokenTimeRemaining(): number | null {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return null;

  const now = Date.now();
  const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));

  return remaining;
}
