import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Entry } from "@shared/schema";

interface AdminEntryControlsProps {
  entry: Entry;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function AdminEntryControls({ entry, onEdit, onDelete }: AdminEntryControlsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Check if entry is fully paid (no pending amount)
  const isFullyPaid = entry.status === "full";
  
  return (
    <div className="flex gap-2">
      {/* Edit functionality has been disabled */}
      <Button 
        variant="outline" 
        size="sm"
        className="text-neutral-400 flex items-center gap-1"
        disabled
        title="Edit entry functionality has been disabled"
      >
        <span className="material-icons text-sm">edit_off</span>
        Edit Entry
      </Button>
      
      {!isFullyPaid ? (
        <Button 
          variant="outline" 
          size="sm"
          className="text-red-600 flex items-center gap-1"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <span className="material-icons text-sm">delete</span>
          Delete
        </Button>
      ) : (
        <Button 
          variant="outline" 
          size="sm"
          className="text-neutral-400 flex items-center gap-1"
          disabled
          title="Fully paid entries cannot be deleted"
        >
          <span className="material-icons text-sm">delete_off</span>
          Delete
        </Button>
      )}
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete entry "{entry.description}" and all associated payment records.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (onDelete) onDelete();
                setShowDeleteConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}