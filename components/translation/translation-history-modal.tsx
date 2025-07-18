"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader, Clock, RefreshCw, GitMerge } from "lucide-react";
import {
  findTranslationsByChapter,
  getTranslationVersions,
} from "@/lib/translation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface TranslationHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (
    translationId: string,
    action: "replace" | "merge",
    mergeStrategy?: string
  ) => void;
  seriesId: string;
  chapter: string;
}

export function TranslationHistoryModal({
  open,
  onClose,
  onSelect,
  seriesId,
  chapter,
}: TranslationHistoryModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [translations, setTranslations] = useState<any[]>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<string | null>(
    null
  );
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("translation");
  const [action, setAction] = useState<"replace" | "merge">("replace");
  const [mergeStrategy, setMergeStrategy] = useState<string>("append");

  // Define a type for the version object
  interface TranslationVersion {
    id: string;
    version_number: number;
    created_at: string;
    source_text: string;
    translated_text: string;
    is_current: boolean;
  }

  useEffect(() => {
    if (open && seriesId && chapter) {
      loadTranslations();
    }
  }, [open, seriesId, chapter]);

  useEffect(() => {
    if (selectedTranslation) {
      loadVersions(selectedTranslation);
    }
  }, [selectedTranslation]);

  const loadTranslations = async () => {
    setIsLoading(true);
    try {
      const result = await findTranslationsByChapter(seriesId, chapter);
      setTranslations(result);
      if (result.length > 0) {
        setSelectedTranslation(result[0].id);
      }
    } catch (error) {
      console.error("Error loading translations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersions = async (translationId: string) => {
    setVersionsLoading(true);
    try {
      const result = await getTranslationVersions(translationId);
      const versionsArray = Array.isArray(result)
        ? (result as TranslationVersion[])
        : [];
      setVersions(versionsArray);
      if (versionsArray.length > 0) {
        setSelectedVersion(versionsArray[0].id);
      }
    } catch (error) {
      console.error("Error loading versions:", error);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleSelect = () => {
    // Use the selected translation or version
    const idToUse =
      activeTab === "translation" ? selectedTranslation : selectedVersion;
    if (idToUse) {
      onSelect(idToUse, action, action === "merge" ? mergeStrategy : undefined);
    }
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text && text.length > maxLength) {
      return text.substring(0, maxLength) + "...";
    }
    return text;
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Translation History</DialogTitle>
          <DialogDescription>
            Select an existing translation to replace or merge with current
            content
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="translation"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList>
            <TabsTrigger value="translation">
              <Clock className="h-4 w-4 mr-2" />
              Chapter Translations
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              disabled={!selectedTranslation || translations.length === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Version History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="translation" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : translations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No previous translations found for this chapter.
              </p>
            ) : (
              <div className="space-y-4">
                <Select
                  value={selectedTranslation || undefined}
                  onValueChange={setSelectedTranslation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a translation" />
                  </SelectTrigger>
                  <SelectContent>
                    {translations.map((translation) => (
                      <SelectItem key={translation.id} value={translation.id}>
                        {formatDate(translation.created_at)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTranslation && (
                  <div className="space-y-2 border rounded-md p-4">
                    <h3 className="font-medium text-sm">
                      Selected Translation
                    </h3>
                    {translations
                      .filter((t) => t.id === selectedTranslation)
                      .map((translation) => (
                        <div key={translation.id} className="space-y-3">
                          <div>
                            <p className="text-xs font-medium">Created</p>
                            <p className="text-sm">
                              {formatDate(translation.created_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">Source</p>
                            <p className="text-sm whitespace-pre-wrap border p-2 rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                              {truncateText(translation.source_text, 500)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">Translation</p>
                            <p className="text-sm whitespace-pre-wrap border p-2 rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                              {truncateText(translation.translated_text, 500)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="versions" className="space-y-4 mt-4">
            {versionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No version history found for this translation.
              </p>
            ) : (
              <div className="space-y-4">
                <Select
                  value={selectedVersion || undefined}
                  onValueChange={setSelectedVersion}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.is_current
                          ? "Current Version"
                          : `Version ${version.version_number} - ${formatDate(
                              version.created_at
                            )}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedVersion && (
                  <div className="space-y-2 border rounded-md p-4">
                    <h3 className="font-medium text-sm">Selected Version</h3>
                    {versions
                      .filter((v) => v.id === selectedVersion)
                      .map((version) => (
                        <div key={version.id} className="space-y-3">
                          <div>
                            <p className="text-xs font-medium">Version</p>
                            <p className="text-sm">
                              {version.is_current
                                ? "Current Version"
                                : `Version ${version.version_number}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">Created</p>
                            <p className="text-sm">
                              {formatDate(version.created_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">Source</p>
                            <p className="text-sm whitespace-pre-wrap border p-2 rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                              {truncateText(version.source_text, 500)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium">Translation</p>
                            <p className="text-sm whitespace-pre-wrap border p-2 rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                              {truncateText(version.translated_text, 500)}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-4 mt-4 border-t pt-4">
          <h3 className="font-medium text-sm">Action</h3>
          <RadioGroup
            value={action}
            onValueChange={(value) => setAction(value as "replace" | "merge")}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="replace" id="replace" />
              <Label htmlFor="replace">Replace current translation</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="merge" />
              <Label htmlFor="merge">Merge with current translation</Label>
            </div>
          </RadioGroup>

          {action === "merge" && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Merge Strategy</h4>
              <RadioGroup
                value={mergeStrategy}
                onValueChange={setMergeStrategy}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="append" id="append" />
                  <Label htmlFor="append">
                    Append (add at the end of current text)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prepend" id="prepend" />
                  <Label htmlFor="prepend">
                    Prepend (add at the beginning of current text)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="smart" id="smart" />
                  <Label htmlFor="smart">
                    Smart (intelligently combine content)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={
              (!selectedTranslation && activeTab === "translation") ||
              (!selectedVersion && activeTab === "versions") ||
              isLoading ||
              versionsLoading
            }
          >
            {action === "replace" ? "Replace" : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
