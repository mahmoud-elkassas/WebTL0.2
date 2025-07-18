"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Series } from "@/types";
import { useRouter } from "next/navigation";
import { PenIcon, BookOpenIcon, Trash2Icon, BookIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Profile } from "@/types";
import { useState, useEffect } from "react";
import { canDeleteSeries, canEditSeries } from "@/lib/auth";

interface SeriesCardProps {
  series: Series;
  user: Profile | null;
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

export function SeriesCard({
  series,
  user,
  isAdmin,
  onDelete,
}: SeriesCardProps) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) {
        setCanEdit(false);
        setCanDelete(false);
        setIsCheckingPermissions(false);
        return;
      }

      try {
        const [editPermission, deletePermission] = await Promise.all([
          canEditSeries(series.id),
          canDeleteSeries(series.id),
        ]);

        setCanEdit(editPermission);
        setCanDelete(deletePermission);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setCanEdit(false);
        setCanDelete(false);
      } finally {
        setIsCheckingPermissions(false);
      }
    };

    checkPermissions();
  }, [series.id, user]);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle
              className="text-xl cursor-pointer hover:underline"
              onClick={() => router.push(`/series/${series.id}`)}
            >
              {series.name}
            </CardTitle>
            <CardDescription>
              {series.source_language}
            </CardDescription>
            {(series.genre && series.genre.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.isArray(series.genre) ? (
                  series.genre.map((g) => (
                    <Badge key={g} variant="outline" className="text-xs">
                      {g}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {series.genre}
                  </Badge>
                )}
              </div>
            )}
            <Badge variant="secondary" className="mt-1">
              {series.chapter_count || 0} chapters
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className="cursor-pointer"
        onClick={() => router.push(`/series/${series.id}`)}
      >
        <p className="text-sm text-muted-foreground line-clamp-2">
          {series.description || "No description available"}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between pt-2 border-t">
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/translate?series=${series.id}`)}
          >
            <BookOpenIcon className="h-4 w-4 mr-2" />
            Translate
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/series/${series.id}/chapters`)}
          >
            <BookIcon className="h-4 w-4 mr-2" />
            Chapters
          </Button>
        </div>

        <div className="flex space-x-2">
          {!isCheckingPermissions && canEdit && isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/series/${series.id}/edit`)}
            >
              <PenIcon className="h-4 w-4" />
            </Button>
          )}

          {!isCheckingPermissions && canDelete && onDelete && isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(series.id)}
            >
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
