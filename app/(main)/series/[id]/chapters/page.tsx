"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getUserProfile, hasAccess } from "@/lib/auth";
import { Series, Chapter } from "@/types";
import {
  Loader,
  Plus,
  Search,
  PenLine,
  Trash2,
  Book,
  HelpCircle,
  FolderOpen,
  Image,
  FileText,
  Download,
} from "lucide-react";
import supabase from "@/lib/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GoogleDrivePicker } from "@/components/google-drive-picker";
import {
  DriveFolder,
  convertDriveFilesToChapterImages,
  // sortFilesNumerically,
} from "@/utils/google-drive-helper";

// Function to get API key count for load distribution
async function getApiKeyCount(): Promise<number> {
  try {
    const response = await fetch("/api/config/api-keys-count");
    const data = await response.json();
    return data.count || 1;
  } catch (error) {
    return 1; // Fallback to 1 if unable to get count
  }
}

export default function ChaptersPage({ params }: { params: { id: string } }) {
  const seriesId = params.id;
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newChapterNumber, setNewChapterNumber] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [isMultipleModalOpen, setIsMultipleModalOpen] = useState(false);
  const [fromChapter, setFromChapter] = useState("");
  const [toChapter, setToChapter] = useState("");
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(
    new Set()
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Google Drive specific states
  const [driveMode, setDriveMode] = useState(false);
  const [availableDriveFolders, setAvailableDriveFolders] = useState<
    DriveFolder[]
  >([]);
  const [fromChapterRange, setFromChapterRange] = useState("");
  const [toChapterRange, setToChapterRange] = useState("");
  const [isCreatingFromDrive, setIsCreatingFromDrive] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  // Add new states for chapter range selection
  const [availableSubfolders, setAvailableSubfolders] = useState<any[]>([]);
  const [isLoadingSubfolders, setIsLoadingSubfolders] = useState(false);

  // Extraction states
  const [extractingChapters, setExtractingChapters] = useState<Set<string>>(
    new Set()
  );
  const [extractionProgress, setExtractionProgress] = useState<
    Map<string, string>
  >(new Map());
  const [isBulkExtracting, setIsBulkExtracting] = useState(false);
  const [bulkExtractionProgress, setBulkExtractionProgress] = useState("");
  const [bulkExtractionStats, setBulkExtractionStats] = useState({
    currentBatch: 0,
    totalBatches: 0,
    currentChapter: 0,
    totalChapters: 0,
    completedChapters: 0,
    failedChapters: 0,
    totalImages: 0,
    processedImages: 0,
    percentage: 0,
  });

  // Add Google Drive status check
  const [googleDriveStatus, setGoogleDriveStatus] = useState<{
    isSignedIn: boolean;
    checking: boolean;
  }>({ isSignedIn: false, checking: true });

  const router = useRouter();
  const { toast } = useToast();

  // Helper function to sort chapters numerically
  const sortChaptersNumerically = (chapters: Chapter[]) => {
    return chapters.sort((a, b) => {
      // Extract numeric part from chapter number for comparison
      const aNum = parseFloat(a.chapter_number) || 0;
      const bNum = parseFloat(b.chapter_number) || 0;
      return aNum - bNum;
    });
  };

  // Helper function to sort images by name numerically
  const sortImagesNumerically = (images: any[]) => {
    return images.sort((a, b) => {
      // Extract numeric part from image name for comparison
      const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
      const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
      return aNum - bNum;
    });
  };

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      const access = await hasAccess("translator");
      setHasPermission(access);

      if (access) {
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

        setSeries(seriesData as unknown as Series);

        // Fetch chapters
        const { data: chaptersData } = await supabase
          .from("chapters")
          .select("*")
          .eq("series_id", seriesId);

        if (chaptersData) {
          // Sort chapters numerically before setting state
          const sortedChapters = sortChaptersNumerically(
            chaptersData as unknown as Chapter[]
          );
          setChapters(sortedChapters);
        }
      }

      setIsLoading(false);
    };

    checkAccessAndLoadData();
  }, [seriesId, router]);

  // Check Google Drive status on component mount
  useEffect(() => {
    const checkGoogleDriveStatus = async () => {
      try {
        const { refreshTokenStatus } = await import(
          "@/utils/google-drive-helper"
        );

        // Use refreshTokenStatus to check and restore token from localStorage
        const isConnected = refreshTokenStatus();

        setGoogleDriveStatus({
          isSignedIn: isConnected,
          checking: false,
        });

        if (isConnected) {
          // Token is available and valid
        }
      } catch (error) {
        setGoogleDriveStatus({
          isSignedIn: false,
          checking: false,
        });
      }
    };

    if (hasPermission) {
      checkGoogleDriveStatus();
    }
  }, [hasPermission]);

  const handleAddChapter = async () => {
    if (!newChapterNumber) {
      toast({
        title: "Chapter number is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = await getUserProfile();

      const { data, error } = await supabase
        .from("chapters")
        .insert({
          series_id: seriesId,
          chapter_number: newChapterNumber,
          title: newChapterTitle || null,
          created_by: user?.id,
        })
        .select();

      if (error) throw error;

      if (data) {
        // Add new chapter to state and sort numerically
        const newChapter = data[0] as unknown as Chapter;
        const allChapters = [...chapters, newChapter];
        const sortedChapters = sortChaptersNumerically(allChapters);
        setChapters(sortedChapters);
        setNewChapterNumber("");
        setNewChapterTitle("");
        setIsAddModalOpen(false);

        toast({
          title: "Chapter added successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to add chapter",
        variant: "destructive",
      });
    }
  };

  const handleExtractChapter = async (chapter: Chapter) => {
    if (!chapter.images || chapter.images.length === 0) {
      toast({
        title: "No images to extract",
        description: "This chapter doesn't have any images to process.",
        variant: "destructive",
      });
      return;
    }

    // Check if this chapter has Google Drive images (they have drive_folder_id)
    const hasGoogleDriveImages =
      chapter.drive_folder_id ||
      (chapter.images &&
        chapter.images.some(
          (img: any) => img.id && !img.url?.startsWith("http")
        ));

    setExtractingChapters((prev) => {
      const newSet = new Set(prev).add(chapter.id);
      return newSet;
    });
    setExtractionProgress((prev) => {
      const newMap = new Map(prev).set(chapter.id, "Initializing...");
      return newMap;
    });

    try {
      // Add a small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 500));

      setExtractionProgress((prev) => {
        const message = hasGoogleDriveImages
          ? "Checking Google Drive access..."
          : "Preparing images...";
        return new Map(prev).set(chapter.id, message);
      });

      let requestBody: any = {
        images: chapter.images,
        sourceLanguage: series?.source_language || "Korean",
      };

      // If chapter has Google Drive images, get access token
      if (hasGoogleDriveImages) {
        // Get access token from Google Drive helper
        const { getAccessToken } = await import("@/utils/google-drive-helper");
        const accessToken = getAccessToken();

        if (!accessToken) {
          toast({
            title: "Google Drive access required",
            description:
              "Please sign in to Google Drive first to extract text from Drive images.",
            variant: "destructive",
          });

          // Update Google Drive status
          setGoogleDriveStatus({
            isSignedIn: false,
            checking: false,
          });

          return;
        }

        requestBody.accessToken = accessToken;
        setExtractionProgress((prev) => {
          return new Map(prev).set(
            chapter.id,
            "Downloading images from Google Drive..."
          );
        });
      }

      setExtractionProgress((prev) => {
        const message = `Processing ${
          chapter.images?.length || 0
        } images with OCR...`;
        return new Map(prev).set(chapter.id, message);
      });

      const response = await fetch("/api/chapters/extract-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract text");
      }

      setExtractionProgress((prev) => {
        return new Map(prev).set(chapter.id, "Saving extracted text...");
      });

      // Update chapter in database
      const { error: updateError } = await supabase
        .from("chapters")
        .update({ extracted_text: data.extractedText })
        .eq("id", chapter.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setChapters((prev) => {
        const updated = prev.map((c) =>
          c.id === chapter.id ? { ...c, extracted_text: data.extractedText } : c
        );
        return updated;
      });

      toast({
        title: "Text extracted successfully",
        description: `Processed ${data.processedImages} images from Chapter ${
          chapter.chapter_number
        }${hasGoogleDriveImages ? " (Google Drive)" : ""}`,
      });
    } catch (error) {
      toast({
        title: "Failed to extract text",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setExtractingChapters((prev) => {
        const newSet = new Set(prev);
        newSet.delete(chapter.id);
        return newSet;
      });
      setExtractionProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(chapter.id);
        return newMap;
      });
    }
  };

  const handleBulkExtract = async () => {
    const chaptersToExtract = chapters.filter(
      (chapter) =>
        chapter.images &&
        Array.isArray(chapter.images) &&
        chapter.images.length > 0 &&
        !chapter.extracted_text
    );

    if (chaptersToExtract.length === 0) {
      toast({
        title: "No chapters to extract",
        description: "All chapters with images already have extracted text.",
        variant: "destructive",
      });
      return;
    }

    // Check if any chapters have Google Drive images
    const hasGoogleDriveChapters = chaptersToExtract.some(
      (chapter) =>
        chapter.drive_folder_id ||
        chapter.images?.some(
          (img: any) => img.id && !img.url?.startsWith("http")
        )
    );

    let accessToken = null;
    if (hasGoogleDriveChapters) {
      // Get access token from Google Drive helper
      const { getAccessToken } = await import("@/utils/google-drive-helper");
      accessToken = getAccessToken();

      if (!accessToken) {
        toast({
          title: "Google Drive access required",
          description:
            "Some chapters have Google Drive images. Please use the 'Create Multiple Chapters' feature to sign in to Google Drive first, or extract chapters individually after signing in.",
          variant: "destructive",
        });
        return;
      }
    }

    // Sort chapters numerically from low to high
    const sortedChaptersToExtract = sortChaptersNumerically([
      ...chaptersToExtract,
    ]);

    // Set bulk extraction state to true
    setIsBulkExtracting(true);

    // Calculate total statistics
    const totalImages = sortedChaptersToExtract.reduce(
      (sum, chapter) => sum + (chapter.images?.length || 0),
      0
    );
    const batchSize = 5; // Process 5 chapters at a time
    const totalBatches = Math.ceil(sortedChaptersToExtract.length / batchSize);

    // Initialize stats
    setBulkExtractionStats({
      currentBatch: 0,
      totalBatches,
      currentChapter: 0,
      totalChapters: sortedChaptersToExtract.length,
      completedChapters: 0,
      failedChapters: 0,
      totalImages,
      processedImages: 0,
      percentage: 0,
    });

    setBulkExtractionProgress(
      `Starting batch extraction of ${sortedChaptersToExtract.length} chapters (${totalImages} total images) - Processing ${batchSize} chapters at a time...`
    );

    // Get the actual number of API keys available
    const apiKeyCount = await getApiKeyCount();

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    let processedImagesCount = 0;
    let currentBatch = 1;

    try {
      // Process chapters in batches of 5
      for (let i = 0; i < sortedChaptersToExtract.length; i += batchSize) {
        const batch = sortedChaptersToExtract.slice(i, i + batchSize);
        const batchImageCount = batch.reduce(
          (sum, chapter) => sum + (chapter.images?.length || 0),
          0
        );

        // Update stats for current batch
        setBulkExtractionStats((prev) => ({
          ...prev,
          currentBatch,
          currentChapter: i + 1,
        }));

        setBulkExtractionProgress(
          `Processing batch ${currentBatch}/${totalBatches} (${batch.length} chapters, ${batchImageCount} images)...`
        );

        // Process current batch in parallel
        const batchPromises = batch.map(async (chapter, batchIndex) => {
          const chapterImages = chapter.images || [];
          const chapterNumber = chapter.chapter_number;

          // Add small delay to stagger requests within batch
          await new Promise((resolve) => setTimeout(resolve, batchIndex * 100));

          try {
            setBulkExtractionProgress(
              `Batch ${currentBatch}/${totalBatches}: Processing Chapter ${chapterNumber} (${chapterImages.length} images)...`
            );

            // Prepare request body
            const requestBody: any = {
              images: chapterImages, // Pass ALL images for this chapter
              sourceLanguage: series?.source_language || "Korean",
              apiKeyIndex: batchIndex % apiKeyCount, // Distribute across available API keys
            };

            // Add access token if this chapter has Google Drive images
            const chapterHasGoogleDriveImages =
              chapter.drive_folder_id ||
              chapter.images?.some(
                (img: any) => img.id && !img.url?.startsWith("http")
              );

            if (chapterHasGoogleDriveImages && accessToken) {
              requestBody.accessToken = accessToken;
            }

            const response = await fetch("/api/chapters/extract-text", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || "Failed to extract text");
            }

            // Update processed images count
            processedImagesCount += chapterImages.length;
            successCount++;

            // Update progress stats
            const newPercentage = Math.round(
              (processedImagesCount / totalImages) * 100
            );

            setBulkExtractionStats((prev) => ({
              ...prev,
              completedChapters: successCount,
              processedImages: processedImagesCount,
              percentage: newPercentage,
            }));

            setBulkExtractionProgress(
              `Batch ${currentBatch}/${totalBatches}: Chapter ${chapterNumber} completed (${chapterImages.length} images) - ${newPercentage}% overall progress`
            );

            // Update chapter in database
            const { error: updateError } = await supabase
              .from("chapters")
              .update({ extracted_text: data.extractedText })
              .eq("id", chapter.id);

            if (updateError) {
              throw updateError;
            }

            return {
              success: true,
              chapterId: chapter.id,
              extractedText: data.extractedText,
              chapterNumber: chapter.chapter_number,
              imageCount: chapterImages.length,
              processedImages: data.processedImages || chapterImages.length,
            };
          } catch (error) {
            failureCount++;

            setBulkExtractionStats((prev) => ({
              ...prev,
              failedChapters: failureCount,
            }));

            setBulkExtractionProgress(
              `Batch ${currentBatch}/${totalBatches}: Chapter ${chapterNumber} failed - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );

            return {
              success: false,
              chapterId: chapter.id,
              error: error instanceof Error ? error.message : "Unknown error",
              chapterNumber: chapter.chapter_number,
              imageCount: chapterImages.length,
            };
          }
        });

        // Wait for current batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Add delay between batches to avoid overwhelming the API
        if (currentBatch < totalBatches) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay between batches
        }

        currentBatch++;

        // Update local state with successful extractions from this batch
        setChapters((prev) =>
          prev.map((chapter) => {
            const successfulResult = batchResults.find(
              (result) =>
                result.status === "fulfilled" &&
                result.value.success &&
                result.value.chapterId === chapter.id
            );

            if (successfulResult && successfulResult.status === "fulfilled") {
              return {
                ...chapter,
                extracted_text: successfulResult.value.extractedText,
              };
            }
            return chapter;
          })
        );
      }

      const endTime = Date.now();
      const totalTimeMinutes =
        Math.round(((endTime - startTime) / 1000 / 60) * 10) / 10;

      // Final stats update
      setBulkExtractionStats((prev) => ({
        ...prev,
        percentage: 100,
      }));

      // Show completion message
      toast({
        title: "Batch extraction completed!",
        description: `Successfully extracted text from ${successCount} chapters (${processedImagesCount} total images) in ${totalTimeMinutes}min using ${totalBatches} batches of ${batchSize} chapters each. ${
          failureCount > 0 ? `${failureCount} chapters failed.` : ""
        }`,
      });
    } catch (error) {
      toast({
        title: "Failed to extract text",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsBulkExtracting(false);
      setBulkExtractionProgress("");
      setBulkExtractionStats({
        currentBatch: 0,
        totalBatches: 0,
        currentChapter: 0,
        totalChapters: 0,
        completedChapters: 0,
        failedChapters: 0,
        totalImages: 0,
        processedImages: 0,
        percentage: 0,
      });
    }
  };

  // Add function to load subfolders from Google Drive
  const loadSubfoldersFromDrive = async (folderUrl: string) => {
    if (!folderUrl) return;

    setIsLoadingSubfolders(true);
    try {
      // Get access token from Google Drive helper
      const { getAccessToken } = await import("@/utils/google-drive-helper");
      const accessToken = getAccessToken();

      if (!accessToken) {
        throw new Error(
          "Google Drive access token required. Please sign in to Google Drive first."
        );
      }

      const response = await fetch(
        `/api/drive/subfolder-images?folderUrl=${encodeURIComponent(
          folderUrl
        )}&accessToken=${encodeURIComponent(accessToken)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load subfolders");
      }

      // Sort subfolders by name/number order with improved logic
      const sortedSubfolders = data.subfolders
        .sort((a: any, b: any) => {
          // Try to extract numbers from the title for more accurate sorting
          const aMatch = a.title.match(/(\d+)/);
          const bMatch = b.title.match(/(\d+)/);

          if (aMatch && bMatch) {
            // Both have numbers, sort numerically
            return parseInt(aMatch[1]) - parseInt(bMatch[1]);
          } else if (aMatch && !bMatch) {
            // Only a has number, a comes first
            return -1;
          } else if (!aMatch && bMatch) {
            // Only b has number, b comes first
            return 1;
          } else {
            // Neither has numbers, sort alphabetically
            return a.title.localeCompare(b.title);
          }
        })
        .map((subfolder: any) => ({
          ...subfolder,
          // Sort images within each subfolder numerically
          images: sortImagesNumerically(subfolder.images || []),
        }));

      setAvailableSubfolders(sortedSubfolders);

      // Auto-set range if not already set
      if (!fromChapterRange && sortedSubfolders.length > 0) {
        setFromChapterRange("1");
        setToChapterRange(sortedSubfolders.length.toString());
      }

      toast({
        title: "Subfolders loaded",
        description: `Found ${sortedSubfolders.length} subfolders in the Google Drive folder.`,
      });
    } catch (error) {
      // Update Google Drive status if token is invalid
      if (error instanceof Error && error.message.includes("access token")) {
        setGoogleDriveStatus({
          isSignedIn: false,
          checking: false,
        });
      }

      toast({
        title: "Failed to load subfolders",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setAvailableSubfolders([]);
    } finally {
      setIsLoadingSubfolders(false);
    }
  };

  const handleDriveFoldersSelected = (folders: DriveFolder[]) => {
    setAvailableDriveFolders(folders);

    // Auto-set range if not already set
    if (!fromChapterRange && folders.length > 0) {
      setFromChapterRange("1");
      setToChapterRange(folders.length.toString());
    }
  };

  const handleCreateMultipleChapters = async () => {
    if (driveMode) {
      // Google Drive mode with range selection
      if (!fromChapterRange || !toChapterRange) {
        toast({
          title: "Chapter range is required",
          description: "Please specify which chapters to import (from and to).",
          variant: "destructive",
        });
        return;
      }

      const fromRange = parseInt(fromChapterRange);
      const toRange = parseInt(toChapterRange);

      if (isNaN(fromRange) || isNaN(toRange) || fromRange > toRange) {
        toast({
          title: "Invalid range",
          description: "Please enter a valid chapter range.",
          variant: "destructive",
        });
        return;
      }

      if (fromRange < 1) {
        toast({
          title: "Invalid range",
          description: "Start index must be at least 1.",
          variant: "destructive",
        });
        return;
      }

      if (availableDriveFolders.length === 0) {
        toast({
          title: "No folders found",
          description: "Please load Google Drive folder contents first.",
          variant: "destructive",
        });
        return;
      }

      if (toRange > availableDriveFolders.length) {
        toast({
          title: "Range exceeds available chapters",
          description: `Only ${availableDriveFolders.length} chapters are available (1-${availableDriveFolders.length}).`,
          variant: "destructive",
        });
        return;
      }

      setIsCreatingFromDrive(true);
      try {
        // Step 1: Select folders in the specified range (convert to 0-based indexing)
        setProgressMessage(`Selecting chapters ${fromRange} to ${toRange}...`);
        const selectedFolders = availableDriveFolders.slice(
          fromRange - 1,
          toRange
        );

        // Step 2: Process selected chapters
        setProgressMessage(
          `Processing ${selectedFolders.length} selected chapters...`
        );
        const processedChapters = selectedFolders.map((folder, index) => ({
          chapterNumber: (fromRange + index).toString(),
          title: `Chapter ${folder.name}`,
          images: convertDriveFilesToChapterImages(folder.files),
          driveFolderId: folder.id,
        }));

        // Step 3: Check for existing chapters
        setProgressMessage("Checking for existing chapters...");
        const { data: existingChapters } = await supabase
          .from("chapters")
          .select("chapter_number")
          .eq("series_id", seriesId);

        const existingChapterNumbers = new Set(
          existingChapters?.map((c) => c.chapter_number) || []
        );

        // Step 4: Filter out existing chapters and prepare data for insertion
        setProgressMessage("Preparing chapter data...");
        const user = await getUserProfile();
        const chaptersToCreate = [];
        let skippedCount = 0;

        for (const processedChapter of processedChapters) {
          if (existingChapterNumbers.has(processedChapter.chapterNumber)) {
            console.log(
              `Chapter ${processedChapter.chapterNumber} already exists, skipping...`
            );
            skippedCount++;
            continue;
          }

          chaptersToCreate.push({
            series_id: seriesId,
            chapter_number: processedChapter.chapterNumber,
            title: processedChapter.title,
            created_by: user?.id,
            images: processedChapter.images,
            drive_folder_id: processedChapter.driveFolderId,
          });
        }

        if (chaptersToCreate.length === 0) {
          toast({
            title: "All chapters already exist",
            description: `All ${processedChapters.length} selected chapters already exist in this series.`,
            variant: "destructive",
          });
          return;
        }

        // Step 5: Save chapters to Supabase
        setProgressMessage(
          `Saving ${chaptersToCreate.length} chapters to database...`
        );
        const { data: insertedChapters, error: insertError } = await supabase
          .from("chapters")
          .insert(chaptersToCreate)
          .select();

        if (insertError) {
          console.error("Error inserting chapters:", insertError);
          throw new Error("Failed to save chapters to database");
        }

        // Step 6: Update local state and UI
        setProgressMessage("Updating chapter list...");
        const { data: chaptersData } = await supabase
          .from("chapters")
          .select("*")
          .eq("series_id", seriesId);

        if (chaptersData) {
          // Sort chapters numerically before setting state
          const sortedChapters = sortChaptersNumerically(
            chaptersData as unknown as Chapter[]
          );
          setChapters(sortedChapters);
        }

        // Reset form
        setFromChapterRange("");
        setToChapterRange("");
        setAvailableDriveFolders([]);
        setIsMultipleModalOpen(false);
        setDriveMode(false);

        toast({
          title: "Chapters created successfully!",
          description: `${
            insertedChapters.length
          } chapters created from Google Drive (Chapters ${fromRange}-${toRange}). ${
            skippedCount > 0
              ? `${skippedCount} chapters were skipped (already exist).`
              : ""
          }`,
        });
      } catch (error) {
        toast({
          title: "Failed to create chapters",
          description:
            error instanceof Error
              ? error.message
              : "An error occurred while creating chapters from Google Drive.",
          variant: "destructive",
        });
      } finally {
        setIsCreatingFromDrive(false);
        setProgressMessage("");
      }
    } else {
      // Manual mode - existing functionality
      const from = parseInt(fromChapter);
      const to = parseInt(toChapter);

      if (!fromChapter || !toChapter) {
        toast({
          title: "Both 'From' and 'To' chapter numbers are required",
          variant: "destructive",
        });
        return;
      }

      if (isNaN(from) || isNaN(to)) {
        toast({
          title: "Please enter valid numbers",
          variant: "destructive",
        });
        return;
      }

      if (from > to) {
        toast({
          title:
            "'From' chapter number must be less than or equal to 'To' chapter number",
          variant: "destructive",
        });
        return;
      }

      if (to - from > 100) {
        toast({
          title: "Cannot create more than 100 chapters at once",
          variant: "destructive",
        });
        return;
      }

      // Check for existing chapters in the range
      const existingChaptersInRange = chapters.filter((chapter) => {
        const chapterNum = parseInt(chapter.chapter_number);
        return !isNaN(chapterNum) && chapterNum >= from && chapterNum <= to;
      });

      if (existingChaptersInRange.length > 0) {
        const existingNumbers = existingChaptersInRange
          .map((c) => c.chapter_number)
          .join(", ");
        if (
          !confirm(
            `The following chapters already exist: ${existingNumbers}. Do you want to continue and skip these?`
          )
        ) {
          return;
        }
      }

      setIsCreatingMultiple(true);

      try {
        const user = await getUserProfile();
        const chaptersToCreate = [];

        // Create array of chapters to insert
        for (let i = from; i <= to; i++) {
          // Skip if chapter already exists
          const exists = chapters.some(
            (chapter) => parseInt(chapter.chapter_number) === i
          );
          if (!exists) {
            chaptersToCreate.push({
              series_id: seriesId,
              chapter_number: i.toString(),
              title: `Chapter ${i}`,
              created_by: user?.id,
            });
          }
        }

        if (chaptersToCreate.length === 0) {
          toast({
            title: "All chapters in this range already exist",
            variant: "destructive",
          });
          setIsCreatingMultiple(false);
          return;
        }

        // Insert all chapters at once
        const { data, error } = await supabase
          .from("chapters")
          .insert(chaptersToCreate)
          .select();

        if (error) throw error;

        if (data) {
          // Add new chapters to state and sort numerically
          const newChapters = data as unknown as Chapter[];
          const allChapters = [...chapters, ...newChapters];
          const sortedChapters = sortChaptersNumerically(allChapters);
          setChapters(sortedChapters);

          // Reset form
          setFromChapter("");
          setToChapter("");
          setIsMultipleModalOpen(false);

          toast({
            title: `Successfully created ${newChapters.length} chapters`,
            description: `Chapters ${from} to ${to} have been added to the series.`,
          });
        }
      } catch (error) {
        toast({
          title: "Failed to create chapters",
          description:
            "An error occurred while creating the chapters. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsCreatingMultiple(false);
      }
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm("Are you sure you want to delete this chapter?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("chapters")
        .delete()
        .eq("id", chapterId);

      if (error) throw error;

      setChapters(chapters.filter((chapter) => chapter.id !== chapterId));

      toast({
        title: "Chapter deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Failed to delete chapter",
        variant: "destructive",
      });
    }
  };

  const handleSelectChapter = (chapterId: string, checked: boolean) => {
    const newSelected = new Set(selectedChapters);
    if (checked) {
      newSelected.add(chapterId);
    } else {
      newSelected.delete(chapterId);
    }
    setSelectedChapters(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedChapters(
        new Set(sortedFilteredChapters.map((chapter) => chapter.id))
      );
    } else {
      setSelectedChapters(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChapters.size === 0) {
      toast({
        title: "No chapters selected",
        description: "Please select chapters to delete",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedChapters.size} chapter(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("chapters")
        .delete()
        .in("id", Array.from(selectedChapters));

      if (error) throw error;

      setChapters(
        chapters.filter((chapter) => !selectedChapters.has(chapter.id))
      );
      setSelectedChapters(new Set());

      toast({
        title: "Chapters deleted successfully",
        description: `${selectedChapters.size} chapter(s) have been deleted.`,
      });
    } catch (error) {
      toast({
        title: "Failed to delete chapters",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredChapters = chapters.filter(
    (chapter) =>
      chapter.chapter_number
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (chapter.title &&
        chapter.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort filtered chapters numerically
  const sortedFilteredChapters = sortChaptersNumerically([...filteredChapters]);

  const handleStartTranslation = (chapterNumber: string) => {
    router.push(`/translate?series=${seriesId}&chapter=${chapterNumber}`);
  };

  const chaptersWithImages = chapters.filter(
    (chapter) =>
      chapter.images &&
      Array.isArray(chapter.images) &&
      chapter.images.length > 0 &&
      !chapter.extracted_text
  );

  // Function to refresh Google Drive status
  const refreshGoogleDriveStatus = async () => {
    setGoogleDriveStatus((prev) => ({ ...prev, checking: true }));

    try {
      const { refreshTokenStatus } = await import(
        "@/utils/google-drive-helper"
      );
      const isConnected = refreshTokenStatus();
      setGoogleDriveStatus({
        isSignedIn: isConnected,
        checking: false,
      });
    } catch (error) {
      setGoogleDriveStatus({
        isSignedIn: false,
        checking: false,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission || !series) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You don&apos;t have permission to manage this series.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/series")}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
          <div className="w-full">
            <h1 className="text-3xl font-bold tracking-tight">
              Chapters: {series.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage chapters for this series
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Chapter
            </Button>
            <Button
              onClick={() => setIsMultipleModalOpen(true)}
              className="w-full md:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Multiple Chapters
            </Button>
            <Button
              onClick={() => router.push(`/series/${seriesId}/glossary`)}
              className="w-full md:w-auto"
            >
              View Glossary
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chapters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Google Drive Status Indicator */}
          {!googleDriveStatus.checking && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm">
              {googleDriveStatus.isSignedIn ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-700 dark:text-green-400">
                    Google Drive Connected
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span className="text-orange-700 dark:text-orange-400">
                    Google Drive Not Connected
                  </span>
                </>
              )}
            </div>
          )}

          {/* Bulk Actions Row */}
          <div className="flex gap-2">
            {!googleDriveStatus.isSignedIn && !googleDriveStatus.checking && (
              <Button
                variant="outline"
                onClick={() => setIsMultipleModalOpen(true)}
                className="border-orange-500 text-orange-700 hover:bg-orange-50"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Connect Google Drive
              </Button>
            )}

            {chaptersWithImages.length > 0 && (
              <Button
                onClick={() => {
                  handleBulkExtract();
                }}
                disabled={isBulkExtracting}
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isBulkExtracting ? (
                  <div className="flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-medium">
                        {bulkExtractionStats.percentage > 0
                          ? `${bulkExtractionStats.percentage}% Complete`
                          : "Starting..."}
                      </span>
                      <span className="text-xs opacity-90">
                        {bulkExtractionStats.currentBatch > 0
                          ? `Batch ${bulkExtractionStats.currentBatch}/${bulkExtractionStats.totalBatches}`
                          : "Initializing..."}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract 5 Chapters at Once ({chaptersWithImages.length}{" "}
                    pending)
                  </>
                )}
              </Button>
            )}

            {selectedChapters.size > 0 && (
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedChapters.size})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Progress indicator for individual chapter extraction */}
        {extractingChapters.size > 0 && !isBulkExtracting && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader className="h-5 w-5 animate-spin text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-900 dark:text-amber-100">
                  Extracting Text from Chapter
                </h3>
                <div className="space-y-1 mt-2">
                  {Array.from(extractingChapters).map((chapterId) => {
                    const chapter = chapters.find((c) => c.id === chapterId);
                    const progress = extractionProgress.get(chapterId);
                    return (
                      <div
                        key={chapterId}
                        className="text-sm text-amber-700 dark:text-amber-300"
                      >
                        <span className="font-medium">
                          Chapter {chapter?.chapter_number}:
                        </span>{" "}
                        <span>{progress || "Processing..."}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator for Google Drive import */}
        {isCreatingFromDrive && progressMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Loader className="h-5 w-5 animate-spin text-green-600" />
              <div>
                <h3 className="font-medium text-green-900">
                  Importing Chapters from Google Drive
                </h3>
                <p className="text-sm text-green-700">{progressMessage}</p>
                <p className="text-xs text-green-600 mt-1">
                  Creating chapters with images linked to Google Drive folders
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator for bulk extraction */}
        {isBulkExtracting && bulkExtractionProgress && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Processing OCR Extraction (Batch Mode)
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    {bulkExtractionStats.percentage > 0 && (
                      <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                        {bulkExtractionStats.percentage}%
                      </div>
                    )}
                    <div className="text-blue-700 dark:text-blue-300 font-medium">
                      Batch {bulkExtractionStats.currentBatch}/
                      {bulkExtractionStats.totalBatches}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {bulkExtractionStats.percentage > 0 && (
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${bulkExtractionStats.percentage}%` }}
                    ></div>
                  </div>
                )}

                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {bulkExtractionProgress}
                </p>

                {/* Detailed Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="text-blue-600 dark:text-blue-400 font-medium">
                      Chapters
                    </div>
                    <div className="text-blue-900 dark:text-blue-100 font-bold">
                      {bulkExtractionStats.completedChapters}/
                      {bulkExtractionStats.totalChapters}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="text-blue-600 dark:text-blue-400 font-medium">
                      Images
                    </div>
                    <div className="text-blue-900 dark:text-blue-100 font-bold">
                      {bulkExtractionStats.processedImages}/
                      {bulkExtractionStats.totalImages}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="text-green-600 dark:text-green-400 font-medium">
                      Success
                    </div>
                    <div className="text-green-900 dark:text-green-100 font-bold">
                      {bulkExtractionStats.completedChapters}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="text-red-600 dark:text-red-400 font-medium">
                      Failed
                    </div>
                    <div className="text-red-900 dark:text-red-100 font-bold">
                      {bulkExtractionStats.failedChapters}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                  Processing chapters in batches of 5 to avoid overwhelming
                  Google Drive API. Each chapter processes ALL its images.
                </p>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {sortedFilteredChapters.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No chapters found matching your search."
                    : "No chapters found. Add your first chapter to get started."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedChapters.size ===
                            sortedFilteredChapters.length &&
                          sortedFilteredChapters.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all chapters"
                      />
                    </TableHead>
                    <TableHead>Chapter #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Images</TableHead>
                    <TableHead>OCR Status</TableHead>
                    <TableHead>Translation Status</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFilteredChapters.map((chapter) => (
                    <TableRow
                      key={chapter.id}
                      className={
                        selectedChapters.has(chapter.id) ? "bg-muted/50" : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedChapters.has(chapter.id)}
                          onCheckedChange={(checked) =>
                            handleSelectChapter(chapter.id, checked as boolean)
                          }
                          aria-label={`Select chapter ${chapter.chapter_number}`}
                        />
                      </TableCell>
                      <TableCell
                        className="font-medium cursor-pointer"
                        onClick={() =>
                          router.push(
                            `/series/${seriesId}/chapters/${chapter.id}`
                          )
                        }
                        title="View chapter details"
                      >
                        {chapter.chapter_number}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-2 cursor-pointer"
                          onClick={() =>
                            router.push(
                              `/series/${seriesId}/chapters/${chapter.id}`
                            )
                          }
                          title="View chapter details"
                        >
                          {chapter.title || "Untitled"}
                          {chapter.summary && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <p className="text-sm">{chapter.summary}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {chapter.images && Array.isArray(chapter.images) ? (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Image className="h-3 w-3" />
                            {chapter.images.length}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            No Images
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {chapter.extracted_text ? (
                          <Badge className="bg-green-100 text-green-800">
                            Extracted
                          </Badge>
                        ) : chapter.images &&
                          Array.isArray(chapter.images) &&
                          chapter.images.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-orange-600"
                            >
                              Pending
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleExtractChapter(chapter);
                              }}
                              disabled={extractingChapters.has(chapter.id)}
                            >
                              {extractingChapters.has(chapter.id) ? (
                                <div className="flex items-center gap-1">
                                  <Loader className="h-3 w-3 animate-spin" />
                                  <span className="text-xs">
                                    {extractionProgress.get(chapter.id) ||
                                      "Extracting..."}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <FileText className="h-3 w-3 mr-1" />
                                  Extract
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            No Images
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {chapter.translated_text ? (
                          <Badge className="bg-green-100 text-green-800">
                            Translated
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
                            Not Translated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(chapter.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartTranslation(chapter.id)}
                            title="Translate this chapter"
                          >
                            <Book className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteChapter(chapter.id)}
                            title="Delete chapter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold">Add New Chapter</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Chapter Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newChapterNumber}
                  onChange={(e) => setNewChapterNumber(e.target.value)}
                  placeholder="e.g., 1, 2, 3.5, or Season 2 Chapter 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Title (Optional)
                </label>
                <Input
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="Chapter title"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddChapter}>Add Chapter</Button>
            </div>
          </div>
        </div>
      )}

      {isMultipleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h2 className="text-xl font-bold">Create Multiple Chapters</h2>
              <div className="flex items-center space-x-2">
                <Label htmlFor="drive-mode" className="text-sm">
                  Google Drive
                </Label>
                <Switch
                  id="drive-mode"
                  checked={driveMode}
                  onCheckedChange={setDriveMode}
                />
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {driveMode ? (
                // Google Drive Mode
                <div className="space-y-4">
                  <GoogleDrivePicker
                    onFoldersSelected={handleDriveFoldersSelected}
                  />

                  {availableDriveFolders.length > 0 && (
                    <div className="space-y-4">
                      {/* Chapter Preview Section */}
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          Found Chapters ({availableDriveFolders.length})
                        </h3>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {availableDriveFolders.map((folder, index) => (
                            <div
                              key={folder.id}
                              className="flex items-center justify-between p-2 bg-background rounded-md border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <div className="bg-primary/10 p-1 rounded text-xs font-mono min-w-[2rem] text-center">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {folder.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Chapter {index + 1}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  <Image className="h-3 w-3 mr-1" />
                                  {folder.files.length}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Total Chapters:
                              </span>
                              <span className="font-medium">
                                {availableDriveFolders.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Total Images:
                              </span>
                              <span className="font-medium">
                                {availableDriveFolders.reduce(
                                  (total, folder) =>
                                    total + folder.files.length,
                                  0
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Range Selection Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            From Chapter Index{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            value={fromChapterRange}
                            onChange={(e) =>
                              setFromChapterRange(e.target.value)
                            }
                            placeholder="1"
                            min="1"
                            max={availableDriveFolders.length}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Start from folder index (1 = first folder)
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            To Chapter Index{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            value={toChapterRange}
                            onChange={(e) => setToChapterRange(e.target.value)}
                            placeholder={availableDriveFolders.length.toString()}
                            min="1"
                            max={availableDriveFolders.length}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            End at folder index (max:{" "}
                            {availableDriveFolders.length})
                          </p>
                        </div>
                      </div>

                      {fromChapterRange && toChapterRange && (
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-sm">
                            <strong>Preview:</strong> This will create{" "}
                            {Math.max(
                              0,
                              parseInt(toChapterRange) -
                                parseInt(fromChapterRange) +
                                1
                            )}{" "}
                            chapters (from index {fromChapterRange} to{" "}
                            {toChapterRange})
                            {parseInt(fromChapterRange) <=
                              parseInt(toChapterRange) &&
                            parseInt(toChapterRange) <=
                              availableDriveFolders.length &&
                            parseInt(fromChapterRange) >= 1 ? (
                              <span className="text-green-600"> ✓</span>
                            ) : (
                              <span className="text-red-600">
                                {" "}
                                ✗{" "}
                                {parseInt(fromChapterRange) >
                                parseInt(toChapterRange)
                                  ? "(Invalid range)"
                                  : parseInt(fromChapterRange) < 1
                                  ? "(Start index must be at least 1)"
                                  : "(Range exceeds available folders)"}
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Manual Mode (existing functionality)
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create a range of chapters with sequential numbering. Each
                    chapter will be titled &quot;Chapter X&quot;.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        From Chapter <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        value={fromChapter}
                        onChange={(e) => setFromChapter(e.target.value)}
                        placeholder="e.g., 1"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        To Chapter <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        value={toChapter}
                        onChange={(e) => setToChapter(e.target.value)}
                        placeholder="e.g., 25"
                        min="1"
                      />
                    </div>
                  </div>

                  {fromChapter &&
                    toChapter &&
                    !isNaN(parseInt(fromChapter)) &&
                    !isNaN(parseInt(toChapter)) && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm">
                          <strong>Preview:</strong> This will create{" "}
                          {Math.max(
                            0,
                            parseInt(toChapter) - parseInt(fromChapter) + 1
                          )}{" "}
                          chapters
                          {parseInt(fromChapter) <= parseInt(toChapter) &&
                          parseInt(toChapter) - parseInt(fromChapter) <= 100 ? (
                            <span className="text-green-600"> ✓</span>
                          ) : (
                            <span className="text-red-600">
                              {" "}
                              ✗{" "}
                              {parseInt(fromChapter) > parseInt(toChapter)
                                ? "(Invalid range)"
                                : "(Too many chapters - max 100)"}
                            </span>
                          )}
                        </p>
                        {parseInt(fromChapter) <= parseInt(toChapter) &&
                          parseInt(toChapter) - parseInt(fromChapter) <= 5 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Chapters:{" "}
                              {Array.from(
                                {
                                  length:
                                    parseInt(toChapter) -
                                    parseInt(fromChapter) +
                                    1,
                                },
                                (_, i) => parseInt(fromChapter) + i
                              ).join(", ")}
                            </p>
                          )}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Footer - Fixed */}
            <div className="border-t p-6 bg-muted/20 shrink-0">
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMultipleModalOpen(false);
                    setDriveMode(false);
                    setFromChapterRange("");
                    setToChapterRange("");
                    setAvailableDriveFolders([]);
                    // Refresh Google Drive status in case user signed in
                    refreshGoogleDriveStatus();
                  }}
                  disabled={isCreatingFromDrive}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateMultipleChapters}
                  disabled={
                    isCreatingFromDrive ||
                    (driveMode &&
                      (!fromChapterRange ||
                        !toChapterRange ||
                        availableDriveFolders.length === 0 ||
                        parseInt(fromChapterRange) > parseInt(toChapterRange) ||
                        parseInt(fromChapterRange) < 1 ||
                        parseInt(toChapterRange) >
                          availableDriveFolders.length))
                  }
                  className="w-full sm:w-auto"
                >
                  {isCreatingFromDrive ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      {progressMessage || "Creating from Drive..."}
                    </>
                  ) : driveMode ? (
                    `Import Selected Chapters${
                      fromChapterRange && toChapterRange
                        ? ` (${Math.max(
                            0,
                            parseInt(toChapterRange) -
                              parseInt(fromChapterRange) +
                              1
                          )})`
                        : ""
                    }`
                  ) : (
                    "Create Chapters"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
