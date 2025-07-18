"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Series, Genre, SourceLanguage } from "@/types";
import supabase from "@/lib/supabase";
import { generateMemorySummary } from "@/lib/api/summary";
import { Loader, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SeriesFormProps {
  series?: Series;
}

const formSchema = z.object({
  name: z.string().min(1, { message: "Series name is required" }),
  description: z.string().optional(),
  sourceLanguage: z.string(),
  genres: z.array(z.string()).min(1, { message: "Select at least one genre" }),
  toneNotes: z.string().optional(),
  memorySummary: z.string().optional(),
});

const genres: Genre[] = [
  "Shounen",
  "Shoujo",
  "Seinen",
  "Josei",
  "Action",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Murim/Wuxia",
  "Isekai",
  "Cyberpunk",
  "Other",
];

const genreOptions = genres.map((genre) => ({
  label: genre,
  value: genre,
}));

export function SeriesForm({ series }: SeriesFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const router = useRouter();

  const defaultGenres = series?.genre || [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: series?.name || "",
      description: series?.description || "",
      sourceLanguage: series?.source_language || "Korean",
      genres: Array.isArray(defaultGenres) ? defaultGenres : [],
      toneNotes: series?.tone_notes || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      if (series) {
        // Update existing series
        const { error } = await supabase
          .from("series")
          .update({
            name: values.name,
            description: values.description,
            source_language: values.sourceLanguage as SourceLanguage,
            genre: values.genres as string[],
            tone_notes: values.toneNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", series.id);

        if (error) throw error;
        toast.success("Series updated successfully");
      } else {
        // Get current user's session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          throw new Error("No authenticated user");
        }

        // Create new series
        const { error } = await supabase.from("series").insert({
          name: values.name,
          description: values.description,
          source_language: values.sourceLanguage as SourceLanguage,
          genre: values.genres as string[],
          tone_notes: values.toneNotes,
          created_by: sessionData.session.user.id,
        });

        if (error) throw error;
        toast.success("Series created successfully");
      }

      router.push("/series");
      router.refresh();
    } catch (error) {
      console.error("Error saving series:", error);
      toast.error("Failed to save series");
    } finally {
      setIsLoading(false);
    }
  }

  const handleGenerateMemorySummary = async () => {
    const name = form.getValues("name");
    const description = form.getValues("description") || "";
    const selectedGenres = form.getValues("genres");

    if (!name) {
      toast.error("Please enter a series name first");
      return;
    }

    if (selectedGenres.length === 0) {
      toast.error("Please select at least one genre");
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const summary = await generateMemorySummary(
        name,
        description,
        selectedGenres
      );

      if (summary) {
        form.setValue("memorySummary", summary);
        toast.success("Memory summary generated");
      } else {
        toast.error("Failed to generate summary");
      }
    } catch (error) {
      console.error("Error generating memory summary:", error);
      toast.error("Error generating memory summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Series Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter series name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="sourceLanguage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source Language</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Korean">Korean</SelectItem>
                    <SelectItem value="Japanese">Japanese</SelectItem>
                    <SelectItem value="Chinese">Chinese</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="genres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Genres (select multiple)</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={genreOptions}
                    selected={field.value}
                    onChange={field.onChange}
                    placeholder="Select genres"
                  />
                </FormControl>
                <FormDescription>
                  Genres help determine translation style and terms
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief description of the series"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="toneNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Special notes about translation tone, style, or character speech patterns"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                These notes will guide the AI to maintain consistent tone and
                style
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="memorySummary"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Memory Summary</FormLabel>
                {/* <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingSummary}
                  onClick={handleGenerateMemorySummary}
                >
                  {isGeneratingSummary ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button> */}
              </div>
              <FormControl>
                <Textarea
                  className="h-32"
                  placeholder="AI-generated memory summary to guide translation context"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormDescription>
                This summary helps the AI understand the series context for more
                accurate translations
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Series"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
