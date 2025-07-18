"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import supabase from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface MemoryAssistantProps {
  seriesId: string;
  chapterId: string;
  translatedText: string;
  existingSummary?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface MemoryData {
  summary: string;
  tags: string[];
  keyEvents: string[];
}

export function MemoryAssistant({
  seriesId,
  chapterId,
  translatedText,
  existingSummary,
  onSaved,
  onCancel,
}: MemoryAssistantProps) {
  const [memoryData, setMemoryData] = useState<MemoryData>({
    summary: existingSummary || "",
    tags: [],
    keyEvents: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Simulate loading suggestions from the assistant
  // In a real implementation, this would call the storyContextMemoryAssistant function
  useState(() => {
    // Simulate API delay
    const timer = setTimeout(() => {
      // Mock data - in real implementation, this would come from the AI
      const sampleSummary =
        existingSummary ||
        "In this chapter, the protagonist confronts the antagonist and discovers a hidden truth about their past. A new character is introduced who appears to have knowledge of ancient powers.";

      const sampleTags = [
        "confrontation",
        "revelation",
        "new character",
        "mystery",
      ];

      const sampleKeyEvents = [
        "Main character confronts the villain at the castle",
        "Hidden family connection revealed between protagonist and mentor",
        "Mysterious stranger appears with knowledge of ancient magic",
      ];

      setMemoryData({
        summary: sampleSummary,
        tags: sampleTags,
        keyEvents: sampleKeyEvents,
      });

      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  });

  // Update memory data fields
  const updateSummary = (value: string) => {
    setMemoryData((prev) => ({ ...prev, summary: value }));
  };

  const removeTag = (index: number) => {
    setMemoryData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !memoryData.tags.includes(tag.trim())) {
      setMemoryData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag.trim()],
      }));
    }
  };

  const updateKeyEvent = (index: number, value: string) => {
    setMemoryData((prev) => ({
      ...prev,
      keyEvents: prev.keyEvents.map((event, i) =>
        i === index ? value : event
      ),
    }));
  };

  const removeKeyEvent = (index: number) => {
    setMemoryData((prev) => ({
      ...prev,
      keyEvents: prev.keyEvents.filter((_, i) => i !== index),
    }));
  };

  const addKeyEvent = () => {
    setMemoryData((prev) => ({
      ...prev,
      keyEvents: [...prev.keyEvents, ""],
    }));
  };

  // Handle save action
  const handleSave = async () => {
    setSaving(true);

    try {
      if (!memoryData.summary.trim()) {
        toast.error("Summary cannot be empty");
        setSaving(false);
        return;
      }

      // Update chapter summary
      const { error: chapterError } = await supabase
        .from("chapters")
        .update({ memory_summary: memoryData.summary })
        .eq("id", chapterId);

      if (chapterError) {
        console.error("Error updating chapter summary:", chapterError);
        toast.error("Failed to update chapter summary");
        setSaving(false);
        return;
      }

      // Create memory entry
      const { error: memoryError } = await supabase
        .from("memory_entries")
        .insert({
          series_id: seriesId,
          chapter_id: chapterId,
          content: memoryData.summary,
          tags: memoryData.tags,
          key_events: memoryData.keyEvents.filter((event) => event.trim()),
        });

      if (memoryError) {
        console.error("Error creating memory entry:", memoryError);
        toast.error("Failed to create memory entry");
        setSaving(false);
        return;
      }

      toast.success("Memory saved successfully");
      onSaved();
    } catch (error) {
      console.error("Error saving memory:", error);
      toast.error("Failed to save memory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Memory Assistant</CardTitle>
        <CardDescription>
          I've summarized this chapter and identified key events. Review and
          edit this information before saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Analyzing chapter content...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="summary">Chapter Summary</Label>
              <Textarea
                id="summary"
                value={memoryData.summary}
                onChange={(e) => updateSummary(e.target.value)}
                placeholder="Chapter summary"
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                A concise 2-3 sentence summary of key events.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {memoryData.tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(index)}
                  >
                    {tag} ×
                  </Badge>
                ))}
                <input
                  type="text"
                  placeholder="Add tag..."
                  className="px-2 py-1 text-sm border rounded-md w-24 h-6"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Keywords for memory filtering. Click a tag to remove it.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Key Events</Label>
              {memoryData.keyEvents.map((event, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Textarea
                    value={event}
                    onChange={(e) => updateKeyEvent(index, e.target.value)}
                    placeholder="Describe a key event"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeKeyEvent(index)}
                    className="h-8 w-8 p-0"
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addKeyEvent}
                className="mt-2"
              >
                Add Event
              </Button>
              <p className="text-xs text-muted-foreground">
                Important events to remember for future chapters.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Skip
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !memoryData.summary.trim()}
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Memory"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
