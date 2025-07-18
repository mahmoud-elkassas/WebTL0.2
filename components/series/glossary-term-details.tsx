import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { GlossaryTerm } from "@/types";
import { format } from "date-fns";

interface GlossaryTermDetailsProps {
  term: GlossaryTerm;
}

export function GlossaryTermDetails({ term }: GlossaryTermDetailsProps) {
  const isCharacter = term.term_type === "Character Name";
  const isHonorific =
    term.term_type?.includes("Honorific") ||
    term.term_type === "Family Relation" ||
    term.term_type === "Formal Title";

  const createdDate = new Date(term.created_at);
  const updatedDate = new Date(term.updated_at);

  // Determine honorific usage guidance based on language
  const getHonorificGuidance = () => {
    if (!isHonorific) return null;

    let guidance =
      "This is a cultural honorific term. Keep the original form in translations rather than translating directly to English.";

    if (term.term_type === "Honorific - Korean") {
      guidance +=
        " Korean honorifics indicate social relationships and hierarchy, which are important cultural aspects.";
    } else if (term.term_type === "Honorific - Japanese") {
      guidance +=
        " Japanese honorifics reflect the relationship, age difference, and social status between speakers.";
    } else if (term.term_type === "Honorific - Chinese") {
      guidance +=
        " Chinese honorifics denote family relationships, respect, and social hierarchy.";
    } else if (term.term_type === "Family Relation") {
      guidance +=
        " Family relation terms should be preserved to maintain cultural nuances around family structure.";
    }

    return guidance;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {term.source_term}
          </DialogTitle>
          <DialogDescription>Glossary term details</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Source Term</p>
              <p className="font-medium">{term.source_term}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">Term Type</p>
              <Badge
                variant="outline"
                className={isHonorific ? "bg-amber-50 text-amber-900" : ""}
              >
                {term.term_type || "Unspecified"}
              </Badge>
            </div>

            {term.language && (
              <div>
                <p className="text-sm font-medium text-gray-500">Language</p>
                <Badge variant="secondary" className="bg-gray-100">
                  {term.language}
                </Badge>
              </div>
            )}

            {term.entity_type && (
              <div>
                <p className="text-sm font-medium text-gray-500">Entity Type</p>
                <p>{term.entity_type}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Translation</p>
              <p>{term.translated_term}</p>
            </div>

            {isCharacter && term.gender && (
              <div>
                <p className="text-sm font-medium text-gray-500">Gender</p>
                <Badge variant="outline" className="bg-blue-50 text-blue-900">
                  {term.gender}
                </Badge>
              </div>
            )}

            {isCharacter && term.character_role && (
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Character Role
                </p>
                <p>{term.character_role}</p>
              </div>
            )}

            {isCharacter && term.character_tone && (
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Character Tone
                </p>
                <p>{term.character_tone}</p>
              </div>
            )}
          </div>
        </div>

        {term.notes && (
          <div className="pt-4">
            <p className="text-sm font-medium text-gray-500">Notes</p>
            <p className="text-sm mt-1">{term.notes}</p>
          </div>
        )}

        {isHonorific && (
          <div className="pt-4 bg-amber-50 p-3 rounded-md border border-amber-200">
            <p className="text-sm font-medium text-amber-800">
              Honorific Usage
            </p>
            <p className="text-sm text-amber-700 mt-1">
              {getHonorificGuidance()}
            </p>
          </div>
        )}

        <div className="pt-4 border-t text-xs text-gray-500 flex justify-between mt-2">
          <span>Created: {format(createdDate, "PPP")}</span>
          <span>Updated: {format(updatedDate, "PPP")}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
