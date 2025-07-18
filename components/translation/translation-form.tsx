"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  EnhancedQualityReport,
  ChapterData,
  EntityType,
  FormattingReport,
  Gender,
  Role,
  Series,
  SourceLanguage,
  TranslationInput,
  PageData,
  QualityReport,
  ExtendedTranslationResult,
  DatabaseGlossaryEntry,
  TranslationResultType,
} from "@/types";
import { Chapter, TranslationHistory } from "@/types/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Info,
  Loader2,
  Sparkles,
  RefreshCw,
  BookOpen,
  Edit,
  Save,
  X,
  ArrowRight,
} from "lucide-react";
import supabase, { supabaseHelpers } from "@/lib/supabase";
import { ImageUploader } from "./image-uploader";
import { TranslationFlowManager } from "./translation-flow-manager";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConsolidatedReviewModal } from "./consolidated-review-modal";
import Link from "next/link";

interface TranslationFormProps {
  series: Series[];
  onTranslate?: (data: TranslationInput) => Promise<TranslationResultType>;
}

const formSchema = z.object({
  seriesId: z.string().optional(),
  chapterId: z.string().optional(),
  text: z.string().min(1, "Text is required"),
  translation: z.string().optional(),
});

// Define an interface for the review workflow state
export function TranslationForm({ series, onTranslate }: TranslationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [glossaryUpdated, setGlossaryUpdated] = useState<boolean>(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [initialFormSetup, setInitialFormSetup] = useState(false);
  const [chapterMemory, setChapterMemory] = useState<string>("");
  const [enhancedQualityReport, setEnhancedQualityReport] =
    useState<EnhancedQualityReport | null>(null);
  const [chapterData, setChapterData] = useState<ChapterData>({
    pages: [],
    seriesId: null,
    chapterId: null,
    sourceLanguage: "Korean",
  });
  const searchParams = useSearchParams();
  const supabaseChannelRef = useRef<any>(null);
  const [translationResult, setTranslationResult] =
    useState<ExtendedTranslationResult | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [autoQualityCheckComplete, setAutoQualityCheckComplete] =
    useState(false);

  // Add state for the consolidated review workflow
  const [showConsolidatedReview, setShowConsolidatedReview] = useState(false);

  // Add new state for tracking the quality apply process
  const [isApplyingQuality, setIsApplyingQuality] = useState(false);

  // Add new state to control when results should be displayed
  const [isApplyQualityComplete, setIsApplyQualityComplete] = useState(false);

  // Add state for editing translation results
  const [isEditingTranslation, setIsEditingTranslation] = useState(false);
  const [editableTranslation, setEditableTranslation] = useState("");
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);

  // Add new state for tracking retry attempts
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [maxRetries] = useState(3);
  const [isRetrying, setIsRetrying] = useState(false);

  // Add state for chapter glossary
  const [chapterGlossary, setChapterGlossary] = useState<
    DatabaseGlossaryEntry[]
  >([]);

  // Add new state for tracking failure state
  const [hasFailed, setHasFailed] = useState(false);

  // Get URL parameters
  const urlSeriesId = searchParams?.get("series") || "";
  const urlChapter = searchParams?.get("chapter") || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      seriesId: urlSeriesId || "",
      chapterId: urlChapter || "",
      text: "",
      translation: "",
    },
  });

  const selectedSeriesId = form.watch("seriesId");
  const selectedSeries = series.find((s) => s.id === selectedSeriesId);
  const sourceLanguage = selectedSeries?.source_language || "Korean";

  // Helper function to sort chapters numerically (same as in chapters page)
  const sortChaptersNumerically = (chapters: Chapter[]) => {
    return chapters.sort((a, b) => {
      // Extract numeric part from chapter number for comparison
      const aNum = parseFloat(a.chapter_number) || 0;
      const bNum = parseFloat(b.chapter_number) || 0;
      return aNum - bNum;
    });
  };

  // Handle initial setup with URL parameters
  useEffect(() => {
    if (!initialFormSetup && urlSeriesId && series.length > 0) {
      const seriesExists = series.some((s) => s.id === urlSeriesId);
      if (seriesExists) {
        form.setValue("seriesId", urlSeriesId);
        setInitialFormSetup(true);
      }
    }
  }, [urlSeriesId, urlChapter, series, form, initialFormSetup]);

  // Fetch chapters when series is selected
  useEffect(() => {
    if (selectedSeriesId) {
      const fetchChapters = async () => {
        setIsLoadingChapters(true);
        try {
          const data = await supabaseHelpers.getChaptersBySeriesId(
            selectedSeriesId
          );
          // Sort chapters numerically before setting state
          const sortedChapters = sortChaptersNumerically(data);
          setChapters(sortedChapters);

          if (urlChapter && initialFormSetup && !form.getValues("chapterId")) {
            const chapterExists = sortedChapters.some(
              (c) => c.id === urlChapter
            );
            if (chapterExists) {
              form.setValue("chapterId", urlChapter);
            }
          }
        } catch (error) {
          console.error("Error fetching chapters:", error);
          toast.error("Failed to load chapters");
        } finally {
          setIsLoadingChapters(false);
        }
      };

      fetchChapters();

      if (!initialFormSetup) {
        form.setValue("chapterId", "");
      }
    } else {
      setChapters([]);
    }
  }, [selectedSeriesId, form, urlChapter, initialFormSetup]);

  // Set up and clean up the Supabase channel subscription
  useEffect(() => {
    const channel = supabase.channel("custom-update-channel");
    channel
      .on("broadcast", { event: "glossary-updated" }, (payload) => {
        console.log("📣 Received glossary update broadcast:", payload);
        setGlossaryUpdated(true);
        toast.success("New terms added to glossary");
      })
      .subscribe((status) => {
        console.log(`📡 Supabase channel status: ${status}`);
      });

    supabaseChannelRef.current = channel;

    return () => {
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.unsubscribe();
      }
    };
  }, []);

  // Add new state for tracking image processing
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [processedImageCount, setProcessedImageCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  // Update handleImageProcessed to track progress
  const handleImageProcessed = (imagePageData: {
    pageNumber: number;
    extractedText: string;
    overview: string;
  }) => {
    setProcessedImageCount((prev) => prev + 1);

    // Convert image page data to full PageData format
    const pageData: PageData = {
      pageNumber: imagePageData.pageNumber,
      extractedText: imagePageData.extractedText,
      translatedText: "", // Will be filled during translation
      glossary: {}, // Will be filled during translation
      overview: imagePageData.overview,
    };

    // Add new page data to the existing pages
    setChapterData((prev) => {
      const newPages = [...prev.pages, pageData];
      // Sort pages by page number
      newPages.sort((a, b) => a.pageNumber - b.pageNumber);

      // Update the form with all extracted text with proper spacing
      const combinedText = newPages
        .map((page) => {
          // Add proper spacing to extracted text if needed
          let formattedExtractedText = page.extractedText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n\n");

          // Format page with header and footer
          return `=== Page ${page.pageNumber} ===\n\n${formattedExtractedText}\n\n=== End Page ${page.pageNumber} ===`;
        })
        .join("\n\n\n\n"); // Add triple newlines between pages

      setExtractedText(combinedText);
      form.setValue("text", combinedText);

      return {
        ...prev,
        pages: newPages,
      };
    });
  };

  // Update effect to trigger translation when all images are processed
  useEffect(() => {
    console.log("🔄 State changed:", {
      isProcessingComplete,
      processedImageCount,
      totalImages,
      isProcessingImages,
    });

    const triggerTranslation = async () => {
      if (
        isProcessingComplete &&
        processedImageCount > 0 &&
        processedImageCount === totalImages &&
        !isProcessingImages
      ) {
        console.log("🚀 Auto-triggering translation");
        try {
          setIsLoading(true);
          await processChapterTranslation();
        } catch (error) {
          console.error("Error in auto-translation:", error);
          toast.error("Failed to automatically translate text");
        } finally {
          setIsLoading(false);
        }
      }
    };

    triggerTranslation();
  }, [
    isProcessingComplete,
    processedImageCount,
    totalImages,
    isProcessingImages,
  ]);

  // Update handleLoadingChange to properly track completion
  const handleLoadingChange = (loading: boolean, total: number) => {
    console.log("📊 Loading change:", { loading, total });
    setIsProcessingImages(loading);

    if (total > 0) {
      setTotalImages(total);
    }

    if (!loading) {
      console.log(
        "✅ Processing complete, setting isProcessingComplete to true"
      );
      setIsProcessingComplete(true);
    } else {
      setIsProcessingComplete(false);
      setProcessedImageCount(0);
    }
  };

  const processChapterTranslation = async () => {
    // Reset auto quality check flag when starting a new translation
    setAutoQualityCheckComplete(false);
    setIsApplyQualityComplete(false);
    // Reset edit state when starting new translation
    setIsEditingTranslation(false);
    setEditableTranslation("");
    // Reset retry state
    setRetryAttempts(0);
    setIsRetrying(false);

    await processTranslationWithRetry();
  };

  const processTranslationWithRetry = async (
    attempt: number = 0
  ): Promise<void> => {
    setIsLoading(true);
    setIsCheckingQuality(true);

    if (attempt > 0) {
      setIsRetrying(true);
      setRetryAttempts(attempt);
      toast.info(`Retrying translation (attempt ${attempt}/${maxRetries})...`);
    }
    // Reset failure state on new attempt
    if (attempt === 0) setHasFailed(false);

    // Get the current text value
    const currentText = extractedText || form.getValues("text");

    if (!currentText || !currentText.trim()) {
      toast.error("No text available to translate");
      setIsLoading(false);
      setIsCheckingQuality(false);
      setIsRetrying(false);
      return;
    }

    // Ensure we have series and chapter information
    const currentSeriesId = selectedSeriesId || form.getValues("seriesId");
    const currentChapterId = form.getValues("chapterId");

    if (!currentSeriesId || !currentChapterId) {
      toast.error("Please select both series and chapter");
      setIsLoading(false);
      setIsCheckingQuality(false);
      setIsRetrying(false);
      return;
    }

    // If we don't have page data but have extracted text, create it
    if (chapterData.pages.length === 0 && currentText.trim()) {
      console.log("🔄 Creating page data from extracted text");

      // Split text by page markers if they exist, otherwise treat as single page
      const pageMarkers = currentText.split(/=== Page \d+ ===/);
      const pages: PageData[] = [];

      if (pageMarkers.length > 1) {
        // Text has page markers, split accordingly
        for (let i = 1; i < pageMarkers.length; i++) {
          pages.push({
            pageNumber: i,
            extractedText: pageMarkers[i].trim(),
            translatedText: "",
            glossary: {},
            overview: `Page ${i} from chapter`,
          });
        }
      } else {
        // No page markers, treat as single page
        pages.push({
          pageNumber: 1,
          extractedText: currentText.trim(),
          translatedText: "",
          glossary: {},
          overview: "Single page or manual text input",
        });
      }

      // Update chapter data
      setChapterData((prev) => ({
        ...prev,
        seriesId: currentSeriesId,
        chapterId: currentChapterId,
        sourceLanguage: selectedSeries?.source_language || "Korean",
        pages: pages,
      }));

      // Update the extracted text state to ensure consistency
      setExtractedText(currentText);

      // Update form value after state update to avoid render phase updates
      setTimeout(() => {
        form.setValue("text", currentText);
      }, 0);
    }

    // Update chapterData if not already set
    if (!chapterData.seriesId || !chapterData.chapterId) {
      setChapterData((prev) => ({
        ...prev,
        seriesId: currentSeriesId,
        chapterId: currentChapterId,
        sourceLanguage: selectedSeries?.source_language || "Korean",
      }));

      // Instead of recursive call, just return and let the effect handle it
      console.log(
        "🔄 Chapter data updated, translation will be triggered by effect"
      );
      return;
    }

    console.log(
      `🔄 Starting translation attempt ${attempt + 1}/${maxRetries + 1}`
    );

    try {
      // Show a loading toast
      if (attempt === 0) {
        toast.info("Analyzing and checking Quality for Improvements...");
      }

      // Use current pages or create from text if needed
      const pagesToProcess =
        chapterData.pages.length > 0
          ? chapterData.pages.map((page) => ({
              pageNumber: page.pageNumber,
              extractedText: page.extractedText,
              overview: page.overview,
            }))
          : [
              {
                pageNumber: 1,
                extractedText: currentText.trim(),
                overview: "Manual or loaded text",
              },
            ];

      // Create translation flow manager
      const flowManager = new TranslationFlowManager(
        currentSeriesId,
        currentChapterId,
        pagesToProcess,
        selectedSeries!
      );

      // Process translation and quality check
      const translationResult = await flowManager.processTranslation();

      console.log("🔍 Translation result received:", {
        hasText: !!translationResult.text,
        hasFullText: !!translationResult.fullText,
        hasRawResponse: !!translationResult.rawResponse,
        textLength: translationResult.text?.length || 0,
        fullTextLength: translationResult.fullText?.length || 0,
        rawResponseLength: translationResult.rawResponse?.length || 0,
      });

      // Extract the translated text from the API response
      // Try multiple sources to ensure we get the translation
      const translatedText =
        translationResult.fullText ||
        translationResult.text ||
        translationResult.rawResponse ||
        "";

      if (!translatedText || translatedText.trim() === "") {
        console.error(
          "❌ No translated text found in API response:",
          translationResult
        );
        throw new Error("Translation API returned empty result");
      }

      console.log("✅ Successfully extracted translated text:", {
        length: translatedText.length,
        preview: translatedText.substring(0, 100) + "...",
      });

      // IMMEDIATELY set the translated text in the form field
      form.setValue("translation", translatedText);

      // Update the state
      setTranslationResult({
        ...translationResult,
        text: translatedText,
        fullText: translatedText,
        rawResponse: translatedText,
      });

      setChapterMemory(translationResult.qualityReport.chapterMemory);

      // Prepare the enhanced quality report
      const enhancedReport: EnhancedQualityReport = {
        issues: translationResult.qualityReport.issues,
        suggestions: translationResult.qualityReport.suggestions,
        culturalNotes: translationResult.qualityReport.culturalNotes,
        formattingReport: translationResult.formattingReport,
        readabilityScore: translationResult.readabilityScore,
        glossarySuggestions:
          translationResult.qualityReport.glossarySuggestions,
        chapterMemory: translationResult.qualityReport.chapterMemory,
      };

      console.log("🔍 Enhanced quality report prepared:", {
        hasIssues: enhancedReport.issues?.length > 0,
        hasSuggestions: enhancedReport.suggestions?.length > 0,
        hasGlossarySuggestions:
          (enhancedReport.glossarySuggestions?.length || 0) > 0,
        glossarySuggestionsCount:
          enhancedReport.glossarySuggestions?.length || 0,
        glossarySuggestionsData: enhancedReport.glossarySuggestions,
      });

      // Store the enhanced quality report in state
      setEnhancedQualityReport(enhancedReport);
      setAutoQualityCheckComplete(true);

      // Begin review workflow if there are suggestions or glossary terms
      if (
        enhancedReport.suggestions.length > 0 ||
        (enhancedReport.glossarySuggestions &&
          enhancedReport.glossarySuggestions.length > 0)
      ) {
        // Show the consolidated review modal
        setShowConsolidatedReview(true);
      } else {
        // No suggestions or glossary terms, go directly to final translation
        setIsApplyQualityComplete(true);
        await handleSaveFinalTranslation([], [], []);
      }

      // Reset retry state on success
      setRetryAttempts(0);
      setIsRetrying(false);

      if (attempt > 0) {
        toast.success(`Translation succeeded on attempt ${attempt + 1}!`);
      } else {
        toast.success(
          "Quality analysis complete! Please review the suggestions."
        );
      }
    } catch (error) {
      console.error(`Translation attempt ${attempt + 1} failed:`, error);

      // Check if we should retry
      if (attempt < maxRetries) {
        console.log(
          `🔄 Retrying translation (${attempt + 1}/${maxRetries})...`
        );

        // Calculate exponential backoff delay (1s, 2s, 4s)
        const delay = Math.pow(2, attempt) * 1000;

        toast.error(
          `Translation failed. Retrying in ${delay / 1000} seconds...`
        );

        // Wait before retrying with exponential backoff
        setTimeout(() => {
          processTranslationWithRetry(attempt + 1);
        }, delay);
      } else {
        // All retries failed
        setIsRetrying(false);
        setHasFailed(true);
        toast.error("All retry attempts failed. Please try again manually.");
      }
    } finally {
      // Only set loading states to false if we're not retrying
      if (attempt >= maxRetries) {
        setIsLoading(false);
        setIsCheckingQuality(false);
        setIsRetrying(false);
      }
    }
  };

  // Update chapter data when series or chapter changes
  useEffect(() => {
    const selectedSeries = series.find((s) => s.id === selectedSeriesId);
    const currentChapterId = form.getValues("chapterId");
    setChapterData((prev) => ({
      ...prev,
      seriesId: selectedSeriesId || null,
      chapterId: currentChapterId || null,
      sourceLanguage: selectedSeries?.source_language || "Korean",
    }));
  }, [selectedSeriesId, series]);

  // Auto-load chapter data when URL parameters are set
  useEffect(() => {
    const currentChapterId = form.getValues("chapterId");
    if (currentChapterId && chapters.length > 0 && !currentChapter) {
      const chapter = chapters.find((c) => c.id === currentChapterId);
      if (chapter) {
        loadChapterData(currentChapterId);
        loadTranslationHistory(currentChapterId);
      }
    }
  }, [chapters, currentChapter]);

  const getTranslationText = (): string => {
    // Get translation text with comprehensive fallbacks
    return (
      form.getValues("translation") ||
      translationResult?.fullText ||
      translationResult?.text ||
      translationResult?.rawResponse ||
      currentChapter?.translated_text ||
      ""
    );
  };

  const formatPagesWithHeaders = (pageTexts: string[]): string => {
    if (!pageTexts || pageTexts.length === 0) {
      return "";
    }

    return pageTexts
      .map((text, index) => {
        const pageNumber = index + 1;
        const trimmedText = text.trim();

        if (!trimmedText) {
          return `=== Page ${pageNumber} ===\n\n`;
        }

        return `=== Page ${pageNumber} ===\n\n${trimmedText}`;
      })
      .join("\n\n");
  };

  const formatImagesAsPages = (
    images: Array<{ id: string; name: string; order: number }>
  ): string => {
    if (!images || images.length === 0) {
      return "";
    }

    // Sort images by order to ensure correct sequence
    const sortedImages = [...images].sort((a, b) => a.order - b.order);

    const imagePages = sortedImages.map(
      (image, index) => `[Image: ${image.name} - ${image.id}]`
    );

    return formatPagesWithHeaders(imagePages);
  };

  // Format Extracted Text with Page Headers
  const formatExtractedTextWithPages = (extractedText: string): string => {
    if (!extractedText || extractedText.trim() === "") {
      return "";
    }

    // If the text already has page headers, return it as is
    if (extractedText.includes("=== Page ")) {
      return extractedText;
    }

    // If we have chapterData with pages, use that to split into multiple pages
    if (chapterData.pages && chapterData.pages.length > 0) {
      const pageTexts = chapterData.pages
        .filter((page) => page.extractedText && page.extractedText.trim())
        .map((page) => page.extractedText.trim());

      return formatPagesWithHeaders(pageTexts);
    }

    // Otherwise, treat the entire extracted text as a single page
    return `=== Page 1 ===\n\n${extractedText.trim()}`;
  };

  // Clean and Format Multi-Page Translation
  const cleanMultiPageTranslation = (translationText: string): string => {
    if (!translationText || translationText.trim() === "") {
      return "";
    }

    // Split by page headers
    const pages = translationText
      .split(/=== Page \d+ ===/)
      .filter((page) => page.trim());

    // Clean each page and remove duplicates
    const cleanedPages = pages.map((page, index) => {
      const pageNumber = index + 1;
      const cleanedContent = page
        .trim()
        .replace(/\n{3,}/g, "\n\n") // Remove excessive newlines
        .replace(/^\s+|\s+$/g, ""); // Trim whitespace

      return `=== Page ${pageNumber} ===\n\n${cleanedContent}`;
    });

    // Remove duplicate pages by comparing content
    const uniquePages = cleanedPages.filter((page, index, array) => {
      const content = page.replace(/=== Page \d+ ===\n\n/, "");
      return (
        array.findIndex(
          (p) => p.replace(/=== Page \d+ ===\n\n/, "") === content
        ) === index
      );
    });

    return uniquePages.join("\n\n");
  };

  // Split Single Page Text into Multiple Pages
  const splitTextIntoPages = (
    text: string,
    pagesCount: number = 10
  ): string => {
    if (!text || text.trim() === "") {
      return "";
    }

    // Remove existing page headers if present
    const cleanText = text.replace(/=== Page \d+ ===\n\n/g, "").trim();

    // Split text into lines
    const lines = cleanText.split("\n").filter((line) => line.trim());

    // Calculate lines per page (for 10 images/pages)
    const linesPerPage = Math.ceil(lines.length / pagesCount);

    // Split into pages - one page per image
    const pages: string[] = [];
    for (let i = 0; i < pagesCount; i++) {
      const startIndex = i * linesPerPage;
      const endIndex = Math.min(startIndex + linesPerPage, lines.length);
      const pageLines = lines.slice(startIndex, endIndex);

      if (pageLines.length > 0) {
        const pageContent = pageLines.join("\n\n");
        pages.push(`=== Page ${i + 1} ===\n\n${pageContent}`);
      } else {
        // Even if no content, create empty page to show all page numbers
        pages.push(`=== Page ${i + 1} ===\n\n[No content for this page]`);
      }
    }

    return pages.join("\n\n");
  };

  const copyToClipboard = () => {
    const translation = getTranslationText();
    navigator.clipboard.writeText(translation);
    toast.success("Copied to clipboard");
  };

  const downloadTranslation = () => {
    const translation = getTranslationText();
    const element = document.createElement("a");
    const file = new Blob([translation], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `translation_${
      form.getValues("chapterId") || new Date().toISOString().slice(0, 10)
    }.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Add function to load chapter data
  const loadChapterData = async (chapterId: string) => {
    try {
      const { data, error } = await supabase
        .from("chapters")
        .select(
          `
          id,
          series_id,
          chapter_number,
          title,
          summary,
          memory_summary,
          created_by,
          extracted_text,
          translated_text,
          created_at,
          updated_at
        `
        )
        .eq("id", chapterId)
        .single();

      if (error) throw error;

      if (data) {
        const chapterData = data as unknown as Chapter;
        setCurrentChapter(chapterData);

        // Set both extracted and translated text if they exist
        if (chapterData.extracted_text) {
          setExtractedText(chapterData.extracted_text);
          form.setValue("text", chapterData.extracted_text);
        }
        if (chapterData.translated_text) {
          console.log("📚 Loading existing translation:", {
            hasTranslatedText: !!chapterData.translated_text,
            translatedTextLength: chapterData.translated_text.length,
            translatedTextPreview:
              chapterData.translated_text.substring(0, 100) + "...",
          });

          form.setValue("translation", chapterData.translated_text);
          // Also set the translation result to show the UI
          setTranslationResult({
            text: chapterData.translated_text,
            fullText: chapterData.translated_text,
            rawResponse: chapterData.translated_text,
            qualityReport: {
              issues: [],
              suggestions: [],
              culturalNotes: [],
              glossarySuggestions: [],
              chapterMemory: "",
              chapterSummary: "",
            },
            glossary: {},
            chapterMemory: "",
          });
          // Allow showing existing translations immediately
          setIsApplyQualityComplete(true);
        }

        // Update chapterData state
        setChapterData((prev) => ({
          ...prev,
          seriesId: chapterData.series_id,
          chapterId: chapterData.id,
          sourceLanguage: selectedSeries?.source_language || "Korean",
        }));
      }
    } catch (error) {
      console.error("Error loading chapter data:", error);
      toast.error("Failed to load chapter data");
    }
  };

  // Add function to save chapter data
  const saveChapterData = useCallback(async () => {
    if (!currentChapter?.id) return;

    try {
      console.log("💾 Saving chapter data with memory:", {
        chapterId: currentChapter.id,
        hasExtractedText: !!extractedText,
        hasTranslation: !!form.getValues("translation"),
        chapterMemoryLength: chapterMemory.length,
        chapterMemoryPreview: chapterMemory.substring(0, 50) + "...",
      });

      // Use the supabase helper to save chapter data
      const success = await supabaseHelpers.saveChapterData(currentChapter.id, {
        extractedText: extractedText,
        translatedText: form.getValues("translation"),
        chapterMemory: chapterMemory,
      });

      if (!success) {
        throw new Error("Failed to save chapter data");
      }

      // Fetch the updated data to verify it was saved and update state
      const updatedChapter = await supabaseHelpers.getChapter(
        currentChapter.id
      );
      if (updatedChapter) {
        setCurrentChapter(updatedChapter);
        console.log("✅ Chapter data saved and verified:", {
          memory_summary:
            updatedChapter.memory_summary?.substring(0, 50) + "...",
          extracted_text_length: updatedChapter.extracted_text?.length || 0,
          translated_text_length: updatedChapter.translated_text?.length || 0,
        });
      }
    } catch (error) {
      console.error("Error saving chapter data:", error);
      toast.error("Failed to save chapter data");
    }
  }, [currentChapter?.id, extractedText, chapterMemory, form]);

  // Update the auto-save functionality to be more robust
  useEffect(() => {
    let saveTimeout: NodeJS.Timeout;

    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (
          currentChapter?.id &&
          (extractedText || form.getValues("translation") || chapterMemory)
        ) {
          console.log("🔄 Auto-saving chapter data including memory:", {
            chapterMemory: chapterMemory
              ? chapterMemory.substring(0, 50) + "..."
              : "empty",
            hasExtractedText: !!extractedText,
            hasTranslation: !!form.getValues("translation"),
          });
          saveChapterData();
        }
      }, 5000); // Auto-save after 5 seconds of inactivity
    };

    // Save when extracted text changes
    if (extractedText) {
      debouncedSave();
    }

    // Save when chapter memory changes
    if (chapterMemory) {
      debouncedSave();
    }

    // Save when translation changes
    const subscription = form.watch((value) => {
      if (value.translation) {
        debouncedSave();
      }
    });

    return () => {
      clearTimeout(saveTimeout);
      subscription.unsubscribe();
    };
  }, [extractedText, currentChapter?.id, chapterMemory, saveChapterData]);

  // Add a manual save button
  const handleManualSave = async () => {
    await saveChapterData();
  };

  // Add function to load translation history
  const loadTranslationHistory = async (chapterId: string) => {
    try {
      const history = await supabaseHelpers.getTranslationHistory(chapterId);

      if (history && history.length > 0) {
        // If we have translation history, show the most recent one
        const latestTranslation = history[0];
        console.log("📚 Found translation history:", latestTranslation);

        // Update the form with the historical translation
        if (latestTranslation.translated_text) {
          form.setValue("translation", latestTranslation.translated_text);
        }
        if (latestTranslation.source_text) {
          setExtractedText(latestTranslation.source_text);
          form.setValue("text", latestTranslation.source_text);
        }
      }
    } catch (error) {
      console.error("Error loading translation history:", error);
    }
  };

  // Update chapter selection handler to also load translation history
  const handleChapterChange = async (chapterId: string) => {
    // Reset the apply quality complete state when changing chapters
    setIsApplyQualityComplete(false);
    // Reset edit state when changing chapters
    setIsEditingTranslation(false);
    setEditableTranslation("");

    form.setValue("chapterId", chapterId);
    const selectedChapter = chapters.find((c) => c.id === chapterId);
    if (selectedChapter) {
      await loadChapterData(selectedChapter.id);
      await loadTranslationHistory(selectedChapter.id);
    }
  };
  console.log("translationResult", translationResult);
  // Update the quality check function to follow the workflow
  const checkTranslationQuality = async (
    showToasts = true,
    skipLoadingState = false
  ) => {
    if (!translationResult) {
      if (showToasts) toast.error("No translation available to check");
      return;
    }

    try {
      if (!skipLoadingState) {
        setIsCheckingQuality(true);
      }

      if (showToasts) {
        toast.info("Analyzing and checking Quality for Improvements...");
      }

      const qualityResponse = await fetch("/api/quality-checker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalText: extractedText,
          translatedText: form.getValues("translation"),
          glossary: translationResult.glossary,
          series: selectedSeries,
          rawResponse: translationResult.rawResponse,
        }),
      });

      if (!qualityResponse.ok) {
        throw new Error("Quality check failed");
      }

      const result = await qualityResponse.json();
      console.log("✨ Quality check result:", result);
      setChapterMemory(result.qualityReport?.chapterMemory || "");
      // Initialize the quality report with all required fields
      const qualityReport: QualityReport = {
        issues: result.qualityReport?.issues || [],
        suggestions: result.qualityReport?.suggestions || [],
        culturalNotes: result.qualityReport?.culturalNotes || [],
        glossarySuggestions: result.qualityReport?.glossarySuggestions || [],
        chapterMemory: result.qualityReport?.chapterMemory || "",
        chapterSummary: result.qualityReport?.chapterSummary || "",
      };

      // Store the translation result with updated quality report
      setTranslationResult({
        ...translationResult,
        qualityReport,
        formattingReport: result.formattingReport,
        readabilityScore: result.readabilityScore,
      });

      // Update the chapter memory using the helper
      if (chapterData.chapterId) {
        await supabaseHelpers.saveChapterData(chapterData.chapterId, {
          chapterMemory: result.qualityReport?.chapterMemory || "",
        });
      }

      setAutoQualityCheckComplete(true);

      if (qualityReport.glossarySuggestions.length > 0) {
        // Show the consolidated review modal for glossary terms
        setShowConsolidatedReview(true);

        if (showToasts) {
          toast.success(
            "Quality analysis complete! Please review the glossary terms."
          );
        }
      } else {
        console.log(
          "🔄 No glossary terms, directly applying quality improvements..."
        );
        await handleSaveFinalTranslation([], [], []);
      }
    } catch (error) {
      console.error("Quality check error:", error);
      if (showToasts) toast.error("Failed to check quality");
      throw error;
    } finally {
      if (!skipLoadingState) {
        setIsCheckingQuality(false);
      }
    }
  };

  // Handle completing the consolidated review
  const handleConsolidatedReviewComplete = async (
    approvedSuggestions: string[],
    rejectedSuggestions: string[],
    approvedGlossaryTerms: DatabaseGlossaryEntry[],
    editedChapterMemory: string,
    hasGlossaryModifications: boolean
  ) => {
    // Update chapter memory
    setChapterMemory(editedChapterMemory);

    // Close the modal first
    setShowConsolidatedReview(false);

    // If there are glossary modifications, we need to regenerate translation and memory
    if (hasGlossaryModifications) {
      toast.info(
        "Regenerating translation and memory based on modified glossary terms..."
      );

      try {
        setIsLoading(true);
        setIsApplyingQuality(true);

        // Create translation flow manager
        const flowManager = new TranslationFlowManager(
          chapterData.seriesId!,
          chapterData.chapterId!,
          chapterData.pages.map((page) => ({
            pageNumber: page.pageNumber,
            extractedText: page.extractedText,
            overview: page.overview,
          })),
          selectedSeries!
        );

        // First, save the approved glossary terms to the database
        if (approvedGlossaryTerms.length > 0) {
          await saveGlossaryTerms(approvedGlossaryTerms);
          toast.success(
            `${approvedGlossaryTerms.length} glossary terms saved to database`
          );
        }

        // Regenerate translation with updated glossary by re-processing the entire translation
        const { finalText, updatedMemory } =
          await flowManager.completeTranslationWorkflow(
            approvedSuggestions,
            rejectedSuggestions,
            approvedGlossaryTerms,
            editedChapterMemory
          );

        console.log("🔍 Regenerated translation received:", {
          hasFinalText: !!finalText,
          finalTextLength: finalText?.length || 0,
          finalTextPreview: finalText?.substring(0, 100) + "...",
        });

        // Ensure we have valid regenerated translation text
        if (!finalText || finalText.trim() === "") {
          console.error("❌ No final text received from regeneration workflow");
          throw new Error("Regeneration workflow returned empty result");
        }

        // Update the UI with the regenerated translation
        form.setValue("translation", finalText);
        setChapterMemory(updatedMemory);

        // Update the current chapter data
        if (currentChapter?.id) {
          const updatedChapter = await supabaseHelpers.getChapter(
            currentChapter.id
          );
          if (updatedChapter) {
            setCurrentChapter(updatedChapter);
          }
        }

        toast.success(
          "Translation and memory regenerated successfully with updated glossary terms!"
        );
        setIsApplyQualityComplete(true);
      } catch (error) {
        console.error("Error regenerating with glossary modifications:", error);
        toast.error("Failed to regenerate translation with modified glossary");
      } finally {
        setIsLoading(false);
        setIsApplyingQuality(false);
      }
    } else {
      // No glossary modifications, proceed with normal flow
      await handleSaveFinalTranslation(
        approvedGlossaryTerms,
        approvedSuggestions,
        rejectedSuggestions
      );
    }
  };

  // Handle cancelling the review workflow
  const handleCancelReview = () => {
    setShowConsolidatedReview(false);
  };

  // Handle saving the final translation using the flow manager
  const handleSaveFinalTranslation = async (
    approvedGlossaryTerms: DatabaseGlossaryEntry[] = [],
    approvedSuggestions: string[] = [],
    rejectedSuggestions: string[] = []
  ) => {
    if (!chapterData.seriesId || !chapterData.chapterId) {
      toast.error("Missing series or chapter information");
      return;
    }

    try {
      setIsLoading(true);
      setIsApplyingQuality(true);

      // Show the "Applying Quality" message
      toast.info("Applying Quality to the Translations...");

      // Get the current extracted text from the form or state
      const currentExtractedText =
        form.getValues("text") || extractedText || "";

      console.log("🔍 Debugging TranslationFlowManager creation:", {
        hasChapterDataPages: !!chapterData.pages,
        chapterDataPagesLength: chapterData.pages.length,
        hasCurrentExtractedText: !!currentExtractedText,
        currentExtractedTextLength: currentExtractedText.length,
        extractedTextFromState: !!extractedText,
        extractedTextFromStateLength: extractedText?.length || 0,
      });

      // Ensure we have pages with extracted text
      let pagesToUse = chapterData.pages;

      // If no pages or empty extracted text, create from current text
      if (
        pagesToUse.length === 0 ||
        !pagesToUse.some((page) => page.extractedText?.trim())
      ) {
        console.log("🔄 Creating pages from current extracted text");

        if (currentExtractedText.trim()) {
          // Split text by page markers if they exist, otherwise treat as single page
          const pageMarkers = currentExtractedText.split(/=== Page \d+ ===/);

          if (pageMarkers.length > 1) {
            // Text has page markers, split accordingly
            pagesToUse = pageMarkers.slice(1).map((text, index) => ({
              pageNumber: index + 1,
              extractedText: text.trim(),
              translatedText: "", // Will be filled during translation
              glossary: {}, // Will be filled during translation
              overview: `Page ${index + 1} from chapter`,
            }));
          } else {
            // No page markers, treat as single page
            pagesToUse = [
              {
                pageNumber: 1,
                extractedText: currentExtractedText.trim(),
                translatedText: "", // Will be filled during translation
                glossary: {}, // Will be filled during translation
                overview: "Single page or manual text input",
              },
            ];
          }
        } else {
          // Fallback: try to get from current chapter
          const chapterText = currentChapter?.extracted_text || "";
          if (chapterText.trim()) {
            pagesToUse = [
              {
                pageNumber: 1,
                extractedText: chapterText.trim(),
                translatedText: "", // Will be filled during translation
                glossary: {}, // Will be filled during translation
                overview: "Chapter extracted text",
              },
            ];
          } else {
            throw new Error(
              "No extracted text available for quality improvements"
            );
          }
        }
      }

      console.log("✅ Final pages for TranslationFlowManager:", {
        pagesCount: pagesToUse.length,
        pagesWithText: pagesToUse.filter((p) => p.extractedText?.trim()).length,
        totalTextLength: pagesToUse.reduce(
          (sum, p) => sum + (p.extractedText?.length || 0),
          0
        ),
      });

      // Create translation flow manager
      const flowManager = new TranslationFlowManager(
        chapterData.seriesId,
        chapterData.chapterId,
        pagesToUse,
        selectedSeries!
      );

      // Complete the translation workflow
      const { finalText, updatedMemory } =
        await flowManager.completeTranslationWorkflow(
          approvedSuggestions,
          rejectedSuggestions,
          approvedGlossaryTerms,
          chapterMemory
        );

      console.log("🔍 Final translation received:", {
        hasFinalText: !!finalText,
        finalTextLength: finalText?.length || 0,
        finalTextPreview: finalText?.substring(0, 100) + "...",
      });

      // Ensure we have valid translation text
      if (!finalText || finalText.trim() === "") {
        console.error("❌ No final text received from apply-quality workflow");
        throw new Error("Apply-quality workflow returned empty result");
      }

      // Update the UI with the final translation
      form.setValue("translation", finalText);

      // Update translation result state to show in UI
      setTranslationResult({
        text: finalText,
        fullText: finalText,
        rawResponse: finalText,
        qualityReport: {
          issues: [],
          suggestions: [],
          culturalNotes: [],
          glossarySuggestions: [],
          chapterMemory: updatedMemory,
          chapterSummary: "",
        },
        glossary: {},
        chapterMemory: updatedMemory,
      });

      // Update the current chapter data
      if (currentChapter?.id) {
        const updatedChapter = await supabaseHelpers.getChapter(
          currentChapter.id
        );
        if (updatedChapter) {
          setCurrentChapter(updatedChapter);
        }
      }

      // Reset the review workflow (consolidated modal should already be closed)
      setShowConsolidatedReview(false);

      // Set this to true only after apply-quality API completes successfully
      setIsApplyQualityComplete(true);
    } catch (error) {
      console.error("Error saving final translation:", error);
      toast.error("Failed to apply quality improvements to translation");
    } finally {
      setIsLoading(false);
      setIsApplyingQuality(false);
    }
  };

  // Add useEffect to load glossary when chapter changes
  useEffect(() => {
    const loadGlossary = async () => {
      console.log("🔄 Loading glossary for series:", currentChapter?.series_id);
      if (currentChapter?.series_id) {
        try {
          const { data: glossaryData, error } = await supabase
            .from("glossaries")
            .select("*")
            .eq("series_id", currentChapter.series_id)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("❌ Error loading glossary:", error);
            throw error;
          }

          console.log("✅ Glossary data loaded:", {
            count: glossaryData?.length || 0,
            data: glossaryData,
          });

          setChapterGlossary(glossaryData || []);
        } catch (error) {
          console.error("❌ Error loading glossary:", error);
        }
      } else {
        console.log("⚠️ No series_id available for glossary loading");
      }
    };

    loadGlossary();
  }, [currentChapter?.series_id]);

  // Update the glossary saving code in handleSaveFinalTranslation
  const saveGlossaryTerms = async (terms: DatabaseGlossaryEntry[]) => {
    if (terms.length === 0) return;

    const glossaryPromises = terms.map(async (entry) => {
      if (!entry.source_term || !entry.translated_term) return;

      return supabase
        .from("glossaries")
        .insert({
          series_id: chapterData.seriesId,
          source_term: entry.source_term,
          translated_term: entry.translated_term,
          gender: ["Male", "Female", "Unknown"].includes(entry.gender ?? "")
            ? (entry.gender as Gender)
            : undefined,
          role: [
            "Protagonist",
            "Antagonist",
            "Supporting",
            "Minor",
            "Mentor",
            "Family",
            "Other",
          ].includes(entry.role ?? "")
            ? (entry.role as Role)
            : undefined,
          term_type: entry.term_type ?? null,
          notes: entry.notes ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
    });

    await Promise.all(glossaryPromises);
    console.log(`✅ ${terms.length} glossary terms saved`);
  };

  // Handle entering edit mode for translation
  const handleEditTranslation = () => {
    const currentTranslation =
      form.getValues("translation") || translationResult?.text || "";
    setEditableTranslation(currentTranslation);
    setIsEditingTranslation(true);
  };

  // Handle saving edited translation
  const handleSaveEditedTranslation = async () => {
    if (!currentChapter?.id) {
      toast.error("No chapter selected");
      return;
    }

    try {
      setIsSavingTranslation(true);

      // Update the form value
      form.setValue("translation", editableTranslation);

      // Update translation result state
      if (translationResult) {
        setTranslationResult({
          ...translationResult,
          text: editableTranslation,
          fullText: editableTranslation,
          rawResponse: editableTranslation,
        });
      }

      // Save to database
      const success = await supabaseHelpers.saveChapterData(currentChapter.id, {
        extractedText: extractedText,
        translatedText: editableTranslation,
        chapterMemory: chapterMemory,
      });

      if (success) {
        // Update current chapter state
        const updatedChapter = await supabaseHelpers.getChapter(
          currentChapter.id
        );
        if (updatedChapter) {
          setCurrentChapter(updatedChapter);
        }

        toast.success("Translation saved successfully");
        setIsEditingTranslation(false);
      } else {
        toast.error("Failed to save translation");
      }
    } catch (error) {
      console.error("Error saving edited translation:", error);
      toast.error("Failed to save translation");
    } finally {
      setIsSavingTranslation(false);
    }
  };

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    setIsEditingTranslation(false);
    setEditableTranslation("");
  };

  // Handle continuing to next chapter
  const handleContinueTranslation = () => {
    if (!selectedSeriesId || !currentChapter) {
      toast.error("No series or chapter selected");
      return;
    }

    // Find current chapter index
    const currentIndex = chapters.findIndex((c) => c.id === currentChapter.id);

    if (currentIndex === -1) {
      toast.error("Current chapter not found");
      return;
    }

    // Check if there's a next chapter
    if (currentIndex >= chapters.length - 1) {
      toast.info("This is the last chapter in the series");
      return;
    }

    // Get next chapter
    const nextChapter = chapters[currentIndex + 1];

    // Navigate to next chapter
    const nextUrl = `/translate?series=${selectedSeriesId}&chapter=${nextChapter.id}`;
    window.location.href = nextUrl;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {selectedSeriesId && currentChapter && chapters.length > 0 && (
          <Button
            size="sm"
            onClick={handleContinueTranslation}
            disabled={
              chapters.findIndex((c) => c.id === currentChapter.id) >=
              chapters.length - 1
            }
            className="transition-colors duration-200"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Next Chapter
          </Button>
        )}
      </div>

      <Form {...form}>
        <form className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="seriesId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Series</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading || isProcessingImages}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a series" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {series.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chapterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chapter</FormLabel>
                  <Select
                    onValueChange={handleChapterChange}
                    defaultValue={field.value}
                    disabled={isLoading || isProcessingImages}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a chapter" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {chapters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          Chapter {c.chapter_number}
                          {c.title ? ` - ${c.title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Upload Images
                </h3>
                {extractedText && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setExtractedText("");
                      form.setValue("text", "");
                      setChapterData((prev) => ({ ...prev, pages: [] }));
                      setProcessedImageCount(0);
                      setTotalImages(0);
                      setIsProcessingComplete(false);
                      // Reset translation results when clearing text
                      setTranslationResult(null);
                      setIsApplyQualityComplete(false);
                      setChapterMemory("");
                    }}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  >
                    Clear Text
                  </Button>
                )}
              </div>
              {!selectedSeriesId ? (
                <Alert className="border-blue-100 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300">
                    Series Required
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    Please select a series to get started with image upload.
                  </AlertDescription>
                </Alert>
              ) : (
                <ImageUploader
                  onImageProcessed={handleImageProcessed}
                  onLoadingChange={handleLoadingChange}
                  sourceLanguage={sourceLanguage}
                />
              )}
            </div>

            <div className="space-y-4">
              {extractedText && (
                <>
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900 dark:text-gray-100">
                          Extracted Text
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={splitTextIntoPages(field.value, 10)}
                            className="min-h-[400px] font-mono bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400"
                            disabled={isLoading || isProcessingImages}
                            readOnly
                          />
                        </FormControl>
                        <FormMessage className="text-red-600 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <Button
                    variant="default"
                    type="button"
                    onClick={processChapterTranslation}
                    disabled={
                      isLoading ||
                      isProcessingImages ||
                      isCheckingQuality ||
                      isApplyingQuality ||
                      !extractedText.trim() ||
                      !selectedSeriesId ||
                      !form.getValues("chapterId")
                    }
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 dark:disabled:bg-gray-600"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          {isRetrying
                            ? `Retrying (${retryAttempts}/${maxRetries})...`
                            : isCheckingQuality
                            ? "Analyzing Quality..."
                            : isApplyingQuality
                            ? "Applying Quality..."
                            : "Translating..."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Start Translation
                      </>
                    )}
                  </Button>
                </>
              )}

              {/* Show message when no extracted text is available */}
              {!extractedText &&
                selectedSeriesId &&
                form.getValues("chapterId") && (
                  <div className="space-y-4">
                    <Alert className="border-yellow-100 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/20">
                      <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                        No Text Available
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                        {currentChapter?.extracted_text
                          ? "Loading chapter text..."
                          : "Upload images or add text manually to start translation."}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

              {/* Manual text input option */}
              {!extractedText &&
                selectedSeriesId &&
                form.getValues("chapterId") && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="text"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900 dark:text-gray-100">
                            Manual Text Input
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Paste or type your text here to translate manually..."
                              className="min-h-[300px] font-mono bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400"
                              disabled={isLoading || isProcessingImages}
                              onChange={(e) => {
                                field.onChange(e);
                                if (e.target.value.trim()) {
                                  setExtractedText(e.target.value);
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-gray-600 dark:text-gray-400">
                            Enter text manually to translate without uploading
                            images
                          </FormDescription>
                          <FormMessage className="text-red-600 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    {form.watch("text") && form.watch("text").trim() && (
                      <Button
                        variant="default"
                        type="button"
                        onClick={() => {
                          const textValue = form.getValues("text");
                          if (textValue.trim()) {
                            setExtractedText(textValue);
                            // Create minimal page data for manual text
                            setChapterData((prev) => ({
                              ...prev,
                              pages: [
                                {
                                  pageNumber: 1,
                                  extractedText: textValue,
                                  translatedText: "",
                                  glossary: {},
                                  overview: "Manual text input",
                                },
                              ],
                            }));
                            processChapterTranslation();
                          }
                        }}
                        disabled={
                          isLoading ||
                          isProcessingImages ||
                          isCheckingQuality ||
                          isApplyingQuality ||
                          !selectedSeriesId ||
                          !form.getValues("chapterId")
                        }
                        className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 dark:disabled:bg-gray-600"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              {isRetrying
                                ? `Retrying (${retryAttempts}/${maxRetries})...`
                                : isCheckingQuality
                                ? "Analyzing Quality..."
                                : isApplyingQuality
                                ? "Applying Quality..."
                                : "Translating..."}
                            </span>
                          </div>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Translate Manual Text
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
            </div>
          </div>
        </form>
      </Form>

      {/* Apply Quality Loading State */}
      {isApplyingQuality && !isApplyQualityComplete && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-hidden transition-colors duration-200">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
                <span>Applying Quality Improvements...</span>
              </h3>
            </div>
            <div className="p-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700">
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="space-y-2">
                    <p>
                      Processing your translation with approved improvements...
                    </p>
                    <p className="text-sm">This may take a few moments.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Translation Results Section */}
      {(translationResult || form.getValues("translation")) &&
        isApplyQualityComplete && (
          <div className="space-y-8">
            {/* Translation Header and Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-hidden transition-colors duration-200">
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>Translation Results</span>
                  {translationResult?.qualityReport && (
                    <span className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-full px-2 py-0.5 text-xs text-green-700 dark:text-green-300 flex items-center gap-1 transition-colors duration-200">
                      <Sparkles className="w-3 h-3" />
                      Quality Applied
                    </span>
                  )}
                </h3>
              </div>

              {/* Translation Content */}
              <div className="p-4">
                {isEditingTranslation ? (
                  // Editable mode
                  <div className="space-y-4">
                    <Textarea
                      value={editableTranslation}
                      onChange={(e) => setEditableTranslation(e.target.value)}
                      className="min-h-[400px] font-mono text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400"
                      placeholder="Edit your translation here..."
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEditedTranslation}
                        disabled={isSavingTranslation}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isSavingTranslation ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        disabled={isSavingTranslation}
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Read-only mode
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700 font-mono text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100 transition-colors duration-200">
                      {(() => {
                        // Get translation text with proper fallbacks
                        let translationText =
                          form.getValues("translation") ||
                          translationResult?.fullText ||
                          translationResult?.text ||
                          translationResult?.rawResponse ||
                          currentChapter?.translated_text ||
                          "";

                        if (!translationText || translationText.trim() === "") {
                          return (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <p>No translation available</p>
                              <p className="text-xs mt-2">
                                Try refreshing or re-running the translation
                              </p>
                            </div>
                          );
                        }

                        // Format to match Extracted Text output style
                        translationText =
                          cleanMultiPageTranslation(translationText);

                        return translationText;
                      })()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={handleEditTranslation}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-200"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Translation
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={copyToClipboard}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-200"
                      >
                        Copy to Clipboard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={downloadTranslation}
                        className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-200"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chapter Summary and Glossary Section */}
            {currentChapter && (
              <div className="space-y-8">
                {/* Chapter Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                  <div className="p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Chapter Summary
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {chapterMemory ||
                          currentChapter?.memory_summary ||
                          translationResult?.qualityReport?.chapterSummary ||
                          translationResult?.qualityReport?.chapterMemory ||
                          "No summary available"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chapter Glossary */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                  <div className="p-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center justify-between">
                      <span>Chapter Glossary</span>
                      <div>
                        <Link
                          href={`/series/${currentChapter.series_id}/glossary`}
                          className="mr-2"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Review Series Glossarys
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={async () => {
                            try {
                              const glossaryData =
                                await supabaseHelpers.getSeriesGlossary(
                                  currentChapter.series_id
                                );
                              setChapterGlossary(glossaryData);
                              toast.success("Glossary refreshed");
                            } catch (error) {
                              console.error("Error fetching glossary:", error);
                              toast.error("Failed to load glossary");
                            }
                          }}
                          className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Glossary
                        </Button>
                      </div>
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {chapterGlossary.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border dark:border-gray-700"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {entry.source_term}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                {entry.translated_term}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {entry.term_type && (
                                  <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                                    {entry.term_type}
                                  </span>
                                )}
                                {entry.gender && (
                                  <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                                    {entry.gender}
                                  </span>
                                )}
                                {entry.role && (
                                  <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">
                                    {entry.role}
                                  </span>
                                )}
                              </div>
                              {entry.notes && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                  {entry.notes}
                                </div>
                              )}
                            </div>
                            <Link
                              href={`/series/${currentChapter.series_id}/glossary/${entry.id}/edit`}
                              className="text-blue-500 dark:text-blue-400 hover:underline"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                            </Link>
                          </div>
                        </div>
                      ))}
                      {chapterGlossary.length === 0 && (
                        <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                          <div className="mb-2">
                            No glossary terms available
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            This could be due to:
                          </div>
                          <ul className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-left max-w-md mx-auto">
                            <li>
                              • No glossary terms have been added to this series
                            </li>
                            <li>• RLS policies are blocking access</li>
                            <li>
                              • User doesn't have permission to view this series
                            </li>
                            <li>• Database connection issues</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* Consolidated Review Modal */}
      <ConsolidatedReviewModal
        isOpen={showConsolidatedReview}
        onClose={handleCancelReview}
        suggestions={translationResult?.qualityReport?.suggestions || []}
        glossaryEntries={(() => {
          const rawGlossarySuggestions =
            translationResult?.qualityReport?.glossarySuggestions || [];
          return rawGlossarySuggestions.map((suggestion) => ({
            sourceTerm: suggestion.sourceTerm,
            translatedTerm: suggestion.translatedTerm,
            entityType: (suggestion.entityType || "Term") as EntityType,
            gender: suggestion.gender as Gender | undefined,
            role: suggestion.role as Role | undefined,
            notes: suggestion.notes ?? undefined,
          }));
        })()}
        chapterMemory={chapterMemory}
        onComplete={handleConsolidatedReviewComplete}
      />
    </div>
  );
}
