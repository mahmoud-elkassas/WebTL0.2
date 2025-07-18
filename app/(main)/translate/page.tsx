"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getUserProfile, hasAccess, getAccessibleSeries } from "@/lib/auth";
import {
  Series,
  GlossaryTerm,
  TranslationInput,
  GlossaryObject,
  MemoryEntry,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "lucide-react";
import supabase from "@/lib/supabase";
import { fetchGlossaryTerms } from "@/lib/glossary";
import { TranslationForm } from "@/components/translation/translation-form";

export const dynamic = "force-dynamic";

function TranslatePageContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [glossariesBySeriesId, setGlossariesBySeriesId] = useState<
    Record<string, GlossaryTerm[]>
  >({});

  const searchParams = useSearchParams();
  const seriesId = searchParams?.get("series") || null;
  const chapter = searchParams?.get("chapter") || null;

  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log("🔐 Checking user access...");
        const access = await hasAccess("translator");
        setHasPermission(access);

        if (access) {
          // Fetch accessible series instead of all series
          console.log("📚 Fetching accessible series...");
          try {
            const seriesData = await getAccessibleSeries();
            console.log(`✅ Fetched ${seriesData.length} accessible series`);
            setSeries(seriesData as unknown as Series[]);
          } catch (error) {
            console.error("❌ Error fetching accessible series:", error);
            setSeries([]);
          }
        }
      } catch (error) {
        console.error("❌ Error during initialization:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [seriesId]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You need translator or admin access to use this tool.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Translate</h1>
            <p className="text-muted-foreground mt-2">
              Translate webtoon content with tag preservation and AI assistance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-4">
            <Card>
              <CardContent className="pt-6">
                <TranslationForm series={series} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TranslatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center py-24">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TranslatePageContent />
    </Suspense>
  );
}
