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

/**
 * Smart number formatting with auto-abbreviation for millions.
 * - Numbers >= 1,000,000: "X.XX Mn" (e.g., "494.57 Mn")
 * - Numbers < 1,000,000: Full formatted with commas (e.g., "999,999.99")
 */
export function formatSmartNumber(value: number | null | undefined, decimals: number = 2): string {
  const num = Number(value || 0);
  if (num === 0) return '0';
  
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)} Mn`;
  }
  
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format LKR currency with smart abbreviation.
 * - >= 1M: "LKR 494.57 Mn"
 * - < 1M: "LKR 999,999.99"
 */
export function formatLKR(value: number | null | undefined, decimals: number = 2): string {
  return `LKR ${formatSmartNumber(value, decimals)}`;
}

/**
 * Full-precision number formatting (no Mn abbreviation).
 * Use for reconciliation, ledgers, and exact-amount tables where every
 * decimal must be visible, e.g. "494,571,000.00".
 */
export function formatNumberExact(value: number | null | undefined, decimals: number = 2): string {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Full-precision LKR currency (no Mn abbreviation).
 * Use for reconciliation/exact amounts, e.g. "LKR 494,571,000.00".
 */
export function formatLKRExact(value: number | null | undefined, decimals: number = 2): string {
  return `LKR ${formatNumberExact(value, decimals)}`;
}


