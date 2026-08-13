import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  tagline?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { word: "text-lg", tag: "text-[9px]" },
  md: { word: "text-2xl", tag: "text-[10px]" },
  lg: { word: "text-5xl", tag: "text-xs" },
};

export function CharmeLogo({ className, tagline = true, size = "md" }: Props) {
  const s = sizes[size];
  return (
    <div className={cn("flex flex-col items-center leading-none", className)}>
      <span className={cn("font-display font-bold tracking-[0.18em] text-foreground", s.word)}>
        CHARME
      </span>
      {tagline && (
        <span
          className={cn("font-serif-italic italic text-muted-foreground mt-1 tracking-wide", s.tag)}
        >
          beautify with confidence
        </span>
      )}
    </div>
  );
}
