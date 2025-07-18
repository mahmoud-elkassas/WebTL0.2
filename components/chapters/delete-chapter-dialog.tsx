"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader, AlertCircle, Check } from "lucide-react";
import { deleteChapter, verifyChapterDeletion } from "@/lib/chapter";
import { useRouter } from "next/navigation";

interface DeleteChapterDialogProps {
  open: boolean;
  onClose: () => void;
  chapterId: string;
  chapterNumber: string;
  seriesId: string;
}

export function DeleteChapterDialog({
  open,
  onClose,
  chapterId,
  chapterNumber,
  seriesId,
}: DeleteChapterDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{
    canDelete: boolean;
    issues: string[];
  } | null>(null);
  const router = useRouter();

  // Check if chapter can be safely deleted
  const verifyDeletion = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyChapterDeletion(chapterId);
      setVerificationResult(result);
    } catch (error) {
      console.error("Error verifying chapter deletion:", error);
      setVerificationResult({
        canDelete: false,
        issues: ["Unexpected error during verification"],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Call verification on first render
  useState(() => {
    if (open) {
      verifyDeletion();
    }
  });

  // Handle the deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteChapter(chapterId);
      if (success) {
        toast.success(`Chapter ${chapterNumber} deleted successfully`);
        router.refresh(); // Refresh the page to update the UI
        onClose();
      } else {
        toast.error(`Failed to delete chapter ${chapterNumber}`);
      }
    } catch (error) {
      console.error("Error deleting chapter:", error);
      toast.error("An error occurred during deletion");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Chapter {chapterNumber}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Are you sure you want to delete this
            chapter and all its associated data?
          </DialogDescription>
        </DialogHeader>

        {isVerifying ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Verifying chapter dependencies...
            </p>
          </div>
        ) : (
          <div className="py-4">
            {verificationResult && (
              <div className="space-y-4">
                {verificationResult.canDelete ? (
                  <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-md border border-amber-200">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-amber-700">
                        Warning
                      </p>
                      <p className="text-sm text-amber-600">
                        The following data will be deleted:
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-amber-600 list-disc list-inside">
                        {verificationResult.issues.length > 0 ? (
                          verificationResult.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))
                        ) : (
                          <li>Chapter {chapterNumber}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-red-50 p-3 rounded-md border border-red-200">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-red-700">
                        Cannot Delete
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-red-600 list-disc list-inside">
                        {verificationResult.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              isDeleting ||
              isVerifying ||
              !verificationResult?.canDelete
            }
          >
            {isDeleting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Chapter"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 