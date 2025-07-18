"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
  import {
  getUserProfile,
  hasAccess,
  getAccessibleSeries,
  isAdmin,
} from "@/lib/auth";
import { Series, Profile } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeriesCard } from "@/components/series/series-card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Loader, Plus, Search } from "lucide-react";
import supabase from "@/lib/supabase";
import { DeleteSeriesDialog } from "@/components/series/delete-series-dialog";

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteSeriesId, setDeleteSeriesId] = useState<string | null>(null);
  const [deleteSeriesName, setDeleteSeriesName] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const deletionCompleted = useRef(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  useEffect(() => {
    const checkAccess = async () => {
      const access = await hasAccess("translator");
      const admin = await isAdmin();
      setHasPermission(access);
      setIsAdminUser(admin);
      const profile = await getUserProfile();
      setUser(profile);

      if (access) {
        await fetchSeries();
      }

      setIsLoading(false);
    };

    checkAccess();
  }, []);

  useEffect(() => {
    if (isDeleteDialogOpen) {
      deletionCompleted.current = false;
    } else if (deletionCompleted.current) {
      fetchSeries();
      deletionCompleted.current = false;
    }
  }, [isDeleteDialogOpen]);

  const fetchSeries = async () => {
    setIsLoading(true);
    try {
      const data = await getAccessibleSeries();
      if (data) {
        setSeries(data as unknown as Series[]);
      }
    } catch (error) {
      console.error("Error fetching accessible series:", error);
      setSeries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSuccess = () => {
    deletionCompleted.current = true;
    setDeleteSeriesId(null);
    setIsDeleteDialogOpen(false);
  };

  const filteredSeries = series.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description &&
        s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            <p>
              You need translator or admin access to view and manage series.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Series</h1>
            <p className="text-muted-foreground mt-2">
              Manage your translation series and glossaries
            </p>
          </div>
          {isAdminUser && (
            <Button onClick={() => router.push("/series/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create new series
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredSeries.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No series found matching your search."
                  : "No series found. Create your first series to get started."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredSeries.map((s) => (
              <SeriesCard
                key={s.id}
                series={s}
                user={user}
                isAdmin={isAdminUser}
                onDelete={(id) => {
                  const seriesItem = series.find((item) => item.id === id);
                  setDeleteSeriesId(id);
                  setDeleteSeriesName(seriesItem?.name || "Unknown Series");
                  setIsDeleteDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteSeriesDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeleteSeriesId(null);
        }}
        onDeleteSuccess={handleDeleteSuccess}
        seriesId={deleteSeriesId || ""}
        seriesName={deleteSeriesName}
      />
    </div>
  );
}
