import { cn, formatShortDate } from "@/lib/utils";

type DatePillProps = {
  value?: string | null;
  fallback?: string;
  className?: string;
};

export function DatePill({ value, fallback = "No date", className }: DatePillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-primary",
        className
      )}
    >
      {value ? formatShortDate(value) : fallback}
    </span>
  );
}
