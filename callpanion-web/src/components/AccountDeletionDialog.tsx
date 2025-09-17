import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AccountDeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AccountDeletionDialog({ open, onOpenChange }: AccountDeletionDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const handleDeleteAccount = async () => {
    if (confirmationText !== "DELETE MY ACCOUNT") {
      toast({
        title: "Confirmation required",
        description: "Please type 'DELETE MY ACCOUNT' to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Call edge function to handle account deletion
      const { error } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user?.id }
      });

      if (error) throw error;

      toast({
        title: "Account deleted",
        description: "Your account and all associated data have been permanently deleted.",
      });

      // Sign out the user
      await signOut();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="deletion-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription id="deletion-description">
            This action cannot be undone. All your data will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>This will permanently delete:</strong>
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>Your account and profile information</li>
                <li>All family household data</li>
                <li>Relative information and call history</li>
                <li>Photos and messages</li>
                <li>All associated subscription data</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <code className="bg-muted px-1 py-0.5 rounded">DELETE MY ACCOUNT</code> to confirm:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeleting || confirmationText !== "DELETE MY ACCOUNT"}
            className="gap-2"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}