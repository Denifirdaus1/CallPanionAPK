import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface WarmCardProps {
  children: ReactNode;
  className?: string;
  gradient?: "warmth" | "love" | "peace";
  hover?: boolean;
}

const WarmCard = ({ children, className, gradient, hover = true }: WarmCardProps) => {
  return (
    <Card
      className={cn(
        "p-6 shadow-warm border-0 transition-all duration-300",
        gradient && `bg-gradient-${gradient}`,
        !gradient && "bg-card",
        hover && "hover:shadow-lg hover:scale-[1.02]",
        className
      )}
    >
      {children}
    </Card>
  );
};

export default WarmCard;