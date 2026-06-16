import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeFormat(dateInput: Date | string | number | null | undefined, formatStr: string, fallback: string = '-'): string {
  if (!dateInput) return fallback;
  const date = new Date(dateInput);
  return isValid(date) ? format(date, formatStr) : fallback;
}

