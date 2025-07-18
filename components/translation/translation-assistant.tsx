"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookText,
  Sparkles,
  History,
  Tag,
  Loader,
  Check,
  AlertCircle,
} from "lucide-react";
import { Series, GlossaryTerm, MemoryEntry } from "@/types";
import { aiHelpChatAssistant } from "@/lib/assistants";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface TranslationAssistantProps {
  seriesId: string | null;
  series: Series | null;
  glossaryTerms: GlossaryTerm[];
  memoryEntries: MemoryEntry[];
  recentTranslations: string[];
  onQuerySubmit?: (query: string, type: string) => void;
}

export function TranslationAssistant({
  seriesId,
  series,
  glossaryTerms,
  memoryEntries,
  recentTranslations,
  onQuerySubmit,
}: TranslationAssistantProps) {
  const [activeTab, setActiveTab] = useState("context");
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [assistantResponse, setAssistantResponse] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAssistantAction = async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAssistantResponse(null);
    setErrorMessage(null);

    try {
      // Get series context
      const seriesContext = series
        ? `Series: ${series.name}, Genre: ${series.genre || "Unknown"}, ${
            series.description || ""
          }`
        : "No series selected";

      // Call the appropriate assistant based on the query type
      let response: string;

      // In real implementation, would call different assistants based on query type
      response = await aiHelpChatAssistant(
        query,
        seriesContext,
        recentTranslations
      );

      setAssistantResponse(response);

      // Notify parent if callback exists
      if (onQuerySubmit) {
        onQuerySubmit(query, queryType);
      }
    } catch (error) {
      console.error("Error in assistant:", error);
      setErrorMessage("I couldn't process your request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b p-3">
        <CardTitle className="text-md">Translation Management</CardTitle>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        <Tabs
          defaultValue="context"
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="grid grid-cols-4 px-2 py-1">
            <TabsTrigger value="context" className="text-xs">
              <BookText className="h-3 w-3 mr-1" />
              Context
            </TabsTrigger>
            <TabsTrigger value="glossary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              Glossary
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              Memory
            </TabsTrigger>
            <TabsTrigger value="assistant" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Assist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="context" className="p-3 overflow-y-auto flex-1">
            <h3 className="text-sm font-medium mb-2">Series Context</h3>
            {series ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Series:</span> {series.name}
                </p>
                <p>
                  <span className="font-medium">Language:</span>{" "}
                  {series.source_language}
                </p>
                {series.genre && (
                  <div className="space-y-1">
                    <p className="font-medium">Genres:</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(series.genre) ? (
                        series.genre.map((g, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {g}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {series.genre}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {series.tone_notes && (
                  <div className="mt-3">
                    <p className="font-medium">Tone Notes:</p>
                    <p className="text-xs mt-1 whitespace-pre-wrap">
                      {series.tone_notes}
                    </p>
                  </div>
                )}
                {series.description && (
                  <div className="mt-3">
                    <p className="font-medium">Description:</p>
                    <p className="text-xs mt-1 whitespace-pre-wrap">
                      {series.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No series selected
              </p>
            )}
          </TabsContent>

          <TabsContent value="glossary" className="p-3 overflow-y-auto flex-1">
            <h3 className="text-sm font-medium mb-2">
              Glossary Terms ({glossaryTerms.length})
            </h3>
            {glossaryTerms.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1 text-xs font-medium pb-1 border-b">
                  <div>Term</div>
                  <div>Translation</div>
                  <div>Category</div>
                </div>
                <div className="space-y-1">
                  {glossaryTerms.map((term, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-3 gap-1 text-xs py-1 border-b border-dashed"
                    >
                      <div>{term.source_term}</div>
                      <div>{term.translated_term}</div>
                      <div>
                        {term.term_type && (
                          <Badge variant="outline" className="text-xs">
                            {term.term_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No glossary terms available
              </p>
            )}
          </TabsContent>

          <TabsContent value="memory" className="p-3 overflow-y-auto flex-1">
            <h3 className="text-sm font-medium mb-2">
              Memory Entries ({memoryEntries.length})
            </h3>
            {memoryEntries.length > 0 ? (
              <div className="space-y-3">
                {memoryEntries.map((entry, index) => (
                  <div key={index} className="border rounded-md p-2 space-y-1">
                    <p className="text-xs">{entry.content}</p>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag, tagIndex) => (
                          <Badge
                            key={tagIndex}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No memory entries available
              </p>
            )}
          </TabsContent>

          <TabsContent value="assistant" className="flex flex-col flex-1">
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Translation Assistant
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ask for help with translations, character consistency,
                  terminology, or cultural context.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium mb-1">Query Type</div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={queryType === "general" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setQueryType("general")}
                  >
                    General
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      queryType === "terminology" ? "default" : "outline"
                    }
                    className="text-xs h-7"
                    onClick={() => setQueryType("terminology")}
                  >
                    Terminology
                  </Button>
                  <Button
                    size="sm"
                    variant={queryType === "context" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setQueryType("context")}
                  >
                    Context
                  </Button>
                  <Button
                    size="sm"
                    variant={queryType === "cultural" ? "default" : "outline"}
                    className="text-xs h-7"
                    onClick={() => setQueryType("cultural")}
                  >
                    Cultural
                  </Button>
                </div>
              </div>

              <Textarea
                className="min-h-[100px] text-sm"
                placeholder="How should I translate this term? Is this character related to...?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {assistantResponse && (
                <div className="bg-muted rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Check className="h-3 w-3 text-green-500" />
                    <p className="text-xs font-medium">Assistant Response</p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {assistantResponse}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-50 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <p className="text-xs font-medium text-red-500">Error</p>
                  </div>
                  <p className="text-sm text-red-500">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="border-t p-3">
              <Button
                className="w-full"
                onClick={handleAssistantAction}
                disabled={isLoading || !query.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Get Assistance"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
