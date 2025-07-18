"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  Loader2,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import JSZip from "jszip";
import { apiKeyManager } from "@/config/api-keys";

interface ImageUploaderProps {
  onImageProcessed: (pageData: PageData) => void;
  onLoadingChange: (loading: boolean, total: number) => void;
  sourceLanguage: string;
}

interface PageData {
  pageNumber: number;
  extractedText: string;
  translatedText: string;
  glossary: Record<string, string>;
  overview: string;
}

interface ProcessedImage {
  id: string;
  file: File;
  previewUrl: string;
  extractedText?: string;
  pageNumber: number;
  status: "pending" | "processing" | "completed" | "error";
  pageData?: PageData;
  errorMessage?: string;
}

export function ImageUploader({
  onImageProcessed,
  onLoadingChange,
  sourceLanguage,
}: ImageUploaderProps) {
  const [selectedImages, setSelectedImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [speedExtractionMode, setSpeedExtractionMode] = useState(false); // Default to speed mode
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Function to extract text from image using the new API key manager
  const extractTextFromImage = async (
    imageFile: File,
    sourceLanguage: string
  ) => {
    try {
      const apiKey = apiKeyManager.getNextKey();

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("sourceLanguage", sourceLanguage);

      const response = await fetch("/api/extract-texts", {
        method: "POST",
        headers: {
          "X-API-Key": await apiKey,
        },
        body: formData,
      });

      if (response.status === 429) {
        throw new Error("Rate limited");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Function to extract text from multiple images at once (max 3 per request)
  const extractTextFromMultipleImages = async (
    images: ProcessedImage[],
    sourceLanguage: string
  ) => {
    try {
      const apiKey = apiKeyManager.getNextKey();

      const formData = new FormData();
      formData.append("sourceLanguage", sourceLanguage);

      // Add all images to the form data (max 3)
      images.forEach((image, index) => {
        formData.append(`image_${index}`, image.file);
        formData.append(`pageNumber_${index}`, image.pageNumber.toString());
        formData.append(`fileName_${index}`, image.file.name);
      });

      const response = await fetch("/api/extract-texts", {
        method: "POST",
        headers: {
          "X-API-Key": await apiKey,
        },
        body: formData,
      });

      if (response.status === 429) {
        throw new Error("Rate limited");
      }

      if (response.status === 413) {
        throw new Error("Payload too large - try with fewer images");
      }

      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Bad request: ${errorData.error || "Invalid request format"}`
        );
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  // Function to process images in chunks of 3
  const processImageChunks = async (
    images: ProcessedImage[],
    sourceLanguage: string
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    const CHUNK_SIZE = 3;
    const chunks: ProcessedImage[][] = [];

    // Split images into chunks of 3
    for (let i = 0; i < images.length; i += CHUNK_SIZE) {
      chunks.push(images.slice(i, i + CHUNK_SIZE));
    }

    const allResults: any[] = [];
    let processedCount = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const isLastChunk = chunkIndex === chunks.length - 1;

      try {
        setCurrentFile(
          `Processing batch ${chunkIndex + 1}/${chunks.length} (${
            chunk.length
          } images)...`
        );

        const result = await extractTextFromMultipleImages(
          chunk,
          sourceLanguage
        );

        if (!result.success) {
          // Handle chunk failure - mark all images in this chunk as failed
          const chunkResults = chunk.map((image) => ({
            pageNumber: image.pageNumber,
            fileName: image.file.name,
            extractedText: "",
            rawResponse: "",
            success: false,
            error: result.error || "Chunk processing failed",
          }));
          allResults.push(...chunkResults);
        } else {
          // Add successful results
          allResults.push(...result.data.results);
        }

        processedCount += chunk.length;
        const progressPercent = Math.round(
          (processedCount / images.length) * 100
        );
        setProgress(progressPercent);

        // Small delay between chunks to avoid overwhelming the API
        if (!isLastChunk) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunkIndex + 1}:`, error);

        // Mark all images in this chunk as failed
        const chunkResults = chunk.map((image) => ({
          pageNumber: image.pageNumber,
          fileName: image.file.name,
          extractedText: "",
          rawResponse: "",
          success: false,
          error:
            error instanceof Error ? error.message : "Chunk processing failed",
        }));
        allResults.push(...chunkResults);

        processedCount += chunk.length;
        const progressPercent = Math.round(
          (processedCount / images.length) * 100
        );
        setProgress(progressPercent);
      }
    }

    return {
      success: true,
      data: {
        results: allResults,
        totalImages: images.length,
        successCount: allResults.filter((r) => r.success).length,
        failureCount: allResults.filter((r) => !r.success).length,
      },
    };
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add("border-primary");
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove("border-primary");
    }
  }, []);

  const processFiles = async (files: File[]) => {
    const newImages: ProcessedImage[] = [];
    const zip = new JSZip();

    for (const file of files) {
      if (file.type === "application/zip") {
        try {
          const zipContent = await zip.loadAsync(file);
          const imageFiles = Object.values(zipContent.files).filter(
            (file) => !file.dir && file.name.match(/\.(jpg|jpeg|png|webp)$/i)
          );

          for (const imageFile of imageFiles) {
            const blob = await imageFile.async("blob");
            const fileName =
              imageFile.name.split(/[\/\\]/).pop() || imageFile.name;
            const newFile = new File([blob], fileName, {
              type: "image/jpeg",
            });
            newImages.push({
              id: generateId(),
              file: newFile,
              previewUrl: URL.createObjectURL(blob),
              pageNumber: newImages.length + 1,
              status: "pending",
            });
          }
        } catch (error) {
          console.error("Error processing ZIP file:", error);
          toast.error("Failed to process ZIP file");
        }
      } else if (file.type.startsWith("image/")) {
        newImages.push({
          id: generateId(),
          file,
          previewUrl: URL.createObjectURL(file),
          pageNumber: newImages.length + 1,
          status: "pending",
        });
      }
    }

    if (newImages.length > 0) {
      setSelectedImages((prev) => {
        const combinedImages = [...prev, ...newImages];
        // Renumber all images
        return combinedImages.map((img, idx) => ({
          ...img,
          pageNumber: idx + 1,
        }));
      });
      toast.success(`Added ${newImages.length} images`);
    } else {
      toast.error("No valid images found");
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove("border-primary");
    }

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages((prev) => {
      const newImages = prev.filter((img) => img.id !== id);
      return newImages.map((img, idx) => ({
        ...img,
        pageNumber: idx + 1,
      }));
    });
  };

  const extractTextsFromImages = async () => {
    if (selectedImages.length === 0) {
      toast.error("Please select images first");
      return;
    }

    setIsProcessing(true);
    onLoadingChange(true, selectedImages.length);
    setProgress(0);

    try {
      const totalImages = selectedImages.length;
      let processedImages = [...selectedImages];

      toast.info(`Starting text extraction for ${totalImages} images`);

      // Set all images to processing status
      processedImages = processedImages.map((image) => ({
        ...image,
        status: "processing" as const,
      }));
      setSelectedImages([...processedImages]);

      if (speedExtractionMode && totalImages > 1) {
        // Use batch processing for multiple images in speed mode
        const result = await processImageChunks(
          processedImages,
          sourceLanguage
        );

        if (!result.success || !result.data) {
          throw new Error(result.error || "Batch text extraction failed");
        }

        const batchResults = result.data.results;

        // Process the batch results
        batchResults.forEach((apiResult: any) => {
          const imageIndex = processedImages.findIndex(
            (img) => img.pageNumber === apiResult.pageNumber
          );

          if (imageIndex !== -1) {
            if (apiResult.success) {
              // Create page data
              const pageData: PageData = {
                pageNumber: apiResult.pageNumber,
                extractedText: apiResult.extractedText,
                translatedText: "",
                glossary: {},
                overview: "",
              };

              // Update the image with success
              processedImages[imageIndex] = {
                ...processedImages[imageIndex],
                extractedText: pageData.extractedText,
                status: "completed",
                pageData,
              };

              // Update parent component with page data
              onImageProcessed(pageData);
            } else {
              // Update with error
              processedImages[imageIndex] = {
                ...processedImages[imageIndex],
                status: "error",
                errorMessage: apiResult.error || "Unknown error",
              };
            }
          }
        });

        // Update state with all processed images
        setSelectedImages([...processedImages]);
        setProgress(100);

        const successCount = batchResults.filter((r: any) => r.success).length;
        const failureCount = batchResults.filter((r: any) => !r.success).length;

        if (successCount > 0) {
          toast.success(
            `Batch extraction completed: ${successCount}/${totalImages} images successful`
          );
        }

        if (failureCount > 0) {
          toast.warning(
            `${failureCount} images failed to extract. You can retry individual images.`
          );
        }
      } else {
        // Single image processing mode (original method)
        for (let i = 0; i < totalImages; i++) {
          const image = processedImages[i];
          setCurrentFile(image.file.name);

          try {
            const result = await extractTextFromImage(
              image.file,
              sourceLanguage
            );

            if (!result.success) {
              throw new Error(result.error || "Text extraction failed");
            }

            const data = result.data;

            // Create page data
            const pageData: PageData = {
              pageNumber: image.pageNumber,
              extractedText: data.extractedText || data.text,
              translatedText: data.translatedText || "",
              glossary: data.glossary || {},
              overview: data.overview || "",
            };

            // Update the image with extracted text and status
            processedImages[i] = {
              ...processedImages[i],
              extractedText: pageData.extractedText,
              status: "completed",
              pageData,
            };

            // Update state with processed images
            setSelectedImages([...processedImages]);

            // Calculate and update progress
            const newProgress = Math.round(((i + 1) / totalImages) * 100);
            setProgress(newProgress);

            // Update parent component with page data
            onImageProcessed(pageData);

            console.log(
              `✅ Successfully extracted text from ${image.file.name}`
            );
          } catch (error) {
            console.error(`Error extracting text from image ${i + 1}:`, error);
            processedImages[i] = {
              ...image,
              status: "error",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            };
            setSelectedImages([...processedImages]);
            toast.error(
              `Failed to extract text from ${image.file.name}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }

        const successCount = processedImages.filter(
          (img) => img.status === "completed"
        ).length;
        const failureCount = processedImages.filter(
          (img) => img.status === "error"
        ).length;

        if (successCount > 0) {
          toast.success(
            `Text extraction completed: ${successCount}/${totalImages} images successful`
          );
        }

        if (failureCount > 0) {
          toast.warning(
            `${failureCount} images failed to extract. You can retry individual images.`
          );
        }
      }

      // Signal completion after all images are processed
      setTimeout(() => {
        onLoadingChange(false, totalImages);
        console.log("✅ All images processed, signaling completion");
      }, 500);
    } catch (error) {
      console.error("Error extracting texts:", error);
      toast.error("Failed to extract texts from images");

      // Set all processing images to error state
      const errorImages = selectedImages.map((image) =>
        image.status === "processing"
          ? {
              ...image,
              status: "error" as const,
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            }
          : image
      );
      setSelectedImages(errorImages);
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile("");
    }
  };

  const clearAllImages = () => {
    setSelectedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("All images cleared");
  };

  const getStatusIcon = (status: ProcessedImage["status"]) => {
    switch (status) {
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  // Retry extraction for a specific image
  const retryImageExtraction = async (imageId: string) => {
    const imageIndex = selectedImages.findIndex((img) => img.id === imageId);
    if (imageIndex === -1) return;

    const image = selectedImages[imageIndex];
    const newImages = [...selectedImages];

    // Set status to processing
    newImages[imageIndex] = {
      ...image,
      status: "processing",
      errorMessage: undefined,
    };
    setSelectedImages(newImages);

    try {
      setCurrentFile(image.file.name);

      const result = await extractTextFromImage(image.file, sourceLanguage);

      if (!result.success) {
        throw new Error(result.error || "Text extraction failed");
      }

      const data = result.data;

      // Create page data
      const pageData: PageData = {
        pageNumber: image.pageNumber,
        extractedText: data.extractedText || data.text,
        translatedText: data.translatedText || "",
        glossary: data.glossary || {},
        overview: data.overview || "",
      };

      // Update the image with success
      newImages[imageIndex] = {
        ...newImages[imageIndex],
        extractedText: pageData.extractedText,
        status: "completed",
        pageData,
        errorMessage: undefined,
      };

      setSelectedImages(newImages);
      onImageProcessed(pageData);

      toast.success(`Successfully retried ${image.file.name}`);
    } catch (error) {
      // Update with error
      newImages[imageIndex] = {
        ...newImages[imageIndex],
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };

      setSelectedImages(newImages);
      toast.error(
        `Retry failed for ${image.file.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setCurrentFile("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        ref={dropZoneRef}
        className="flex items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/80 transition-colors duration-200 border-gray-300 dark:border-gray-600"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
          <p className="mb-2 text-sm text-muted-foreground">
            <span className="font-semibold">Click to upload</span> or drag and
            drop
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, JPEG, WEBP, ZIP files
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.zip"
          multiple
          onChange={handleImageSelect}
        />
      </div>

      {/* Selected Images List */}
      {selectedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Selected Files ({selectedImages.length})
            </h3>
            <div className="flex items-center gap-2">
              {/* Speed Extraction Toggle */}
              <Button
                variant={speedExtractionMode ? "default" : "outline"}
                size="sm"
                type="button"
                onClick={() => setSpeedExtractionMode(!speedExtractionMode)}
                disabled={isProcessing}
                className={`transition-all duration-200 ${
                  speedExtractionMode
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                }`}
                title={
                  speedExtractionMode
                    ? "Speed mode: Process 3 images at once"
                    : "Standard mode: Process images one by one"
                }
              >
                {speedExtractionMode ? (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    Speed ON
                  </>
                ) : (
                  <>
                    <ZapOff className="w-4 h-4 mr-1" />
                    Speed OFF
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={clearAllImages}
                disabled={isProcessing}
                className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Images Grid */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedImages.map((image) => (
              <div
                key={image.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border dark:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getStatusIcon(image.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Page {image.pageNumber}
                      </span>
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {image.file.name}
                      </span>
                    </div>
                    {image.status === "completed" && image.extractedText && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">
                        {image.extractedText}
                      </p>
                    )}
                    {image.status === "error" && (
                      <div className="mt-1">
                        <p className="text-xs text-red-500">
                          Failed to extract text
                        </p>
                        {image.errorMessage && (
                          <p className="text-xs text-red-400 mt-1 truncate max-w-[300px]">
                            {image.errorMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {image.status === "error" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => retryImageExtraction(image.id)}
                      disabled={isProcessing}
                      className="flex-shrink-0 h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Retry extraction"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    disabled={isProcessing}
                    className="flex-shrink-0 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{currentFile}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {selectedImages.length > 1 && (
                <div className="text-xs text-muted-foreground text-center">
                  {speedExtractionMode
                    ? selectedImages.length <= 3
                      ? `Speed mode: Processing ${selectedImages.length} images simultaneously...`
                      : `Speed mode: Processing in batches of 3 (${Math.ceil(
                          selectedImages.length / 3
                        )} batches total)...`
                    : `Standard mode: Processing images one by one...`}
                </div>
              )}
            </div>
          )}

          {/* Extract Text Button */}
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            type="button"
            onClick={extractTextsFromImages}
            disabled={
              isProcessing ||
              selectedImages.every((img) => img.status === "completed")
            }
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {speedExtractionMode && selectedImages.length > 1
                  ? `Processing ${selectedImages.length} Images (Speed Mode)...`
                  : "Extracting Text..."}
              </div>
            ) : selectedImages.every((img) => img.status === "completed") ? (
              "All Texts Extracted"
            ) : (
              `Extract Text from ${selectedImages.length} Image${
                selectedImages.length > 1 ? "s" : ""
              }${
                speedExtractionMode && selectedImages.length > 1
                  ? " (Speed Mode)"
                  : speedExtractionMode
                  ? ""
                  : " (Standard Mode)"
              }`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
