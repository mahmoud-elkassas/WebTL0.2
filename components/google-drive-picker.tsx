"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, Image, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  setAccessToken as setHelperAccessToken,
  clearAccessToken,
  getAccessToken,
} from "@/utils/google-drive-helper";


declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webContentLink?: string;
}

interface DriveFolder {
  id: string;
  name: string;
  files: DriveFile[];
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

if (!CLIENT_ID) {
  console.error("🔑 NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured");
}

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

export function GoogleDrivePicker({
  onFoldersSelected,
}: {
  onFoldersSelected: (folders: DriveFolder[]) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolderUrl, setSelectedFolderUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(
    null
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!CLIENT_ID) {
      setInitializationError(
        "Google Client ID not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment variables."
      );
      return;
    }
    initializeGoogleServices();
  }, []);

  // Check for existing token on component mount
  useEffect(() => {
    const checkExistingToken = async () => {
      try {
        const existingToken = getAccessToken();

        if (existingToken) {
          setAccessToken(existingToken);
          setIsSignedIn(true);
        }
      } catch (error) {
        console.warn("Token check failed:", error);
        // Token check failed, user needs to sign in
      }
    };

    checkExistingToken();
  }, []);

  async function initializeGoogleServices() {
    try {
      // Load Google Identity Services
      const gisScript = document.createElement("script");
      gisScript.src = "https://accounts.google.com/gsi/client";
      gisScript.onerror = () => {
        setInitializationError("Failed to load Google Identity Services");
      };
      gisScript.onload = () => {
        // Initialize Google Identity Services
        if (window.google) {
          // Load GAPI for Drive API
          loadGapi();
        } else {
          setInitializationError("Google Identity Services not available");
        }
      };
      document.head.appendChild(gisScript);
    } catch (error) {
      console.error("Error loading Google services:", error);
      setInitializationError("Failed to initialize Google services");
      toast({
        title: "Failed to load Google services",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
    }
  }

  async function loadGapi() {
    try {
      // Load GAPI script
      const gapiScript = document.createElement("script");
      gapiScript.src = "https://apis.google.com/js/api.js";
      gapiScript.onerror = () => {
        setInitializationError("Failed to load Google API");
      };
      gapiScript.onload = async () => {
        try {
          await new Promise((resolve, reject) => {
            window.gapi.load("client", {
              callback: resolve,
              onerror: reject,
            });
          });

          await window.gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });

          setIsLoaded(true);
          setInitializationError(null);
        } catch (error) {
          console.error("Error initializing GAPI client:", error);
          setInitializationError("Failed to initialize Google API client");
        }
      };
      document.head.appendChild(gapiScript);
    } catch (error) {
      console.error("Error loading GAPI:", error);
      setInitializationError("Failed to load Google API");
      toast({
        title: "Failed to load Google API",
        description: "Please refresh the page and try again",
        variant: "destructive",
      });
    }
  }

  function handleSignIn() {
    if (!CLIENT_ID) {
      toast({
        title: "Configuration Error",
        description: "Google Client ID not configured",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            console.error("OAuth error:", response.error);
            toast({
              title: "Failed to sign in",
              description: response.error_description || response.error,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }

          console.log("🔑 OAuth response:", response);

          setAccessToken(response.access_token);
          setIsSignedIn(true);
          setIsLoading(false);

          // Also set the token in the helper for other components to use
          // Google typically provides tokens with 3600 seconds (1 hour) expiry
          const expiresIn = response.expires_in || 3600;
          setHelperAccessToken(response.access_token, expiresIn);

          toast({
            title: "Successfully signed in to Google Drive",
          });
        },
        error_callback: (error: any) => {
          console.error("OAuth error callback:", error);
          toast({
            title: "Failed to sign in",
            description: "Authentication was cancelled or failed",
            variant: "destructive",
          });
          setIsLoading(false);
        },
      });

      tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Error signing in:", error);
      toast({
        title: "Failed to sign in",
        description: "Please try again or refresh the page",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  function handleSignOut() {
    try {
      if (accessToken && window.google?.accounts?.oauth2?.revoke) {
        window.google.accounts.oauth2.revoke(accessToken, () => {
          setAccessToken(null);
          setIsSignedIn(false);
          setFolders([]);
          setSelectedFolderUrl("");

          // Clear from helper and localStorage
          clearAccessToken();

          toast({
            title: "Signed out from Google Drive",
          });
        });
      } else {
        // Fallback if revoke is not available
        setAccessToken(null);
        setIsSignedIn(false);
        setFolders([]);
        setSelectedFolderUrl("");
        clearAccessToken();

        toast({
          title: "Signed out from Google Drive",
        });
      }
    } catch (error) {
      console.error("Error signing out:", error);
      // Still update the UI even if revoke fails
      setAccessToken(null);
      setIsSignedIn(false);
      setFolders([]);
      setSelectedFolderUrl("");
      clearAccessToken();

      toast({
        title: "Signed out from Google Drive",
      });
    }
  }

  function extractFolderIdFromUrl(url: string): string | null {
    const patterns = [
      /folders\/([a-zA-Z0-9_-]+)/,
      /[-\w]{25,}/,
      /id=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }

  async function loadFolderContents() {
    if (!selectedFolderUrl) {
      toast({
        title: "Please enter a Google Drive folder URL",
        variant: "destructive",
      });
      return;
    }

    const folderId = extractFolderIdFromUrl(selectedFolderUrl);
    if (!folderId) {
      toast({
        title: "Invalid Google Drive folder URL",
        description: "Please check the URL and try again",
        variant: "destructive",
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: "Please sign in first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Set the access token for GAPI client
      window.gapi.client.setToken({ access_token: accessToken });

      // Verify folder exists and is accessible
      try {
        const folderInfo = await window.gapi.client.drive.files.get({
          fileId: folderId,
          fields: "id,name,mimeType",
        });

        if (
          folderInfo.result.mimeType !== "application/vnd.google-apps.folder"
        ) {
          toast({
            title: "Invalid folder",
            description: "The provided URL does not point to a folder",
            variant: "destructive",
          });
          return;
        }
      } catch (folderError: any) {
        if (folderError.status === 404) {
          toast({
            title: "Folder not found",
            description:
              "The folder may not exist or you don't have access to it",
            variant: "destructive",
          });
        } else if (folderError.status === 403) {
          toast({
            title: "Access denied",
            description: "You don't have permission to access this folder",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error accessing folder",
            description: folderError.message || "Unknown error",
            variant: "destructive",
          });
        }
        return;
      }

      // Get subfolders
      const subfoldersResponse = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
        fields: "files(id, name)",
        orderBy: "name",
        pageSize: 1000,
      });

      const subfolders = subfoldersResponse.result.files || [];

      if (subfolders.length === 0) {
        toast({
          title: "No subfolders found",
          description: "This folder doesn't contain any subfolders",
          variant: "destructive",
        });
        return;
      }

      // Get images for each subfolder with error handling
      const foldersWithImages: DriveFolder[] = [];

      for (const subfolder of subfolders) {
        try {
          const imagesResponse = await window.gapi.client.drive.files.list({
            q: `'${subfolder.id}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf')`,
            fields: "files(id, name, mimeType, webContentLink)",
            orderBy: "name",
            pageSize: 1000,
          });

          foldersWithImages.push({
            id: subfolder.id,
            name: subfolder.name,
            files: imagesResponse.result.files || [],
          });
        } catch (subfolderError: any) {
          console.warn(
            `Failed to load images for subfolder ${subfolder.name}:`,
            subfolderError
          );
          // Add empty folder to maintain structure
          foldersWithImages.push({
            id: subfolder.id,
            name: subfolder.name,
            files: [],
          });
        }
      }

      // Sort folders numerically
      const sortedFolders = foldersWithImages.sort((a, b) => {
        const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
        const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
        return aNum - bNum;
      });

      setFolders(sortedFolders);
      onFoldersSelected(sortedFolders);

      toast({
        title: "Folder loaded successfully",
        description: `Found ${sortedFolders.length} subfolders`,
      });
    } catch (error: any) {
      console.error("Error loading folder contents:", error);

      if (error.status === 401) {
        toast({
          title: "Authentication expired",
          description: "Please sign in again",
          variant: "destructive",
        });
        handleSignOut();
      } else if (error.status === 403) {
        toast({
          title: "Access denied",
          description: "You don't have permission to access this folder",
          variant: "destructive",
        });
      } else if (error.status === 429) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait a moment and try again",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to load folder contents",
          description:
            error.message || "Please check the folder URL and try again",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Show initialization error if any
  if (initializationError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              {initializationError}
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Google Drive Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoaded ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading Google services...
            </span>
          </div>
        ) : !isSignedIn ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to your Google account to access your Drive folders
            </p>
            <Button onClick={handleSignIn} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Signed in to Google Drive
              </p>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Google Drive Folder URL
              </label>
              <input
                type="text"
                value={selectedFolderUrl}
                onChange={(e) => setSelectedFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
              />
            </div>

            <Button
              onClick={loadFolderContents}
              disabled={!selectedFolderUrl || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading folder contents...
                </>
              ) : (
                <>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Load Folder Contents
                </>
              )}
            </Button>

            {folders.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      ✓ Successfully loaded Google Drive folder
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {folders.length} chapters
                    </Badge>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Found {folders.length} subfolder(s) with{" "}
                    {folders.reduce(
                      (total, folder) => total + folder.files.length,
                      0
                    )}{" "}
                    files total
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
