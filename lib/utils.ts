import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function number(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function percent(value: number) {
  return `${value.toFixed(0)}%`;
}

export function formatShortDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const datePart = value.split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (match) {
    const [, year, month, day] = match;
    return `${Number(month)}-${Number(day)}-${year.slice(2)}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return `${parsed.getMonth() + 1}-${parsed.getDate()}-${String(parsed.getFullYear()).slice(2)}`;
}
