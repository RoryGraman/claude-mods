import type { WeeklyLimit } from '../types'

export type Tone = 'green' | 'yellow' | 'orange' | 'red'

export type Pace = {
  usage: number
  elapsed: number
  tone: Tone
  delta: number
  per5h: number
  remainingHours: number
  reset: Date
}

const HOUR = 3600_000
const WEEK = 168 * HOUR

// Day and time labels are shown in this zone, not the host clock's (UTC in a cloud workspace).
export const TIME_ZONE = 'America/Chicago'

export const COLORS: Record<Tone, string> = {
  green: '#4CB782',
  yellow: '#E5C547',
  orange: '#EE8A3C',
  red: '#F0675C',
}

// Points of the whole week that usage may run ahead of the clock before each tone.
const AHEAD = { yellow: 5, orange: 10, red: 20 }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toneOf(delta: number): Tone {
  if (delta > AHEAD.red) return 'red'
  if (delta > AHEAD.orange) return 'orange'
  if (delta > AHEAD.yellow) return 'yellow'

  return 'green'
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

export function computePace(limit: WeeklyLimit | null, nowMs: number): Pace | null {
  if (!limit) return null
  const resetMs = Date.parse(limit.resetsAt)
  if (Number.isNaN(resetMs) || nowMs >= resetMs) return null

  const startMs = resetMs - WEEK
  const elapsed = Math.round(clamp(((nowMs - startMs) / WEEK) * 100, 0, 100) * 10) / 10
  const usage = clamp(limit.percentUsed, 0, 100)
  const delta = Math.round(usage - elapsed)
  const remainingHours = clamp((resetMs - nowMs) / HOUR, 0, 168)
  const per5h = Math.max(100 - usage, 0) / Math.max(remainingHours / 5, 1)

  return {
    usage,
    elapsed,
    tone: toneOf(delta),
    delta,
    per5h,
    remainingHours,
    reset: new Date(resetMs),
  }
}

// Weekday, hour and minute of a moment in TIME_ZONE; the host clock if Intl can't.
export function localParts(d: Date, timeZone: string = TIME_ZONE): { day: number; h: number; m: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const day = DAYS.indexOf(get('weekday'))
    const h = Number(get('hour')) % 24
    const m = Number(get('minute'))
    if (day >= 0 && !Number.isNaN(h) && !Number.isNaN(m)) return { day, h, m }
  } catch {
    // fall through to the host clock
  }

  return { day: d.getDay(), h: d.getHours(), m: d.getMinutes() }
}

export function clockLabel(d: Date): string {
  const { day, h, m } = localParts(d)
  const mins = m === 0 ? '' : ':' + String(m).padStart(2, '0')

  return `${DAYS[day]} ${h % 12 || 12}${mins} ${h < 12 ? 'AM' : 'PM'}`
}

export function remainingLabel(hours: number): string {
  const mins = Math.round(hours * 60)
  const days = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)

  return days > 0 ? `${days}d ${h}h` : `${h}h ${mins % 60}m`
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`

export function labels(p: Pace) {
  return {
    summary: `${pct(p.usage)} used · ${pct(p.elapsed)} of week · ${p.delta > 0 ? '+' : ''}${p.delta} pts`,
    reset: `Resets ${clockLabel(p.reset)}, in ${remainingLabel(p.remainingHours)}`,
    per5h: pct(p.per5h),
  }
}

export type Segment = { kind: 'used' | 'ahead' | 'week' | 'rest'; text: string }

// One row of cells: usage thick (█), usage ahead of the clock shaded (▓),
// the week past usage medium (━), the rest thin (─).
export function barSegments(p: Pace, cells: number): Segment[] {
  const used = Math.round((p.usage / 100) * cells)
  const week = Math.round((p.elapsed / 100) * cells)
  const segments: Segment[] = [
    { kind: 'used', text: '█'.repeat(Math.min(used, week)) },
    { kind: 'ahead', text: '▓'.repeat(Math.max(used - week, 0)) },
    { kind: 'week', text: '━'.repeat(Math.max(week - used, 0)) },
    { kind: 'rest', text: '─'.repeat(cells - Math.max(used, week)) },
  ]

  return segments.filter(s => s.text)
}
