import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface VisibilityBadgeProps {
  visibility: 'org' | 'private' | 'custom';
  className?: string;
}

export function VisibilityBadge({ visibility, className }: VisibilityBadgeProps) {
  const variants = {
    org: { label: 'Organisation', variant: 'default' as const },
    private: { label: 'Private', variant: 'secondary' as const },
    custom: { label: 'Custom', variant: 'outline' as const }
  };

  const { label, variant } = variants[visibility];

  return (
    <Badge variant={variant} className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}
