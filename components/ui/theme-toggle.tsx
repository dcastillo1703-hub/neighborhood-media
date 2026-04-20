"use client";

import { Moon, SunMedium } from "lucide-react";

import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  const { mode, toggleMode } = useTheme();
  const dark = mode === "dark";

  return (
    <button
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/85 text-foreground transition duration-200 hover:border-primary/25 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm",
        className
      )}
      type="button"
      onClick={toggleMode}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full transition",
          compact ? "h-6 w-6" : "h-7 w-7",
          dark ? "bg-[var(--app-accent-soft)] text-[var(--app-accent-bg)]" : "bg-muted text-muted-foreground"
        )}
      >
        {dark ? <Moon className="h-3.5 w-3.5" /> : <SunMedium className="h-3.5 w-3.5" />}
      </span>
      <span className={cn("font-medium", compact ? "hidden sm:inline" : "")}>
        {dark ? "Dark" : "Light"}
      </span>
    </button>
  );
}
