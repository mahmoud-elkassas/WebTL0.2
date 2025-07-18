"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import supabase from "@/lib/supabase";
import { GlossaryObject } from "@/types";
import { glossaryManagementAssistant } from "@/lib/assistants";

interface GlossaryAssistantProps {
  seriesId: string;
  sourceTerms: string[];
  onApproved: () => void;
  onCancel: () => void;
  sourceContext?: string;
}

interface TermSuggestion {
  sourceTerm: string;
  translatedTerm: string;
  suggestedCategory: string;
  entityType?: string;
  gender?: string | null;
  characterRole?: string;
  language?: string;
  isSelected: boolean;
}

export function GlossaryAssistant({
  seriesId,
  sourceTerms,
  onApproved,
  onCancel,
  sourceContext = "",
}: GlossaryAssistantProps): JSX.Element {
  const [suggestions, setSuggestions] = useState<TermSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingGlossary, setExistingGlossary] = useState<GlossaryObject>({});

  // Fetch existing glossary and then get AI suggestions
  useEffect(() => {
    const fetchGlossaryAndSuggestions = async () => {
      try {
        // Fetch existing glossary terms
        const { data } = await supabase
          .from("glossaries")
          .select("source_term, translated_term")
          .eq("series_id", seriesId);

        // Convert to object format
        const glossaryObj: GlossaryObject = {};
        if (data) {
          data.forEach((item) => {
            glossaryObj[item.source_term] = {
              translation: item.translated_term,
            };
          });
        }
        setExistingGlossary(glossaryObj);

        // Get suggestions from the assistant
        if (sourceTerms.length > 0) {
          // Call the actual glossary management assistant
          const result = await glossaryManagementAssistant(
            sourceTerms,
            glossaryObj,
            sourceContext
          );

          // Transform into our UI format with selected state
          const termSuggestions = result.suggestedTerms.map((term) => ({
            ...term,
            isSelected: true,
          }));

          setSuggestions(termSuggestions);
        }
      } catch (error) {
        console.error("Error fetching glossary suggestions:", error);
        // Fallback to better suggestions if the API fails
        const fallbackSuggestions: TermSuggestion[] = sourceTerms.map(
          (term) => {
            const language = detectLanguage(term);

            // Default entity type based on pattern recognition
            let entityType = "Term";
            let suggestedCategory = "Other";
            let gender: string | null = null;

            // For potential character names (usually 2-3 characters for Korean/Chinese names)
            if (
              term.length <= 3 &&
              (language === "Korean" || language === "Chinese")
            ) {
              entityType = "Person";
              suggestedCategory = "Character Name";
              // Can't determine gender without context
              gender = "Unknown";
            }
            // For potential place names (longer terms with certain patterns)
            else if (
              term.includes("산") ||
              term.includes("강") ||
              term.includes("시") ||
              term.includes("구") ||
              term.includes("도") ||
              term.includes("동")
            ) {
              entityType = "Place";
              suggestedCategory = "Location";
            }
            // For potential skills or techniques (often has certain endings)
            else if (
              term.includes("술") ||
              term.includes("법") ||
              term.includes("공") ||
              term.includes("기") ||
              term.includes("력")
            ) {
              entityType = "Technique";
              suggestedCategory = "Skill/Technique";
            }

            // Create a more helpful fallback translation suggestion
            let translatedTerm = `[${language} term]`;
            if (language === "Korean") {
              // For Korean honorifics (common patterns)
              if (
                term === "형" ||
                term === "오빠" ||
                term === "누나" ||
                term === "언니" ||
                term === "아저씨" ||
                term === "아줌마" ||
                term === "선배" ||
                term === "후배"
              ) {
                translatedTerm = term; // Keep as-is for honorifics
                suggestedCategory = "Honorific";
                entityType = "Term";
              }
            }

            return {
              sourceTerm: term,
              translatedTerm: translatedTerm,
              suggestedCategory: suggestedCategory,
              language: language,
              entityType: entityType,
              gender: gender,
              isSelected: true,
            };
          }
        );
        setSuggestions(fallbackSuggestions);
      } finally {
        setLoading(false);
      }
    };

    fetchGlossaryAndSuggestions();
  }, [seriesId, sourceTerms, sourceContext]);

  // Simple language detection based on character ranges
  const detectLanguage = (text: string): string => {
    // Korean: AC00-D7A3
    if (/[\uAC00-\uD7A3]/.test(text)) return "Korean";
    // Japanese: 3040-309F (hiragana), 30A0-30FF (katakana), 4E00-9FAF (kanji)
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text))
      return "Japanese";
    // Chinese: 4E00-9FFF
    if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
    return "Unknown";
  };

  // Toggle selection for a term
  const toggleTermSelection = (index: number) => {
    setSuggestions((prev) =>
      prev.map((term, i) =>
        i === index ? { ...term, isSelected: !term.isSelected } : term
      )
    );
  };

  // Edit translated term
  const updateTranslatedTerm = (index: number, value: string) => {
    setSuggestions((prev) =>
      prev.map((term, i) =>
        i === index ? { ...term, translatedTerm: value } : term
      )
    );
  };

  // Handle save action
  const handleSave = async () => {
    setSaving(true);

    try {
      // Filter only selected terms
      const selectedTerms = suggestions.filter((term) => term.isSelected);

      if (selectedTerms.length === 0) {
        toast.error("No terms selected for saving");
        onApproved();
        return;
      }

      // Save terms to glossary
      for (const term of selectedTerms) {
        console.log(
          `Saving glossary term: ${term.sourceTerm} -> ${term.translatedTerm}`
        );

        // Determine the term type based on category or language
        let termType = "Other";
        if (term.suggestedCategory?.toLowerCase().includes("character")) {
          termType = "Character Name";
        } else if (
          term.suggestedCategory?.toLowerCase().includes("place") ||
          term.suggestedCategory?.toLowerCase().includes("location")
        ) {
          termType = "Location";
        } else if (
          term.suggestedCategory?.toLowerCase().includes("honorific") ||
          term.suggestedCategory?.toLowerCase().includes("title")
        ) {
          // Set language-specific honorific
          if (term.language === "Korean") {
            termType = "Honorific - Korean";
          } else if (term.language === "Chinese") {
            termType = "Honorific - Chinese";
          } else if (term.language === "Japanese") {
            termType = "Honorific - Japanese";
          } else {
            termType = "Formal Title";
          }
        }

        const { error } = await supabase.from("glossaries").insert({
          series_id: seriesId,
          source_term: term.sourceTerm,
          translated_term: term.translatedTerm,
          term_type: termType,
          entity_type: term.entityType || null,
          gender: term.gender || null,
          character_role: term.characterRole || null,
          language: term.language || null,
          auto_suggested: true,
          source_context: sourceContext.substring(0, 500) || null,
        });

        if (error) {
          console.error(`Error saving term ${term.sourceTerm}:`, error);
          toast.error(`Failed to save term: ${term.sourceTerm}`);
        } else {
          console.log(
            `✅ Successfully saved glossary term: ${term.sourceTerm} -> ${term.translatedTerm}`
          );
        }
      }

      // Trigger RPC function to update the enhanced JSON
      await supabase.rpc("update_series_glossary_json", {
        series_id: seriesId,
      });

      toast.success(`Added ${selectedTerms.length} terms to glossary`);
      onApproved();
    } catch (error) {
      console.error("Error saving terms:", error);
      toast.error("Failed to save terms");
      onApproved();
    } finally {
      setSaving(false);
    }
  };

  // Add a separate handler for the Skip button
  const handleSkip = () => {
    console.log("Skipping glossary term addition");
    onCancel();
  };

  return (
    <Card className="w-full max-h-[80vh] overflow-y-auto">
      <CardHeader>
        <CardTitle>Glossary Assistant</CardTitle>
        <CardDescription>
          I've identified new terms that could be added to your glossary. Review
          these suggestions before adding them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-center">
              <div className="font-medium">Analyzing new terms...</div>
              <div className="text-sm text-muted-foreground">
                Our AI is detecting and categorizing terms from your source text
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No new terms identified</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All terms in this text appear to be already in your glossary
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-4">
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
                    <p className="font-medium text-blue-800 mb-1">
                      Translation Guide
                    </p>
                    <ul className="text-xs text-blue-700 list-disc pl-4 space-y-1">
                      <li>
                        Keep cultural terms and honorifics in their original
                        form
                      </li>
                      <li>
                        Maintain proper nouns and character names as they are
                      </li>
                      <li>
                        Translate common nouns to their English equivalents
                      </li>
                      <li>Review and edit suggested translations as needed</li>
                    </ul>
                  </div>
                  <p>Found {suggestions.length} potential new terms</p>
                </div>

                {suggestions.map((term, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 p-3 border rounded-md"
                  >
                    <Checkbox
                      id={`term-${index}`}
                      checked={term.isSelected}
                      onCheckedChange={() => toggleTermSelection(index)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                        <div className="font-medium">{term.sourceTerm}</div>
                        <div className="flex flex-wrap gap-1">
                          {term.language && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700"
                            >
                              {term.language}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={
                              term.suggestedCategory
                                ?.toLowerCase()
                                .includes("honorific") ||
                              term.suggestedCategory
                                ?.toLowerCase()
                                .includes("cultural")
                                ? "bg-amber-50 text-amber-700"
                                : ""
                            }
                          >
                            {term.suggestedCategory}
                          </Badge>
                          {term.entityType && (
                            <Badge variant="secondary" className="text-xs">
                              {term.entityType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={term.translatedTerm}
                          onChange={(e) =>
                            updateTranslatedTerm(index, e.target.value)
                          }
                          className="w-full px-2 py-1 border rounded-md text-sm"
                          disabled={!term.isSelected}
                          placeholder="Translation"
                        />
                        {term.entityType === "Person" && term.gender && (
                          <span className="absolute right-2 top-1 text-xs text-gray-500">
                            {term.gender}
                          </span>
                        )}
                      </div>
                      {(term.characterRole ||
                        term.language === "Korean" ||
                        term.language === "Japanese" ||
                        term.language === "Chinese") &&
                        term.isSelected && (
                          <div className="text-xs text-gray-500 border-t pt-1 mt-1">
                            {term.characterRole && (
                              <div>Role: {term.characterRole}</div>
                            )}
                            {(term.suggestedCategory
                              ?.toLowerCase()
                              .includes("honorific") ||
                              term.suggestedCategory
                                ?.toLowerCase()
                                .includes("cultural")) && (
                              <div className="text-amber-600 italic">
                                Cultural term - preserve original form
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={handleSkip} disabled={saving}>
                Skip
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || suggestions.length === 0}
              >
                {saving ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add to Glossary"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
