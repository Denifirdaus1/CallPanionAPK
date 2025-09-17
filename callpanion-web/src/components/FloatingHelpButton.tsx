import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpModal } from "./HelpModal";

export function FloatingHelpButton() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsHelpOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-primary hover:bg-primary/90"
        aria-label="Open help"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <HelpModal 
        open={isHelpOpen} 
        onOpenChange={setIsHelpOpen} 
      />
    </>
  );
}