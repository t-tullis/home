export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the family's clock). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from today to the given date. Negative means overdue. */
export function daysUntil(iso: string): number {
  const today = parseISODate(toISODate(new Date()))
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86_400_000)
}

export function dueLabel(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null
  const days = daysUntil(iso)
  if (days < 0) return { text: days === -1 ? 'Due yesterday' : `${-days} days overdue`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: 'Due tomorrow', overdue: false }
  const date = parseISODate(iso)
  const text = date.toLocaleDateString(undefined, days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' })
  return { text: `Due ${text}`, overdue: false }
}

/** Returns the URL only if it is a plain web link. Guards against javascript: and similar. */
export function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
