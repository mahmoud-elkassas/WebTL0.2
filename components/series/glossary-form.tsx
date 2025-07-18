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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  GlossaryTerm,
  TermType,
  EntityType,
  Gender,
  CharacterRole,
  SourceLanguage,
} from "@/types";
import supabase from "@/lib/supabase";

interface GlossaryFormProps {
  seriesId: string;
  term?: GlossaryTerm;
}

const formSchema = z.object({
  sourceTerm: z.string().min(1, { message: "Source term is required" }),
  translatedTerm: z.string().min(1, { message: "Translated term is required" }),
  term_type: z.string().optional(),
  characterTone: z.string().optional(),
  notes: z.string().optional(),
  entityType: z.string().optional(),
  gender: z.string().optional(),
  characterRole: z.string().optional(),
  language: z.string().optional(),
});

const termTypes: TermType[] = [
  "Character Name",
  "Location",
  "Item",
  "Skill/Technique",
  "Organization",
  "Sound Effect",
  "Honorific - Korean",
  "Honorific - Chinese",
  "Honorific - Japanese",
  "Family Relation",
  "Formal Title",
  "Cultural Term",
  "Other",
];

const entityTypes: EntityType[] = [
  "Person",
  "Place",
  "Technique",
  "Organization",
  "Item",
  "Term",
];

const genderOptions: Gender[] = ["Male", "Female", "Unknown"];

const characterRoles: CharacterRole[] = [
  "Protagonist",
  "Antagonist",
  "Supporting Character",
  "Minor Character",
  "Villain",
  "Mentor",
  "Family Member",
  "Love Interest",
  "Other",
];

const languages: SourceLanguage[] = ["Korean", "Japanese", "Chinese"];

export function GlossaryForm({ seriesId, term }: GlossaryFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceTerm: term?.source_term || "",
      translatedTerm: term?.translated_term || "",
      term_type: term?.term_type || "Character Name",
      characterTone: term?.character_tone || "",
      notes: term?.notes || "",
      entityType: term?.entity_type || "Person",
      gender: term?.gender || "Unknown",
      characterRole: term?.character_role || "",
      language: term?.language || "",
    },
  });

  // Get the current term type value to conditionally show fields
  const currentTermType = form.watch("term_type");
  const isCharacter = currentTermType === "Character Name";
  const isHonorific =
    currentTermType?.includes("Honorific") ||
    currentTermType === "Family Relation" ||
    currentTermType === "Formal Title";

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      if (term) {
        // Update existing term
        const { error } = await supabase
          .from("glossaries")
          .update({
            source_term: values.sourceTerm,
            translated_term: values.translatedTerm,
            term_type: values.term_type as TermType,
            character_tone: values.characterTone,
            notes: values.notes,
            entity_type: values.entityType as EntityType,
            gender: isCharacter ? (values.gender as Gender) : null,
            character_role: isCharacter
              ? (values.characterRole as CharacterRole)
              : null,
            language: values.language as SourceLanguage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", term.id);

        if (error) throw error;
        toast.success("Term updated successfully");
      } else {
        // Create new term
        const { error } = await supabase.from("glossaries").insert({
          series_id: seriesId,
          source_term: values.sourceTerm,
          translated_term: values.translatedTerm,
          term_type: values.term_type as TermType,
          character_tone: values.characterTone,
          notes: values.notes,
          entity_type: values.entityType as EntityType,
          gender: isCharacter ? (values.gender as Gender) : null,
          character_role: isCharacter
            ? (values.characterRole as CharacterRole)
            : null,
          language: values.language as SourceLanguage,
        });

        if (error) throw error;
        toast.success("Term added successfully");
      }

      router.push(`/series/${seriesId}/glossary`);
      router.refresh();
    } catch (error) {
      console.error("Error saving glossary term:", error);
      toast.error("Failed to save glossary term");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="sourceTerm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source Term</FormLabel>
                <FormControl>
                  <Input placeholder="Original term" {...field} />
                </FormControl>
                <FormDescription>
                  The original term in the source language
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="translatedTerm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Translated Term</FormLabel>
                <FormControl>
                  <Input placeholder="English translation" {...field} />
                </FormControl>
                <FormDescription>
                  How this term should be translated in English
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Details</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="space-y-6 pt-4">
              <FormField
                control={form.control}
                name="term_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select term type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {entityTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Categorize the term to help with organizing the glossary
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isCharacter && (
                <FormField
                  control={form.control}
                  name="characterTone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Character Tone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Brave and intense, Cold and formal"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        For character names, describe their personality and
                        speaking style
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional context or usage notes"
                        {...field}
                        value={field.value || ""}
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Any additional context or special rules for using this
                      term
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

        </Tabs>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : term ? "Update Term" : "Add Term"}
        </Button>
      </form>
    </Form>
  );
}
