import { useState } from "react";
import { Flag, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReportContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: 'photo' | 'message' | 'other';
  contentId: string;
  contentPreview?: string;
}

const reportReasons = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam', label: 'Spam or unwanted content' },
  { value: 'privacy', label: 'Privacy violation' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'other', label: 'Other' },
];

export default function ReportContentDialog({ 
  open, 
  onOpenChange, 
  contentType, 
  contentId, 
  contentPreview 
}: ReportContentDialogProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmitReport = async () => {
    if (!reason) {
      toast({
        title: "Reason required",
        description: "Please select a reason for reporting this content.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('submit-content-report', {
        body: {
          reportedBy: user?.id,
          contentType,
          contentId,
          reason,
          description,
          contentPreview: contentPreview?.substring(0, 200) // Limit preview length
        }
      });

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: "Thank you for reporting this content. We'll review it promptly.",
      });

      onOpenChange(false);
      setReason("");
      setDescription("");
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast({
        title: "Report failed",
        description: error.message || "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="report-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report Content
          </DialogTitle>
          <DialogDescription id="report-description">
            Help us keep CallPanion safe by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {contentPreview && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Content being reported:</p>
              <p className="text-sm truncate">{contentPreview}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for reporting</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reportReasons.map((reportReason) => (
                  <SelectItem key={reportReason.value} value={reportReason.value}>
                    {reportReason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context about why you're reporting this content..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReport}
            disabled={isSubmitting || !reason}
            className="gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}