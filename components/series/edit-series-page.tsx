"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeriesForm } from "@/components/series/series-form";
import { getUserProfile, hasAccess } from "@/lib/auth";
import { Series, Profile } from "@/types";
import { Loader } from "lucide-react";
import supabase from "@/lib/supabase";

interface EditSeriesPageProps {
  seriesId: string;
}

export function EditSeriesPage({ seriesId }: EditSeriesPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      const access = await hasAccess("translator");
      setHasPermission(access);

      const profile = await getUserProfile();
      setUser(profile);

      if (access) {
        const { data, error } = await supabase
          .from("series")
          .select("*")
          .eq("id", seriesId)
          .single();

        if (error || !data) {
          router.push("/series");
          return;
        }

        setSeries(data as Series);

        // Check if user can edit this series
        const isAdmin = profile?.role === "admin";
        const isCreator = profile?.id === data.created_by;
        console.log(isAdmin, isCreator);
        console.log(data);
        if (!isAdmin && !isCreator) {
          setHasPermission(false);
        }
      }

      setIsLoading(false);
    };

    checkAccessAndLoadData();
  }, [seriesId, router]);

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
            <p>You don't have permission to edit this series.</p>
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Series</h1>
            <p className="text-muted-foreground mt-2">
              Update the series details
            </p>
          </div>
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/series/${seriesId}/glossary`)}
            >
              Manage Glossary
            </Button>
            <Button variant="outline" onClick={() => router.push("/series")}>
              Cancel
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <SeriesForm series={series} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
