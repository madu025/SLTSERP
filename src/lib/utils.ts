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

/**
 * Format date and time in Sri Lanka Standard Time (Asia/Colombo - UTC+5:30)
 */
export function formatSLTDateTime(dateInput: Date | string | number | null | undefined, fallback: string = '-'): string {
  if (!dateInput) return fallback;
  const date = new Date(dateInput);
  if (!isValid(date)) return fallback;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Format date only in Sri Lanka Standard Time (Asia/Colombo - UTC+5:30)
 */
export function formatSLTDate(dateInput: Date | string | number | null | undefined, fallback: string = '-'): string {
  if (!dateInput) return fallback;
  const date = new Date(dateInput);
  if (!isValid(date)) return fallback;

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}


