"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import supabase from "@/lib/supabase";
import { Chapter } from "@/types";

interface ChapterSummaryProps {
  seriesId: string | null;
  chapterNumber: string | null;
}

export function ChapterSummary({
  seriesId,
  chapterNumber,
}: ChapterSummaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [chapter, setChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    const fetchChapterSummary = async () => {
      if (!seriesId || !chapterNumber) {
        setChapter(null);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("chapters")
          .select("*")
          .eq("series_id", seriesId)
          .eq("chapter_number", chapterNumber)
          .single();

        if (error) {
          console.error("Error fetching chapter summary:", error);
          setChapter(null);
        } else {
          setChapter(data as unknown as Chapter);
        }
      } catch (error) {
        console.error("Error in fetchChapterSummary:", error);
        setChapter(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChapterSummary();
  }, [seriesId, chapterNumber]);

  // Don't show anything if no series or chapter is selected
  if (!seriesId || !chapterNumber) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Chapter Memory</CardTitle>
        <CardDescription>
          Summary of previous events in this chapter
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : chapter?.summary ? (
          <p className="text-sm">{chapter.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No previous memory for this chapter yet. It will be generated after
            your first translation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
