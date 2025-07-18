"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabaseHelpers } from "@/lib/supabase";
import {
  ExtendedTranslationResult,
  DatabaseGlossaryEntry,
  Series,
} from "@/types";

// Simple page data interface for the flow manager
interface SimplePageData {
  pageNumber: number;
  extractedText: string;
  overview: string;
}

interface TranslationFlowManagerProps {
  seriesId: string;
  chapterId: string;
  pages: SimplePageData[];
  selectedSeries: Series;
  onTranslationComplete: (result: ExtendedTranslationResult) => void;
  onError: (error: string) => void;
}

export class TranslationFlowManager {
  private seriesId: string;
  private chapterId: string;
  private pages: SimplePageData[];
  private selectedSeries: Series;

  constructor(
    seriesId: string,
    chapterId: string,
    pages: SimplePageData[],
    selectedSeries: Series
  ) {
    this.seriesId = seriesId;
    this.chapterId = chapterId;
    this.pages = pages;
    this.selectedSeries = selectedSeries;
  }

  // Combine all page texts into a single string
  getCombinedText(): string {
    return this.pages
      .map((page) => `=== Page ${page.pageNumber} ===\n\n${page.extractedText}`)
      .join("\n\n\n\n");
  }

  // Process translation and quality check
  async processTranslation(): Promise<ExtendedTranslationResult> {
    const combinedText = this.getCombinedText();

    console.log("🔄 Starting translation and quality check process");

    try {
      // Load existing series glossary
      const existingGlossary = await supabaseHelpers.getSeriesGlossary(
        this.seriesId
      );
      console.log(
        "📚 Loaded existing glossary terms:",
        existingGlossary.length
      );

      // Convert to the format expected by the API
      const glossaryObj = existingGlossary.reduce((acc, entry) => {
        acc[entry.source_term] = {
          translation: entry.translated_term,
          gender: entry.gender,
          role: entry.role,
          alias: entry.notes, // Use notes as alias
        };
        return acc;
      }, {} as Record<string, any>);

      const response = await fetch("/api/quality-checker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalText: combinedText,
          glossary: glossaryObj, // Pass the existing glossary
          series: this.selectedSeries,
          chapterData: {
            seriesId: this.seriesId,
            chapterId: this.chapterId,
            sourceLanguage: this.selectedSeries.source_language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Translation and quality check failed");
      }

      const result = await response.json();

      // Format the improved text
      const formattedText = result.improvedText
        .replace(/(=== Page \d+ ===)/g, "\n\n$1\n\n")
        .replace(/\n{4,}/g, "\n\n\n");

      const translationResult: ExtendedTranslationResult = {
        text: formattedText,
        fullText: formattedText,
        rawResponse: formattedText,
        qualityReport: {
          issues: result.qualityReport?.issues || [],
          suggestions: result.qualityReport?.suggestions || [],
          culturalNotes: result.qualityReport?.culturalNotes || [],
          glossarySuggestions: result.qualityReport?.glossarySuggestions || [],
          chapterMemory: result.qualityReport?.chapterMemory || "",
          chapterSummary: result.qualityReport?.chapterSummary || "",
        },
        glossary: {},
        chapterMemory: result.qualityReport?.chapterMemory || "",
        formattingReport: result.formattingReport,
        readabilityScore: result.readabilityScore,
      };

      console.log("🔍 TranslationFlowManager API response analysis:", {
        hasQualityReport: !!result.qualityReport,
        hasGlossarySuggestions: !!result.qualityReport?.glossarySuggestions,
        glossarySuggestionsCount:
          result.qualityReport?.glossarySuggestions?.length || 0,
        glossarySuggestionsData: result.qualityReport?.glossarySuggestions,
        fullAPIResponse: result,
      });

      return translationResult;
    } catch (error) {
      console.error("Translation error:", error);
      throw error;
    }
  }

  // Apply quality improvements
  async applyQualityImprovements(
    approvedSuggestions: string[] = [],
    rejectedSuggestions: string[] = [],
    approvedGlossaryTerms: DatabaseGlossaryEntry[] = [],
    customTranslation?: string
  ): Promise<{ finalText: string; updatedMemory: string }> {
    const combinedText = this.getCombinedText();

    console.log("🔧 Applying quality improvements with:", {
      approvedSuggestionsCount: approvedSuggestions.length,
      rejectedSuggestionsCount: rejectedSuggestions.length,
      approvedGlossaryTermsCount: approvedGlossaryTerms.length,
      glossaryTerms: approvedGlossaryTerms.map(
        (term) => `${term.source_term} → ${term.translated_term}`
      ),
      hasCustomTranslation: !!customTranslation,
    });

    // Convert DatabaseGlossaryEntry format to API format
    const apiGlossaryTerms = approvedGlossaryTerms.map((term) => ({
      sourceTerm: term.source_term,
      translatedTerm: term.translated_term,
      entityType:
        (term.term_type as
          | "Person"
          | "Place"
          | "Technique"
          | "Organization"
          | "Item"
          | "Term") || "Term",
      gender: term.gender as "Male" | "Female" | "Unknown" | undefined,
      role: term.role as
        | "Protagonist"
        | "Antagonist"
        | "Supporting"
        | "Minor"
        | "Mentor"
        | "Family"
        | "Other"
        | undefined,
      notes: term.notes,
    }));

    console.log("🔄 Converted glossary terms for API:", {
      apiGlossaryTerms: apiGlossaryTerms.map(
        (term) => `${term.sourceTerm} → ${term.translatedTerm}`
      ),
    });

    try {
      const response = await fetch("/api/apply-quality", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalText: combinedText,
          approvedSuggestions,
          rejectedSuggestions,
          approvedGlossaryTerms: apiGlossaryTerms,
          customTranslation,
          series: this.selectedSeries,
          chapterData: {
            seriesId: this.seriesId,
            chapterId: this.chapterId,
            sourceLanguage: this.selectedSeries.source_language,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to apply quality improvements");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error("Quality improvement application failed");
      }

      // Clean the improved text
      const cleanedText = result.improvedText.replace(/```/g, "").trim();

      // Extract the updated chapter memory from the quality report
      const updatedMemory = result.qualityReport?.chapterMemory || "";

      console.log("✅ Quality improvements applied successfully:", {
        finalTextLength: cleanedText.length,
        updatedMemoryLength: updatedMemory.length,
        memoryPreview:
          updatedMemory.substring(0, 100) +
          (updatedMemory.length > 100 ? "..." : ""),
      });

      return {
        finalText: cleanedText,
        updatedMemory: updatedMemory,
      };
    } catch (error) {
      console.error("Error applying quality improvements:", error);
      throw error;
    }
  }

  // Save final translation to database
  async saveFinalTranslation(
    finalText: string,
    chapterMemory: string = "",
    approvedGlossaryTerms: DatabaseGlossaryEntry[] = []
  ): Promise<boolean> {
    const combinedText = this.getCombinedText();
    const user = await supabaseHelpers.getCurrentUser();

    try {
      // Save translation history
      const historySuccess = await supabaseHelpers.saveTranslationHistory({
        seriesId: this.seriesId,
        chapterId: this.chapterId,
        sourceText: combinedText,
        translatedText: finalText,
        userId: user?.id,
      });

      if (!historySuccess) {
        console.warn("Failed to save translation history");
      }

      // Save chapter data with memory
      const chapterSuccess = await supabaseHelpers.saveChapterData(
        this.chapterId,
        {
          extractedText: combinedText,
          translatedText: finalText,
          chapterMemory: chapterMemory,
        }
      );

      if (!chapterSuccess) {
        console.warn("Failed to save chapter data");
      }

      // Save glossary terms
      if (approvedGlossaryTerms.length > 0) {
        const glossarySuccess = await supabaseHelpers.saveGlossaryTerms(
          this.seriesId,
          approvedGlossaryTerms
        );

        if (glossarySuccess) {
          // Broadcast glossary update
          await supabaseHelpers.broadcastGlossaryUpdate();
        }
      }

      return historySuccess && chapterSuccess;
    } catch (error) {
      console.error("Error saving final translation:", error);
      return false;
    }
  }

  // Complete workflow: translate -> apply quality -> save
  async completeTranslationWorkflow(
    approvedSuggestions: string[] = [],
    rejectedSuggestions: string[] = [],
    approvedGlossaryTerms: DatabaseGlossaryEntry[] = [],
    chapterMemory: string = ""
  ): Promise<{ finalText: string; updatedMemory: string }> {
    try {
      // Apply quality improvements
      const { finalText, updatedMemory } = await this.applyQualityImprovements(
        approvedSuggestions,
        rejectedSuggestions,
        approvedGlossaryTerms
      );

      // Use the updated memory from the API response, or fallback to provided chapterMemory
      const memoryToSave = updatedMemory || chapterMemory;

      // Save to database with chapter memory
      const saveSuccess = await this.saveFinalTranslation(
        finalText,
        memoryToSave,
        approvedGlossaryTerms
      );

      if (saveSuccess) {
        console.log("✅ Translation workflow completed successfully");
        toast.success("Translation completed and saved successfully");
      } else {
        console.warn(
          "⚠️ Translation completed but some database operations failed"
        );
        toast.warning("Translation completed but some data may not be saved");
      }

      return {
        finalText,
        updatedMemory: memoryToSave,
      };
    } catch (error) {
      console.error("Error in translation workflow:", error);
      toast.error("Failed to complete translation workflow");
      throw error;
    }
  }
}
