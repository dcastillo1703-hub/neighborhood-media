import { cn } from "@/lib/utils";

type Option = {
  label: string;
  value: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
};

export function Select({ value, onChange, options, className }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-border/80 bg-card/72 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none transition duration-200 focus:border-primary/25 focus:ring-2 focus:ring-ring",
        className
      )}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
