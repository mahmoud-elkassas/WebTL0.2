"use client";

import { Series, GlossaryTerm, MemoryEntry } from "@/types";
import { GlossaryAssistant } from "@/components/translation/glossary-assistant";
import { MemoryAssistant } from "@/components/translation/memory-assistant";
import { TranslationHistoryModal } from "@/components/translation/translation-history-modal";
import { getUserProfile } from "@/lib/auth";
import { getTranslation, mergeTranslation } from "@/lib/translation";
import { toast } from "sonner";

interface TranslationModalsProps {
  showGlossaryAssistant: boolean;
  showMemoryAssistant: boolean;
  showPromptPreview: boolean;
  showTranslationHistory: boolean;
  selectedSeries: Series | null;
  newTerms: string[];
  selectedChapterId: string | null;
  currentTranslation: { sourceText: string; translatedText: string } | null;
  systemPrompt: string;
  glossariesBySeriesId: Record<string, GlossaryTerm[]>;
  selectedMemories: MemoryEntry[];
  chapter: string;
  setShowGlossaryAssistant: (show: boolean) => void;
  setShowMemoryAssistant: (show: boolean) => void;
  setShowPromptPreview: (show: boolean) => void;
  setShowTranslationHistory: (show: boolean) => void;
  setNewTerms: (terms: string[]) => void;
  setSelectedChapterId: (id: string | null) => void;
  setSelectedTranslationId: (id: string | null) => void;
  setTranslationAction: (action: "replace" | "merge") => void;
  setTranslationMergeStrategy: (strategy: string) => void;
  setCurrentTranslation: (
    translation: { sourceText: string; translatedText: string } | null
  ) => void;
}

export function TranslationModals({
  showGlossaryAssistant,
  showMemoryAssistant,
  showPromptPreview,
  showTranslationHistory,
  selectedSeries,
  newTerms,
  selectedChapterId,
  currentTranslation,
  systemPrompt,
  glossariesBySeriesId,
  selectedMemories,
  chapter,
  setShowGlossaryAssistant,
  setShowMemoryAssistant,
  setShowPromptPreview,
  setShowTranslationHistory,
  setNewTerms,
  setSelectedChapterId,
  setSelectedTranslationId,
  setTranslationAction,
  setTranslationMergeStrategy,
  setCurrentTranslation,
}: TranslationModalsProps) {
  // Handle the glossary assistant completion
  const handleGlossaryComplete = () => {
    setShowGlossaryAssistant(false);
    setNewTerms([]);
  };

  // Handle the memory assistant completion
  const handleMemoryComplete = () => {
    setShowMemoryAssistant(false);
    setSelectedChapterId(null);
  };

  // Handle prompt preview confirmation
  const handlePromptConfirm = () => {
    setShowPromptPreview(false);
    // Continue with translation process
  };

  // Function to handle translation selection from history
  const handleTranslationSelect = async (
    translationId: string,
    action: "replace" | "merge",
    mergeStrategy?: string
  ) => {
    try {
      console.log(
        `🔄 Selected translation: ${translationId}, action: ${action}, strategy: ${mergeStrategy}`
      );

      setSelectedTranslationId(translationId);
      setTranslationAction(action);
      if (mergeStrategy) {
        setTranslationMergeStrategy(mergeStrategy);
      }

      // Get the user profile
      const user = await getUserProfile();

      if (!user) {
        console.error("❌ User not authenticated");
        return;
      }

      // Get the selected translation
      const translation = await getTranslation(translationId);

      if (!translation) {
        console.error(`❌ Translation with ID ${translationId} not found`);
        return;
      }

      // Process based on the selected action
      if (action === "replace") {
        // Set the translation directly in the UI without saving to database yet
        setCurrentTranslation({
          sourceText: translation.source_text,
          translatedText: translation.translated_text,
        });

        toast.success("Translation loaded from history");
      } else if (action === "merge") {
        // If current translation exists, merge it with the selected one
        if (currentTranslation) {
          // Perform the merge based on strategy
          const result = await mergeTranslation(
            translationId,
            currentTranslation.sourceText,
            user.id,
            mergeStrategy as "append" | "prepend" | "smart"
          );

          // Update the UI with merged content
          setCurrentTranslation({
            sourceText: result.sourceText,
            translatedText: result.translatedText.text,
          });

          toast.success(`Translation merged using ${mergeStrategy} strategy`);
        } else {
          // If no current translation, just replace
          setCurrentTranslation({
            sourceText: translation.source_text,
            translatedText: translation.translated_text,
          });

          toast.info(
            "No current translation to merge with, loaded from history instead"
          );
        }
      }
    } catch (error) {
      console.error("❌ Error handling translation selection:", error);
      toast.error("Failed to process selected translation");
    }
  };

  return (
    <>
      {/* Glossary Assistant Modal */}
      {showGlossaryAssistant && selectedSeries && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="max-w-2xl w-full mx-auto p-4">
            <GlossaryAssistant
              seriesId={selectedSeries.id}
              sourceTerms={newTerms}
              onApproved={handleGlossaryComplete}
              onCancel={handleGlossaryComplete}
            />
          </div>
        </div>
      )}

      {/* Memory Assistant Modal */}
      {showMemoryAssistant &&
        selectedSeries &&
        selectedChapterId &&
        currentTranslation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="max-w-2xl w-full mx-auto p-4">
              <MemoryAssistant
                seriesId={selectedSeries.id}
                chapterId={selectedChapterId}
                translatedText={currentTranslation.translatedText}
                onSaved={handleMemoryComplete}
                onCancel={handleMemoryComplete}
              />
            </div>
          </div>
        )}

      {/* Translation History Modal */}
      {showTranslationHistory && selectedSeries && (
        <TranslationHistoryModal
          open={showTranslationHistory}
          onClose={() => setShowTranslationHistory(false)}
          onSelect={handleTranslationSelect}
          seriesId={selectedSeries.id}
          chapter={chapter}
        />
      )}
    </>
  );
}
