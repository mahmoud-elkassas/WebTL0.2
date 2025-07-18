"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Save } from "lucide-react";
import { useState } from "react";

interface TranslationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  translationText: string;
  onSave: () => void;
}

export function TranslationPreviewModal({
  isOpen,
  onClose,
  translationText,
  onSave,
}: TranslationPreviewModalProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    onSave();
    // We don't reset saving state here as the parent component will close the modal
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Final Translation Preview</DialogTitle>
          <DialogDescription>
            Review your final translation before saving to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg border dark:border-gray-700 font-mono text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100 max-h-[60vh] overflow-y-auto">
            {translationText || "No translation text available"}
          </div>
        </div>

        <DialogFooter className="flex justify-between mt-6">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Back to Editing
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying Quality...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Translation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
