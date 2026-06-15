import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── Class Merging ─────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Currency Formatting ───────────────────────────────────────────────────────

/**
 * Format a number as Indonesian Rupiah.
 * Pass `compact = true` for short forms like "Rp15jt", "Rp500rb".
 */
export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    if (abs >= 1_000_000_000) return `${sign}Rp${(abs / 1_000_000_000).toFixed(1)}M`
    if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toFixed(1)}jt`
    if (abs >= 1_000) return `${sign}Rp${(abs / 1_000).toFixed(0)}rb`
    return `${sign}Rp${abs.toFixed(0)}`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Date Formatting ───────────────────────────────────────────────────────────

/**
 * Format a date string or Date object.
 * - 'short'    → "07 Jun 2026"
 * - 'long'     → "Sabtu, 07 Juni 2026"
 * - 'relative' → "2 hari lalu", "Hari ini", "Besok", etc.
 */
export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'relative' = 'short',
): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (format === 'relative') {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffMs = targetStart.getTime() - todayStart.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hari ini'
    if (diffDays === 1) return 'Besok'
    if (diffDays === -1) return 'Kemarin'
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} hari lagi`
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} hari lalu`
    if (diffDays > 7 && diffDays <= 30) return `${Math.floor(diffDays / 7)} minggu lagi`
    if (diffDays < -7 && diffDays >= -30) return `${Math.floor(Math.abs(diffDays) / 7)} minggu lalu`
    if (diffDays > 30) return `${Math.floor(diffDays / 30)} bulan lagi`
    return `${Math.floor(Math.abs(diffDays) / 30)} bulan lalu`
  }

  if (format === 'long') {
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  // short
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Percentage ────────────────────────────────────────────────────────────────

/**
 * Calculate what percentage `part` is of `total`.
 * Returns 0 if total is 0 to avoid division-by-zero.
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100 * 10) / 10
}

// ─── Days Until ────────────────────────────────────────────────────────────────

/**
 * Return the number of whole days from today until the given date.
 * Negative values mean the date is in the past.
 */
export function daysUntil(dateStr: string): number {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(dateStr)
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const diffMs = targetStart.getTime() - todayStart.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

// ─── ID Generation ─────────────────────────────────────────────────────────────

/**
 * Generate a unique ID using crypto.randomUUID when available,
 * falling back to a timestamp + random suffix.
 */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Days to Save ──────────────────────────────────────────────────────────────

/**
 * Calculate how many days it takes to save up `price` if `dailyDisposable`
 * is set aside each day. Returns Infinity if dailyDisposable <= 0.
 */
export function daysToSave(price: number, dailyDisposable: number): number {
  if (dailyDisposable <= 0) return Infinity
  return Math.ceil(price / dailyDisposable)
}

// ─── Budget Color ──────────────────────────────────────────────────────────────

/**
 * Return a CSS color string based on how much of a budget has been used.
 * < 60%   → green  (success)
 * 60–80%  → yellow (warning)
 * 80–100% → orange
 * > 100%  → red    (danger)
 */
export function getBudgetColor(pct: number): string {
  if (pct > 100) return '#ef4444'   // danger
  if (pct > 80) return '#f97316'    // orange
  if (pct > 60) return '#f59e0b'    // warning
  return '#22c55e'                  // success
}

// ─── Misc Helpers ──────────────────────────────────────────────────────────────

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Sum an array of numbers. */
export function sumBalances(balances: number[]): number {
  return balances.reduce((acc, b) => acc + b, 0)
}

/** Truncate a string to `maxLen` characters, appending "…" if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/** Format a number as a compact percentage string, e.g. "73.5%" */
export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/** Safely parse a date string; returns null on invalid input. */
export function parseDate(str: string): Date | null {
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

/** Group an array of items with a `date` field by their date string (YYYY-MM-DD). */
export function groupByDate<T extends { date: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.date.split('T')[0]
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return map
}
