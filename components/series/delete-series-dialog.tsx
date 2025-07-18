"use client";

import { useState, useEffect } from "react";
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
import { deleteSeries, verifySeriesDeletion } from "@/lib/series";
import { useRouter } from "next/navigation";

interface DeleteSeriesDialogProps {
  open: boolean;
  onClose: () => void;
  onDeleteSuccess?: () => void;
  seriesId: string;
  seriesName: string;
}

export function DeleteSeriesDialog({
  open,
  onClose,
  onDeleteSuccess,
  seriesId,
  seriesName,
}: DeleteSeriesDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{
    canDelete: boolean;
    issues: string[];
  } | null>(null);
  const router = useRouter();

  // Verify deletion when dialog opens
  useEffect(() => {
    if (open) {
      verifyDeletion();
    }
  }, [open]);

  // Check if series can be safely deleted
  const verifyDeletion = async () => {
    setIsVerifying(true);
    try {
      const result = await verifySeriesDeletion(seriesId);
      setVerificationResult(result);
    } catch (error) {
      console.error("Error verifying series deletion:", error);
      setVerificationResult({
        canDelete: false,
        issues: ["Unexpected error during verification"],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle the deletion
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteSeries(seriesId);
      if (success) {
        toast.success(`Series "${seriesName}" deleted successfully`);
        // Close the dialog first
        onClose();
        // Add a small delay before refreshing to ensure state updates properly
        setTimeout(() => {
          router.refresh();
        }, 300);
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      } else {
        toast.error(`Failed to delete series "${seriesName}"`);
      }
    } catch (error) {
      console.error("Error deleting series:", error);
      toast.error("An error occurred during deletion");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Series: {seriesName}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Are you sure you want to delete this
            series and all its associated data?
          </DialogDescription>
        </DialogHeader>

        {isVerifying ? (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Verifying series dependencies...
            </p>
          </div>
        ) : (
          <div className="py-4">
            {verificationResult && verificationResult.issues.length > 0 && (
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle className="h-5 w-5" />
                  <h4 className="font-medium">Warning</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  The following items will be permanently deleted:
                </p>
                <ul className="text-sm list-disc pl-4 space-y-1">
                  {verificationResult.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {verificationResult && verificationResult.issues.length === 0 && (
              <div className="flex items-center gap-2 text-green-500">
                <Check className="h-5 w-5" />
                <p className="text-sm">No associated data found.</p>
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
              isDeleting || isVerifying || !verificationResult?.canDelete
            }
          >
            {isDeleting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Series"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
