"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserProfile, hasAccess } from "@/lib/auth";
import { Series, GlossaryTerm, Profile } from "@/types";
import {
  Loader,
  Plus,
  Search,
  PenLine,
  Trash2,
  Eye,
  Filter,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import supabase from "@/lib/supabase";
import { GlossaryTermDetails } from "./glossary-term-details";
import { HonorificsReference } from "./honorifics-reference";
import { getEnhancedGlossaryJson } from "@/lib/glossary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface GlossaryPageProps {
  seriesId: string;
}

export function GlossaryPage({ seriesId }: GlossaryPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [enhancedGlossary, setEnhancedGlossary] = useState<Record<string, any>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<Profile | null>(null);
  const [deleteTermId, setDeleteTermId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const router = useRouter();

  const loadGlossaryData = async () => {
    try {
      // Fetch glossary terms
      const { data: glossaryData, error: glossaryError } = await supabase
        .from("glossaries")
        .select("*")
        .eq("series_id", seriesId)
        .order("source_term");

      if (glossaryError) {
        console.error("Error fetching glossary terms:", glossaryError);
        toast.error("Failed to load glossary terms");
        setGlossaryTerms([]);
      } else if (glossaryData) {
        setGlossaryTerms(glossaryData as unknown as GlossaryTerm[]);
      } else {
        setGlossaryTerms([]);
      }

      try {
        // Fetch enhanced glossary data
        const enhancedData = await getEnhancedGlossaryJson(seriesId);
        if (enhancedData && typeof enhancedData === "object") {
          setEnhancedGlossary(enhancedData);
        } else {
          console.warn("Enhanced glossary data is not in expected format");
          setEnhancedGlossary({});
        }
      } catch (enhancedError) {
        console.error("Error loading enhanced glossary data:", enhancedError);
        toast.error("Failed to load enhanced glossary data");
        setEnhancedGlossary({});
      }
    } catch (error) {
      console.error("Error loading glossary data:", error);
      toast.error("Failed to load glossary data");
      setGlossaryTerms([]);
      setEnhancedGlossary({});
    }
  };

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      const access = await hasAccess("translator");
      setHasPermission(access);

      const profile = await getUserProfile();
      setUser(profile);

      if (access) {
        // Fetch series
        const { data: seriesData, error: seriesError } = await supabase
          .from("series")
          .select("*")
          .eq("id", seriesId)
          .single();

        if (seriesError || !seriesData) {
          router.push("/series");
          return;
        }

        setSeries(seriesData as unknown as Series);

        // Check if user can manage this series glossary
        const isAdmin = profile?.role === "admin";
        const isCreator = profile?.id === seriesData.created_by;

        if (!isAdmin && !isCreator) {
          setHasPermission(false);
        }

        await loadGlossaryData();
      }

      setIsLoading(false);
    };

    checkAccessAndLoadData();
  }, [seriesId, router]);

  const handleRefreshGlossary = async () => {
    setIsRefreshing(true);
    try {
      // Execute a query to refresh the glossary_json
      const { error } = await supabase.rpc("update_series_glossary_json", {
        series_id: seriesId,
      });

      if (error) {
        console.error("Error refreshing glossary:", error);
        toast.error("Failed to refresh glossary: " + error.message);
        return;
      }

      // Reload the glossary data
      try {
        await loadGlossaryData();
        toast.success("Glossary refreshed successfully");
      } catch (loadError) {
        console.error("Error reloading glossary data:", loadError);
        toast.error("Glossary refreshed but failed to reload data");
      }
    } catch (error: any) {
      console.error("Error refreshing glossary:", error);
      toast.error(
        "Failed to refresh glossary: " + (error.message || "Unknown error")
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteTerm = async () => {
    if (!deleteTermId) return;

    try {
      const { error } = await supabase
        .from("glossaries")
        .delete()
        .eq("id", deleteTermId);

      if (error) throw error;

      setGlossaryTerms(
        glossaryTerms.filter((term) => term.id !== deleteTermId)
      );
      toast.success("Term deleted successfully");

      // Refresh the enhanced glossary data
      await loadGlossaryData();
    } catch (error) {
      console.error("Error deleting term:", error);
      toast.error("Failed to delete term");
    } finally {
      setDeleteTermId(null);
      setIsDeleteDialogOpen(false);
    }
  };

  // Enhance glossary terms with data from enhanced glossary
  const enhancedGlossaryTerms = glossaryTerms.map((term) => {
    // Safely access enhanced glossary data
    const enhancedData =
      enhancedGlossary && typeof enhancedGlossary === "object"
        ? enhancedGlossary[term.source_term] || {}
        : {};

    return {
      ...term,
      // Fill in any missing metadata from the enhanced glossary
      term_type: term.term_type || enhancedData.term_type,
      entity_type: term.entity_type || enhancedData.entity_type,
      gender: term.gender || enhancedData.gender,
      // Handle both role and character_role fields
      character_role:
        term.character_role ||
        term.role ||
        enhancedData.character_role ||
        enhancedData.role,
      language: term.language || enhancedData.language,
      character_tone: term.character_tone || enhancedData.character_tone,
      notes: term.notes || enhancedData.notes,
    };
  });

  const filteredTerms = enhancedGlossaryTerms.filter((term) => {
    const matchesSearch = searchQuery
      ? (term.source_term || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (term.translated_term || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true;

    const matchesFilter =
      !filterType ||
      term.term_type === filterType ||
      (filterType === "Honorific" &&
        ((term.term_type && term.term_type.includes("Honorific")) ||
          term.term_type === "Family Relation" ||
          term.term_type === "Formal Title"));

    return matchesSearch && matchesFilter;
  });

  // Safely collect unique term types
  const uniqueTermTypes = Array.from(
    new Set(enhancedGlossaryTerms.map((term) => term.term_type).filter(Boolean))
  );

  const handleSelectTerm = (termId: string, checked: boolean) => {
    const newSelected = new Set(selectedTerms);
    if (checked) {
      newSelected.add(termId);
    } else {
      newSelected.delete(termId);
    }
    setSelectedTerms(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTerms(new Set(filteredTerms.map((term) => term.id)));
    } else {
      setSelectedTerms(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTerms.size === 0) {
      toast.error("No terms selected");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("glossaries")
        .delete()
        .in("id", Array.from(selectedTerms));

      if (error) throw error;

      setGlossaryTerms(
        glossaryTerms.filter((term) => !selectedTerms.has(term.id))
      );
      setSelectedTerms(new Set());
      toast.success(`${selectedTerms.size} term(s) deleted successfully`);

      // Refresh the enhanced glossary data
      await loadGlossaryData();
    } catch (error) {
      console.error("Error deleting terms:", error);
      toast.error("Failed to delete terms");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission || !series) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You don't have permission to manage this glossary.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/series")}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  console.log(glossaryTerms);
  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Glossary: {series.name}
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage glossary terms for consistent translations
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HonorificsReference />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshGlossary}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Glossary"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/series/${seriesId}/edit`)}
            >
              Edit Series
            </Button>
            <Button
              onClick={() => router.push(`/series/${seriesId}/glossary/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Term
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search glossary terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              value={filterType || "all"}
              onValueChange={(value) =>
                setFilterType(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="Honorific">All Honorifics</SelectItem>
                {uniqueTermTypes.map(
                  (type) =>
                    type && (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedTerms.size > 0 && (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedTerms.size})
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {filteredTerms.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || filterType
                    ? "No terms found matching your filters."
                    : "No glossary terms found. Add your first term to get started."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedTerms.size === filteredTerms.length &&
                          filteredTerms.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all terms"
                      />
                    </TableHead>
                    <TableHead>Source Term</TableHead>
                    <TableHead>Translation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead className="w-[130px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTerms.map((term) => (
                    <TableRow
                      key={term.id}
                      className={
                        selectedTerms.has(term.id) ? "bg-muted/50" : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedTerms.has(term.id)}
                          onCheckedChange={(checked) =>
                            handleSelectTerm(term.id, checked as boolean)
                          }
                          aria-label={`Select term ${term.source_term}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {term.source_term}
                      </TableCell>
                      <TableCell>{term.translated_term}</TableCell>
                      <TableCell>
                        {term.term_type ? (
                          <Badge
                            variant="outline"
                            className={
                              term.term_type.includes("Honorific") ||
                              term.term_type === "Family Relation" ||
                              term.term_type === "Formal Title"
                                ? "bg-amber-50 text-amber-900 hover:bg-amber-100"
                                : ""
                            }
                          >
                            {term.term_type}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {term.source_term.match(/[가-힣]/)
                              ? "Korean Term"
                              : "Unknown"}
                          </Badge>
                        )}
                        {term.gender &&
                          (term.term_type === "Character Name" ||
                            !term.term_type) && (
                            <Badge
                              variant="outline"
                              className="ml-1 bg-blue-50 text-blue-900 hover:bg-blue-100"
                            >
                              {term.gender || "Unknown"}
                            </Badge>
                          )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {term.character_role ? (
                          <Badge
                            variant="secondary"
                            className="bg-gray-100 text-gray-800 hover:bg-gray-200"
                          >
                            {term.character_role}
                          </Badge>
                        ) : term.role ? (
                          <Badge
                            variant="secondary"
                            className="bg-gray-100 text-gray-800"
                          >
                            {term.role}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-gray-100 text-gray-800"
                          >
                            Unknown
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <GlossaryTermDetails term={term} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/series/${seriesId}/glossary/${term.id}/edit`
                              )
                            }
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setDeleteTermId(term.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Glossary Term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this term? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTerm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Multiple Glossary Terms</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTerms.size} term(s)? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Terms"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
