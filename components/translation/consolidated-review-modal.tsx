"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  Edit,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  BookOpen,
  Languages,
  Sparkles,
  Edit3,
  Save,
  Undo,
  RefreshCw,
  FileText,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { EntityType, Gender, Role, DatabaseGlossaryEntry } from "@/types";
import { toast } from "sonner";

interface ConsolidatedReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  glossaryEntries: Array<{
    sourceTerm: string;
    translatedTerm: string;
    entityType: EntityType;
    gender?: Gender;
    role?: Role;
    notes?: string;
  }>;
  chapterMemory?: string;
  onComplete: (
    approvedSuggestions: string[],
    rejectedSuggestions: string[],
    approvedGlossaryTerms: DatabaseGlossaryEntry[],
    editedChapterMemory: string,
    hasGlossaryModifications: boolean
  ) => void;
}

type SuggestionStatus = "pending" | "approved" | "rejected";
type GlossaryStatus = "pending" | "approved" | "rejected";

interface SuggestionItem {
  original: string;
  edited: string;
  status: SuggestionStatus;
  category: string;
  isExpanded?: boolean;
}

interface GlossaryItem {
  sourceTerm: string;
  translatedTerm: string;
  entityType: EntityType;
  gender?: Gender;
  role?: Role;
  notes?: string;
  status: GlossaryStatus;
  isModified?: boolean;
  originalTranslatedTerm?: string;
  isExpanded?: boolean;
}

// Function to categorize suggestions
function categorizeSuggestion(suggestion: string): string {
  const lowercaseSuggestion = suggestion.toLowerCase();

  if (
    lowercaseSuggestion.includes("grammar") ||
    lowercaseSuggestion.includes("spelling") ||
    lowercaseSuggestion.includes("punctuation")
  ) {
    return "Grammar";
  }

  if (
    lowercaseSuggestion.includes("tone") ||
    lowercaseSuggestion.includes("style") ||
    lowercaseSuggestion.includes("flow") ||
    lowercaseSuggestion.includes("natural")
  ) {
    return "Style";
  }

  if (
    lowercaseSuggestion.includes("cultural") ||
    lowercaseSuggestion.includes("context") ||
    lowercaseSuggestion.includes("term")
  ) {
    return "Cultural";
  }

  if (
    lowercaseSuggestion.includes("character") ||
    lowercaseSuggestion.includes("name") ||
    lowercaseSuggestion.includes("pronoun")
  ) {
    return "Character";
  }

  return "General";
}

export function ConsolidatedReviewModal({
  isOpen,
  onClose,
  suggestions,
  glossaryEntries,
  chapterMemory = "",
  onComplete,
}: ConsolidatedReviewModalProps) {
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
  const [glossaryItems, setGlossaryItems] = useState<GlossaryItem[]>([]);
  const [editedChapterMemory, setEditedChapterMemory] =
    useState<string>(chapterMemory);
  const [activeTab, setActiveTab] = useState<string>("suggestions");
  const [hasGlossaryModifications, setHasGlossaryModifications] =
    useState(false);

  // Initialize data on mount
  useEffect(() => {
    if (suggestions.length > 0) {
      const items = suggestions.map((suggestion) => ({
        original: suggestion,
        edited: suggestion,
        status: "pending" as SuggestionStatus,
        category: categorizeSuggestion(suggestion),
        isExpanded: false,
      }));
      setSuggestionItems(items);
    }

    if (glossaryEntries.length > 0) {
      const items = glossaryEntries.map((entry) => ({
        ...entry,
        status: "pending" as GlossaryStatus,
        isModified: false,
        originalTranslatedTerm: entry.translatedTerm,
        isExpanded: false,
      }));
      setGlossaryItems(items);
    }

    setEditedChapterMemory(chapterMemory);
    setHasGlossaryModifications(false);

    // Set initial tab based on what's available
    if (suggestions.length > 0) {
      setActiveTab("suggestions");
    } else if (glossaryEntries.length > 0) {
      setActiveTab("glossary");
    } else {
      setActiveTab("memory");
    }
  }, [suggestions, glossaryEntries, chapterMemory]);

  // Track if any approved glossary items have been modified
  useEffect(() => {
    const hasModifications = glossaryItems.some(
      (item) => item.isModified && item.status === "approved"
    );
    setHasGlossaryModifications(hasModifications);
  }, [glossaryItems]);

  // Count pending items
  const pendingSuggestions = suggestionItems.filter(
    (item) => item.status === "pending"
  ).length;
  const pendingGlossary = glossaryItems.filter(
    (item) => item.status === "pending"
  ).length;
  const totalPending = pendingSuggestions + pendingGlossary;
  const totalItems = suggestionItems.length + glossaryItems.length;
  const completedItems = totalItems - totalPending;
  const progressPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  // Handle suggestion actions
  const handleSuggestionApprove = (index: number) => {
    setSuggestionItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], status: "approved" };
      return newItems;
    });
  };

  const handleSuggestionReject = (index: number) => {
    setSuggestionItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], status: "rejected" };
      return newItems;
    });
  };

  const handleSuggestionEdit = (index: number, editedText: string) => {
    setSuggestionItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], edited: editedText };
      return newItems;
    });
  };

  const handleSuggestionToggle = (index: number) => {
    setSuggestionItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        isExpanded: !newItems[index].isExpanded,
      };
      return newItems;
    });
  };

  // Handle glossary actions
  const handleGlossaryApprove = (index: number) => {
    setGlossaryItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], status: "approved" };
      return newItems;
    });
  };

  const handleGlossaryReject = (index: number) => {
    setGlossaryItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], status: "rejected" };
      return newItems;
    });
  };

  const handleGlossaryEdit = (index: number, newTranslatedTerm: string) => {
    setGlossaryItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];
      const isModified = item.originalTranslatedTerm !== newTranslatedTerm;

      newItems[index] = {
        ...item,
        translatedTerm: newTranslatedTerm,
        isModified,
      };

      return newItems;
    });
  };

  const handleGlossaryReset = (index: number) => {
    setGlossaryItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];

      newItems[index] = {
        ...item,
        translatedTerm: item.originalTranslatedTerm || item.translatedTerm,
        isModified: false,
      };

      return newItems;
    });
  };

  const handleGlossaryToggle = (index: number) => {
    setGlossaryItems((prev) => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        isExpanded: !newItems[index].isExpanded,
      };
      return newItems;
    });
  };

  // Handle approve/reject all actions
  const handleApproveAllSuggestions = () => {
    setSuggestionItems((prev) =>
      prev.map((item) => ({ ...item, status: "approved" }))
    );
  };

  const handleRejectAllSuggestions = () => {
    setSuggestionItems((prev) =>
      prev.map((item) => ({ ...item, status: "rejected" }))
    );
  };

  const handleApproveAllGlossary = () => {
    setGlossaryItems((prev) =>
      prev.map((item) => ({ ...item, status: "approved" }))
    );
  };

  const handleRejectAllGlossary = () => {
    setGlossaryItems((prev) =>
      prev.map((item) => ({ ...item, status: "rejected" }))
    );
  };

  // Handle continue
  const handleContinue = () => {
    const approvedSuggestions = suggestionItems
      .filter((item) => item.status === "approved")
      .map((item) => item.edited);

    const rejectedSuggestions = suggestionItems
      .filter((item) => item.status === "rejected")
      .map((item) => item.original);

    const approvedGlossaryTerms: DatabaseGlossaryEntry[] = glossaryItems
      .filter((item) => item.status === "approved")
      .map((item) => ({
        source_term: item.sourceTerm,
        translated_term: item.translatedTerm,
        term_type: item.entityType,
        gender: item.gender,
        role: item.role,
        notes: item.notes,
      }));

    const hasModifications = glossaryItems.some(
      (item) => item.status === "approved" && item.isModified
    );

    if (hasModifications) {
      toast.info(
        "Glossary modifications detected. Translation and memory will be regenerated based on the updated terms."
      );
    }

    onComplete(
      approvedSuggestions,
      rejectedSuggestions,
      approvedGlossaryTerms,
      editedChapterMemory,
      hasModifications
    );
  };

  const getStatusIcon = (status: SuggestionStatus | GlossaryStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Grammar":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Style":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Cultural":
        return "bg-green-100 text-green-800 border-green-200";
      case "Character":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const availableTabs = [];
  if (suggestionItems.length > 0) availableTabs.push("suggestions");
  if (glossaryItems.length > 0) availableTabs.push("glossary");
  availableTabs.push("memory");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-semibold">
                Review Translation Quality
              </span>
            </div>
            {hasGlossaryModifications && (
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 border-orange-200"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Will Regenerate
              </Badge>
            )}
          </DialogTitle>

          <DialogDescription className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review and approve suggestions, glossary terms, and edit chapter
              memory to improve your translation quality.
            </p>

            {/* Progress Bar */}
            {totalItems > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Progress: {completedItems} of {totalItems} items reviewed
                  </span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {Math.round(progressPercentage)}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            )}

            {hasGlossaryModifications && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950/20 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Modified glossary terms detected. Translation and memory will
                  be regenerated based on your changes.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="mx-6 mt-4 grid w-auto grid-cols-3 bg-gray-100 dark:bg-gray-800">
              {availableTabs.includes("suggestions") && (
                <TabsTrigger
                  value="suggestions"
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Suggestions</span>
                  <Badge
                    variant={
                      pendingSuggestions > 0 ? "destructive" : "secondary"
                    }
                    className="ml-1"
                  >
                    {suggestionItems.length}
                  </Badge>
                </TabsTrigger>
              )}
              {availableTabs.includes("glossary") && (
                <TabsTrigger
                  value="glossary"
                  className="flex items-center gap-2"
                >
                  <Languages className="w-4 h-4" />
                  <span>Glossary</span>
                  <Badge
                    variant={pendingGlossary > 0 ? "destructive" : "secondary"}
                    className="ml-1"
                  >
                    {glossaryItems.length}
                  </Badge>
                  {hasGlossaryModifications && (
                    <RefreshCw className="w-3 h-3 ml-1 text-orange-600" />
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="memory" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>Memory</span>
              </TabsTrigger>
            </TabsList>

            {/* Suggestions Tab */}
            {availableTabs.includes("suggestions") && (
              <TabsContent
                value="suggestions"
                className="flex-1 overflow-hidden px-6 pb-4"
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Translation Suggestions ({suggestionItems.length})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApproveAllSuggestions}
                          disabled={suggestionItems.length === 0}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRejectAllSuggestions}
                          disabled={suggestionItems.length === 0}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject All
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6">
                      <div className="space-y-4 pb-4">
                        {suggestionItems.map((item, index) => (
                          <Card
                            key={index}
                            className={`transition-all duration-200 ${
                              item.status === "approved"
                                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                                : item.status === "rejected"
                                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                            }`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(item.status)}
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      className={getCategoryColor(
                                        item.category
                                      )}
                                    >
                                      {item.category}
                                    </Badge>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                      Suggestion #{index + 1}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSuggestionToggle(index)}
                                >
                                  {item.isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </CardHeader>

                            <CardContent className="pt-0">
                              {item.isExpanded && (
                                <div className="space-y-4">
                                  <div>
                                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                      Edit Suggestion:
                                    </Label>
                                    <Textarea
                                      value={item.edited}
                                      onChange={(e) =>
                                        handleSuggestionEdit(
                                          index,
                                          e.target.value
                                        )
                                      }
                                      className="font-mono text-sm resize-none"
                                      rows={4}
                                      placeholder="Edit the suggestion text here..."
                                    />
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleSuggestionReject(index)
                                      }
                                      className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${
                                        item.status === "rejected"
                                          ? "bg-red-100 dark:bg-red-900/50"
                                          : ""
                                      }`}
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleSuggestionApprove(index)
                                      }
                                      className={`text-green-600 hover:text-green-700 hover:bg-green-50 ${
                                        item.status === "approved"
                                          ? "bg-green-100 dark:bg-green-900/50"
                                          : ""
                                      }`}
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {!item.isExpanded && (
                                <div className="space-y-3">
                                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                                    {item.edited}
                                  </p>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleSuggestionReject(index)
                                      }
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Reject
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleSuggestionApprove(index)
                                      }
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}

                        {suggestionItems.length === 0 && (
                          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No suggestions available for review</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Glossary Tab */}
            {availableTabs.includes("glossary") && (
              <TabsContent
                value="glossary"
                className="flex-1 overflow-hidden px-6 pb-4"
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Languages className="w-5 h-5 text-blue-600" />
                        Glossary Terms ({glossaryItems.length})
                        <Badge
                          variant="outline"
                          className="text-blue-600 border-blue-200"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Editable
                        </Badge>
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApproveAllGlossary}
                          disabled={glossaryItems.length === 0}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Approve All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRejectAllGlossary}
                          disabled={glossaryItems.length === 0}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject All
                        </Button>
                      </div>
                    </div>
                    {hasGlossaryModifications && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950/20 dark:border-orange-800">
                        <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Changes detected - translation will be regenerated
                          with updated terms
                        </p>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6">
                      <div className="space-y-4 pb-4">
                        {glossaryItems.map((item, index) => (
                          <Card
                            key={index}
                            className={`transition-all duration-200 ${
                              item.status === "approved"
                                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                                : item.status === "rejected"
                                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                                : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                            }`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(item.status)}
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="text-blue-600 border-blue-200"
                                    >
                                      {item.entityType}
                                    </Badge>
                                    {item.isModified && (
                                      <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                                        <Edit3 className="w-3 h-3 mr-1" />
                                        Modified
                                      </Badge>
                                    )}
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                      Term #{index + 1}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleGlossaryToggle(index)}
                                >
                                  {item.isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </CardHeader>

                            <CardContent className="pt-0">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                    Source Term
                                  </Label>
                                  <Input
                                    value={item.sourceTerm}
                                    readOnly
                                    className="font-mono bg-gray-50 dark:bg-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block flex items-center gap-1">
                                    <Edit3 className="w-3 h-3 text-blue-500" />
                                    Translated Term
                                    {item.isModified && (
                                      <RefreshCw className="w-3 h-3 text-orange-500" />
                                    )}
                                  </Label>
                                  <Input
                                    value={item.translatedTerm}
                                    onChange={(e) =>
                                      handleGlossaryEdit(index, e.target.value)
                                    }
                                    placeholder="Enter translation..."
                                    className={`font-mono text-sm transition-colors ${
                                      item.isModified
                                        ? "border-orange-300 focus:border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                                        : "focus:border-blue-500"
                                    }`}
                                  />
                                </div>
                              </div>

                              {item.isExpanded && (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap gap-2">
                                    {item.gender && (
                                      <Badge variant="secondary">
                                        {item.gender}
                                      </Badge>
                                    )}
                                    {item.role && (
                                      <Badge variant="secondary">
                                        {item.role}
                                      </Badge>
                                    )}
                                  </div>

                                  {item.notes && (
                                    <div>
                                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                        Notes
                                      </Label>
                                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                        {item.notes}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-4">
                                {item.isModified && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGlossaryReset(index)}
                                    className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                  >
                                    <Undo className="w-4 h-4 mr-1" />
                                    Reset
                                  </Button>
                                )}

                                <div className="flex gap-2 ml-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGlossaryReject(index)}
                                    className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${
                                      item.status === "rejected"
                                        ? "bg-red-100 dark:bg-red-900/50"
                                        : ""
                                    }`}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGlossaryApprove(index)}
                                    className={`text-green-600 hover:text-green-700 hover:bg-green-50 ${
                                      item.status === "approved"
                                        ? "bg-green-100 dark:bg-green-900/50"
                                        : ""
                                    }`}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {glossaryItems.length === 0 && (
                          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Languages className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No glossary terms available for review</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Chapter Memory Tab */}
            <TabsContent
              value="memory"
              className="flex-1 overflow-hidden px-6 pb-4"
            >
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Chapter Memory & Context
                    {hasGlossaryModifications && (
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-800 border-orange-200"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Will Update
                      </Badge>
                    )}
                  </CardTitle>
                  {hasGlossaryModifications && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950/20 dark:border-orange-800">
                      <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Chapter memory will be automatically updated to reflect
                        new character names and terminology.
                      </p>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden">
                  <div className="h-full flex flex-col space-y-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Edit chapter summary and key plot points for better
                      context:
                    </Label>
                    <Textarea
                      value={editedChapterMemory}
                      onChange={(e) => setEditedChapterMemory(e.target.value)}
                      placeholder="Enter chapter summary, key events, character developments, relationships, and important plot points..."
                      className="flex-1 font-mono resize-none text-sm min-h-[400px]"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      This information helps improve translation quality and
                      maintains consistency across chapters.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <Separator />
        <DialogFooter className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              {totalPending > 0 && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {totalPending} item{totalPending > 1 ? "s" : ""} pending
                    review
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={totalPending > 0}
                className={`min-w-[140px] ${
                  hasGlossaryModifications
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {totalPending > 0 ? (
                  `Review ${totalPending} More`
                ) : hasGlossaryModifications ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Apply & Regenerate
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
