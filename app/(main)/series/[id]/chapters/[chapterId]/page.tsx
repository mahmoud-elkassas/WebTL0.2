"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getUserProfile, hasAccess } from "@/lib/auth";
import { Series, Chapter, TranslationHistory, DriveImage } from "@/types";
import {
  Loader,
  ArrowLeft,
  Book,
  FileText,
  Save,
  Download,
  Image,
  ExternalLink,
  Brain,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Move,
} from "lucide-react";
import supabase from "@/lib/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getAccessToken,
  isSignedInToGoogleDrive,
} from "@/utils/google-drive-helper";

// Image Zoom Modal Component
const ImageZoomModal = ({
  image,
  imageUrl,
  isOpen,
  onClose,
}: {
  image: DriveImage | null;
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale((prev) => Math.min(prev * 1.5, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev / 1.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 5);
    setScale(newScale);
  };

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Attach wheel event listener with non-passive options
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [scale]);

  if (!isOpen || !image || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/50 text-white">
          <div>
            <h3 className="font-medium">{image.name}</h3>
            <p className="text-sm text-gray-300">
              Page {parseInt(image.name.match(/\d+/)?.[0] || "1")} • Zoom:{" "}
              {Math.round(scale * 100)}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-white hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-move flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={image.name}
            className="max-w-none select-none pointer-events-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${
                position.y / scale
              }px)`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            draggable={false}
          />
        </div>

        {/* Instructions */}
        <div className="p-4 bg-black/50 text-white text-center text-sm">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Move className="h-3 w-3" />
              Drag to pan
            </span>
            <span className="flex items-center gap-1">
              <ZoomIn className="h-3 w-3" />
              Mouse wheel to zoom
            </span>
            <span>ESC to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChapterDetailsPage({
  params,
}: {
  params: { id: string; chapterId: string };
}) {
  const seriesId = params.id;
  const chapterId = params.chapterId;
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [memorySummary, setMemorySummary] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [showImages, setShowImages] = useState(true);
  const [activeTab, setActiveTab] = useState("compare");
  const [zoomModal, setZoomModal] = useState<{
    image: DriveImage;
    imageUrl: string;
  } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  // Refs for scroll position saving
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const imagesScrollRef = useRef<HTMLDivElement>(null);
  const memoryScrollRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Map<string, number>>(new Map());

  const router = useRouter();
  const { toast } = useToast();

  // Helper function to sort images by name numerically
  const sortImagesNumerically = (images: DriveImage[]) => {
    return images.sort((a, b) => {
      // Extract numeric part from image name for comparison
      const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
      const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
      return aNum - bNum;
    });
  };

  // Save scroll position when leaving a tab
  const saveScrollPosition = (tabValue: string) => {
    let scrollElement: HTMLDivElement | null = null;

    switch (tabValue) {
      case "compare":
        scrollElement = contentScrollRef.current;
        break;
      case "images":
        scrollElement = imagesScrollRef.current;
        break;
      case "memory":
        scrollElement = memoryScrollRef.current;
        break;
    }

    if (scrollElement) {
      scrollPositions.current.set(tabValue, scrollElement.scrollTop);
    }
  };

  // Restore scroll position when entering a tab
  const restoreScrollPosition = (tabValue: string) => {
    setTimeout(() => {
      let scrollElement: HTMLDivElement | null = null;

      switch (tabValue) {
        case "compare":
          scrollElement = contentScrollRef.current;
          break;
        case "images":
          scrollElement = imagesScrollRef.current;
          break;
        case "memory":
          scrollElement = memoryScrollRef.current;
          break;
      }

      if (scrollElement) {
        const savedPosition = scrollPositions.current.get(tabValue) || 0;
        scrollElement.scrollTop = savedPosition;
      }
    }, 50); // Small delay to ensure DOM is ready
  };

  // Handle tab changes
  const handleTabChange = (value: string) => {
    saveScrollPosition(activeTab);
    setActiveTab(value);
    restoreScrollPosition(value);
  };

  // Update loadImageUrl to fetch with access token and use blob URLs
  const loadImageUrl = useCallback(
    async (image: DriveImage) => {
      try {
        const accessToken = getAccessToken();

        if (!accessToken) {
          toast({
            title: "Google Drive Access Required",
            description:
              "Please sign in to Google Drive to view images. You can do this in the Google Drive Picker component.",
            variant: "destructive",
          });
          return;
        }

        const res = await fetch(
          `/api/drive/download-image?fileId=${image.id}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error(
              "Access denied. You may not have permission to access this file."
            );
          } else if (res.status === 401) {
            throw new Error(
              "Authentication failed. Please sign in to Google Drive again."
            );
          }
          throw new Error("Failed to load image");
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setImageUrls((prev) => new Map(prev).set(image.id, blobUrl));
      } catch (error) {
        console.error("Error loading image:", error);
        toast({
          title: "Failed to load image",
          description: `${image.name}: ${
            error instanceof Error
              ? error.message
              : "The image could not be loaded. Please try again."
          }`,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // Handle image zoom
  const handleImageZoom = (image: DriveImage) => {
    const imageUrl = imageUrls.get(image.id);
    if (imageUrl) {
      setZoomModal({ image, imageUrl });
    }
  };

  // Handle ESC key for closing modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomModal(null);
      }
    };

    if (zoomModal) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [zoomModal]);

  // Auto-load images when chapter changes
  useEffect(() => {
    if (chapter && chapter.images && showImages) {
      // Load images that don't have URLs yet
      chapter.images.forEach((image) => {
        if (!imageUrls.has(image.id)) {
          loadImageUrl(image);
        }
      });
    }
  }, [chapter, showImages, imageUrls, loadImageUrl]);

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      console.log("🔍 Checking authentication status...");

      // Check authentication status first
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      console.log("👤 Current user:", user ? "Logged in" : "Not logged in");
      console.log("❌ Auth error:", authError);

      if (authError || !user) {
        console.log("🚫 User not authenticated - redirecting to login");
        toast({
          title: "Authentication Required",
          description: "Please log in to access this page.",
          variant: "destructive",
        });
        setHasPermission(false);
        setIsLoading(false);
        // Redirect to login page
        router.push("/login");
        return;
      }

      const access = await hasAccess("translator");
      setHasPermission(access);

      if (access) {
        try {
          // Fetch series
          const { data: seriesData, error: seriesError } = await supabase
            .from("series")
            .select("*")
            .eq("id", seriesId)
            .single();

          if (seriesError || !seriesData) {
            router.push("/series");
            return;
          }

          setSeries(seriesData as Series);

          // Fetch chapter
          const { data: chapterData, error: chapterError } = await supabase
            .from("chapters")
            .select("*")
            .eq("id", chapterId)
            .single();

          if (chapterError || !chapterData) {
            router.push(`/series/${seriesId}/chapters`);
            return;
          }

          setChapter(chapterData as Chapter);
          setMemorySummary(chapterData.memory_summary || "");
          setExtractedText(chapterData.extracted_text || "");
          setTranslatedText(chapterData.translated_text || "");
        } catch (error) {
          console.error("Error loading data:", error);
          toast({
            title: "Error loading chapter data",
            variant: "destructive",
          });
        }
      }

      setIsLoading(false);
    };

    checkAccessAndLoadData();
  }, [seriesId, chapterId, router, toast]);

  // Define chapterImages here so it can be used in useEffect
  const chapterImages =
    chapter && chapter.images && Array.isArray(chapter.images)
      ? sortImagesNumerically([...chapter.images])
      : [];

  // Load only the first image when images tab is activated
  useEffect(() => {
    if (activeTab === "images" && showImages && chapterImages.length > 0) {
      const firstImage = chapterImages[0];
      if (!imageUrls.has(firstImage.id)) {
        loadImageUrl(firstImage);
      }
    }
  }, [activeTab, showImages, chapterImages]);

  const handleStartTranslation = () => {
    router.push(`/translate?series=${seriesId}&chapter=${chapter?.id}`);
  };

  const handleExtractText = async () => {
    console.log("🔘 Extract Text button clicked!");
    console.log("📖 Chapter:", chapter);
    console.log("🖼️ Chapter images:", chapter?.images);
    console.log("🔍 Current URL:", window.location.href);
    console.log("🔍 Chapter ID from URL:", chapterId);
    console.log("🔍 Chapter ID from chapter object:", chapter?.id);
    console.log("🔍 Images array:", chapter?.images);
    console.log(
      "🔍 Image IDs:",
      chapter?.images?.map((img) => img.id)
    );

    // Check if user is authenticated with Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log("👤 Supabase user:", user ? "Found" : "Not found");
    console.log("❌ Auth error:", authError);

    // Also check session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    console.log("🔑 Supabase session:", session ? "Found" : "Not found");
    console.log("❌ Session error:", sessionError);
    console.log(
      "🔑 Session token:",
      session?.access_token ? "Present" : "Not present"
    );

    if (authError || !user) {
      console.log("🚫 User not authenticated with Supabase");
      toast({
        title: "Authentication Required",
        description:
          "Please log in to the application first. Go to /login to sign in.",
        variant: "destructive",
      });
      return;
    }

    if (!chapter) {
      console.log("❌ Chapter data not loaded");
      toast({
        title: "Chapter not loaded",
        description: "Please wait for the chapter data to load.",
        variant: "destructive",
      });
      return;
    }

    if (!chapter.images || chapter.images.length === 0) {
      console.log("❌ No images to extract from");
      toast({
        title: "No images to extract from",
        description: "This chapter has no images to extract text from.",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ Chapter data is ready:", {
      chapterId: chapter.id,
      imageCount: chapter.images.length,
      images: chapter.images.map((img) => img.id),
    });

    // Get Google Drive access token
    const accessToken = getAccessToken();
    console.log("Access token:", accessToken ? "Found" : "Not found");
    console.log("Access token length:", accessToken?.length);
    console.log("Is signed in to Google Drive:", isSignedInToGoogleDrive());

    if (!accessToken) {
      console.log("No access token found");
      toast({
        title: "Google Drive Access Required",
        description:
          "Please sign in to Google Drive to extract text from images. You can do this in the Google Drive Picker component.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      // Debug chapter data
      console.log("📖 Frontend: Chapter data:", {
        chapter: !!chapter,
        chapterId: chapter?.id,
        images: chapter?.images,
        imageCount: chapter?.images?.length,
      });

      // Get the current session token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionToken = session?.access_token;

      console.log(
        "🔑 Frontend: Session token:",
        sessionToken ? "Present" : "Not present"
      );

      const response = await fetch(`/api/chapters/extract-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapterId: chapter.id,
          imageIds: chapter.images.map((img) => img.id),
          accessToken: accessToken,
          sessionToken: sessionToken, // Send session token in request body
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.extractedText) {
        setExtractedText(data.extractedText);
        toast({
          title: "Text extracted successfully",
          description: `Extracted ${
            data.extractedText.length
          } characters from ${
            data.successfulImages || chapter.images.length
          } images.`,
        });
      } else {
        throw new Error("No text was extracted from the images");
      }
    } catch (error) {
      console.error("Error extracting text:", error);
      toast({
        title: "Failed to extract text",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while extracting text from images.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!chapter) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .update({
          extracted_text: extractedText,
          translated_text: translatedText,
          memory_summary: memorySummary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chapter.id);

      if (error) throw error;

      // Update local chapter state
      setChapter({
        ...chapter,
        extracted_text: extractedText,
        translated_text: translatedText,
        memory_summary: memorySummary,
      });

      toast({
        title: "Changes saved successfully",
      });
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({
        title: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update handleDownloadImage to use access token
  const handleDownloadImage = async (image: DriveImage) => {
    try {
      const accessToken = getAccessToken();

      if (!accessToken) {
        toast({
          title: "Google Drive Access Required",
          description: "Please sign in to Google Drive to download images.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `/api/drive/download-image?fileId=${image.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "Access denied. You may not have permission to access this file."
          );
        } else if (response.status === 401) {
          throw new Error(
            "Authentication failed. Please sign in to Google Drive again."
          );
        }
        throw new Error("Failed to download image");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = image.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Image downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  const handleOpenInDrive = () => {
    if (chapter?.drive_folder_url) {
      window.open(chapter.drive_folder_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission || !series || !chapter) {
    return (
      <div className="mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You don't have permission to view this chapter.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => router.push("/series")}>
                Go Back
              </Button>
              <Button onClick={() => router.push("/login")}>Log In</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/series/${seriesId}/chapters`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Chapter {chapter.chapter_number}
            </h1>
            <p className="text-muted-foreground text-sm">
              {series.name} — {chapter.title || "Untitled"}
            </p>
            {chapterImages.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  {chapterImages.length} images
                </Badge>
                {chapter.drive_folder_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenInDrive}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open in Google Drive
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              console.log("Button clicked! isExtracting:", isExtracting);
              console.log("Chapter images:", chapter?.images);
              console.log("Images length:", chapter?.images?.length);
              handleExtractText();
            }}
            disabled={
              isExtracting || !chapter?.images || chapter.images.length === 0
            }
          >
            <FileText className="h-4 w-4 mr-2" />
            {isExtracting ? "Extracting..." : "Extract Text"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveChanges}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button onClick={handleStartTranslation}>
            <Book className="h-4 w-4 mr-2" />
            Translate Chapter
          </Button>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compare">Compare View</TabsTrigger>
          <TabsTrigger value="content">Text Only</TabsTrigger>
          <TabsTrigger value="images" disabled={chapterImages.length === 0}>
            Images ({chapterImages.length})
          </TabsTrigger>
          <TabsTrigger value="memory">Memory Summary</TabsTrigger>
        </TabsList>

        {/* Compare View - Side by Side Images and Text */}
        <TabsContent value="compare" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Compare Images with Extracted Text
              </CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Side-by-side view for easy comparison of images and extracted
                  text
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImages(!showImages)}
                    className="flex items-center gap-1"
                  >
                    {showImages ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        Hide Images
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        Show Images
                      </>
                    )}
                  </Button>
                  {chapter.drive_folder_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenInDrive}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Drive
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-1"
                  >
                    <Save className="h-3 w-3" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chapterImages.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No images found for this chapter
                  </p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-6 h-[700px]">
                  {/* Images Section */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Chapter Images
                      </h3>
                    </div>
                    <ScrollArea className="h-full p-4" ref={imagesScrollRef}>
                      <div className="space-y-6">
                        {chapterImages.map((image, index) => (
                          <div
                            key={image.id}
                            className="border rounded-lg overflow-hidden bg-card"
                          >
                            {/* Image Header */}
                            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/10 p-1.5 rounded">
                                  <Image className="h-3 w-3 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-xs">
                                    Page{" "}
                                    {parseInt(
                                      image.name.match(/\d+/)?.[0] ||
                                        (index + 1).toString()
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {image.name}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadImage(image)}
                                className="flex items-center gap-1 h-7 px-2"
                              >
                                <Download className="h-3 w-3" />
                                <span className="sr-only">Download</span>
                              </Button>
                            </div>

                            {/* Image Display */}
                            {showImages && (
                              <div className="p-3">
                                {imageUrls.has(image.id) ? (
                                  <>
                                    <div className="relative bg-white rounded-md overflow-hidden border shadow-sm">
                                      <img
                                        src={imageUrls.get(image.id)}
                                        alt={image.name}
                                        className="w-full h-auto min-h-[600px] object-contain"
                                        style={{
                                          imageRendering: "crisp-edges",
                                          minWidth: "100%",
                                          maxWidth: "none",
                                        }}
                                        onError={() => {
                                          console.log(
                                            `Image failed to load: ${image.name}`
                                          );
                                          toast({
                                            title: "Failed to load image",
                                            description: `${image.name}: The image could not be loaded. Please try again.`,
                                            variant: "destructive",
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="p-2 bg-muted/30 text-center">
                                      <p className="text-xs text-muted-foreground">
                                        Scroll to view full image • Right-click
                                        to save
                                      </p>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-center p-6 border-2 border-dashed border-muted rounded-lg">
                                    <div className="text-center">
                                      <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadImageUrl(image)}
                                        className="flex items-center gap-1 h-7"
                                      >
                                        <Eye className="h-3 w-3" />
                                        Load Image
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {!showImages && (
                              <div className="p-6 text-center text-muted-foreground">
                                <Image className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">Image hidden</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Text Section */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Extracted & Translated Text
                      </h3>
                    </div>
                    <ScrollArea className="h-full p-4" ref={contentScrollRef}>
                      <div className="space-y-6">
                        {/* Source Text - Now Editable */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            Source Text (Extracted)
                          </h4>
                          <Textarea
                            value={extractedText}
                            onChange={(e) => setExtractedText(e.target.value)}
                            placeholder="Enter or edit the extracted text from images..."
                            className="font-mono text-sm bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 min-h-[200px] resize-none"
                          />
                        </div>

                        {/* Translated Text - Now Editable */}
                        <div>
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Translated Text
                          </h4>
                          <Textarea
                            value={translatedText}
                            onChange={(e) => setTranslatedText(e.target.value)}
                            placeholder="Enter or edit the translated text..."
                            className="font-mono text-sm bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 min-h-[200px] resize-none"
                          />
                        </div>

                        {/* Quick Actions */}
                        <div className="pt-4 border-t">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExtractText}
                              disabled={
                                isExtracting ||
                                !chapter?.images ||
                                chapter.images.length === 0
                              }
                              className="flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              {isExtracting ? "Extracting..." : "Extract Text"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleStartTranslation}
                              className="flex items-center gap-1"
                            >
                              <Book className="h-3 w-3" />
                              Continue Translation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSaveChanges}
                              disabled={isSaving}
                              className="flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" />
                              {isSaving ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Text Only View */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Chapter Translation
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleExtractText}
                    disabled={
                      isExtracting ||
                      !chapter?.images ||
                      chapter.images.length === 0
                    }
                    className="flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    {isExtracting ? "Extracting..." : "Extract Text"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-1"
                  >
                    <Save className="h-3 w-3" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea
                className="h-[600px] rounded-md border p-4"
                ref={contentScrollRef}
              >
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Source Text - Now Editable */}
                  <div>
                    <h3 className="text-base font-semibold mb-2">
                      Source Text
                    </h3>
                    <Textarea
                      value={extractedText}
                      onChange={(e) => setExtractedText(e.target.value)}
                      placeholder="Enter or edit the extracted text from images..."
                      className="font-mono text-sm bg-muted/50 min-h-[500px] resize-none"
                    />
                  </div>

                  {/* Translated Text - Now Editable */}
                  <div>
                    <h3 className="text-base font-semibold mb-2">
                      Translated Text
                    </h3>
                    <Textarea
                      value={translatedText}
                      onChange={(e) => setTranslatedText(e.target.value)}
                      placeholder="Enter or edit the translated text..."
                      className="font-mono text-sm bg-muted/50 min-h-[500px] resize-none"
                    />
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Only View */}
        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Image className="h-5 w-5" />
                Chapter Images
              </CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  View all chapter images
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImages(!showImages)}
                    className="flex items-center gap-1"
                  >
                    {showImages ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        Hide Images
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        Show Images
                      </>
                    )}
                  </Button>
                  {chapter.drive_folder_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenInDrive}
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Drive
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-1"
                  >
                    <Save className="h-3 w-3" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chapterImages.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No images found for this chapter
                  </p>
                </div>
              ) : (
                <ScrollArea
                  className="h-[600px] rounded-md border p-4"
                  ref={imagesScrollRef}
                >
                  <div className="space-y-6">
                    {chapterImages.map((image, index) => (
                      <div
                        key={image.id}
                        className="border rounded-lg overflow-hidden bg-card"
                      >
                        {/* Image Header */}
                        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded">
                              <Image className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {image.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Page{" "}
                                {parseInt(
                                  image.name.match(/\d+/)?.[0] ||
                                    (index + 1).toString()
                                )}{" "}
                                • {image.mimeType}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadImage(image)}
                              className="flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                          </div>
                        </div>

                        {/* Image Display */}
                        {showImages && (
                          <div className="p-4">
                            {loadingImages.has(image.id) ? (
                              <div className="flex items-center justify-center p-8">
                                <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">
                                  Loading image...
                                </span>
                              </div>
                            ) : imageUrls.has(image.id) ? (
                              <>
                                <div className="relative bg-white rounded-md overflow-hidden border shadow-sm">
                                  <img
                                    src={imageUrls.get(image.id)}
                                    alt={image.name}
                                    className="w-full h-auto max-h-[500px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => handleImageZoom(image)}
                                    onLoad={() => {
                                      // Image loaded successfully
                                    }}
                                    onError={() => {
                                      toast({
                                        title: "Failed to display image",
                                        description: image.name,
                                        variant: "destructive",
                                      });
                                    }}
                                  />
                                  <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                                    <ZoomIn className="h-3 w-3 inline mr-1" />
                                    Click to zoom
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground text-center">
                                  Click image to zoom and pan • Use zoom
                                  controls for better readability
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                                <div className="text-center">
                                  <Image className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground mb-3">
                                    Click "Show Image" to load and view this
                                    image
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadImageUrl(image)}
                                    className="flex items-center gap-1"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Show Image
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Show placeholder when images are hidden */}
                        {!showImages && (
                          <div className="p-8 text-center text-muted-foreground">
                            <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Image hidden</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5" />
                    Chapter Memory Summary
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Edit the memory summary for this chapter. This helps
                    maintain context and continuity across translations.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="flex items-center gap-1"
                >
                  <Save className="h-3 w-3" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea
                className="h-[600px] rounded-md border p-4"
                ref={memoryScrollRef}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Memory Summary</label>
                  <Textarea
                    value={memorySummary}
                    onChange={(e) => setMemorySummary(e.target.value)}
                    placeholder="Enter a summary of key events, character developments, and important plot points from this chapter..."
                    rows={20}
                    className="font-mono text-sm resize-none"
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
                  <span>{memorySummary.length} characters</span>
                  <span>
                    Last updated:{" "}
                    {chapter?.updated_at
                      ? new Date(chapter.updated_at).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {zoomModal && (
        <ImageZoomModal
          image={zoomModal.image}
          imageUrl={zoomModal.imageUrl}
          isOpen={!!zoomModal}
          onClose={() => setZoomModal(null)}
        />
      )}
    </div>
  );
}
