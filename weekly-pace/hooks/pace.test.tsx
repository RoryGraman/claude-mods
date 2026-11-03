import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { barSegments, clockLabel, computePace, labels, localParts, remainingLabel, toneOf } from './pace'

const HOUR = 3600_000
const WEEK = 168 * HOUR
const NOW = Date.parse('2026-10-28T12:00:00Z')
const HALF = new Date(NOW + 84 * HOUR).toISOString()

// The pace at `elapsed` percent of a week, with `percentUsed` of the limit used.
const at = (percentUsed: number, elapsed: number) =>
  computePace({ percentUsed, resetsAt: HALF }, NOW + 84 * HOUR - WEEK + (elapsed / 100) * WEEK)!

const bar = (percentUsed: number, elapsed: number) =>
  barSegments(at(percentUsed, elapsed), 40)
    .map(s => s.text)
    .join('')

const HINT = {
  plugin: 'weekly-pace',
  component: 'PromptHint',
  requestId: 'hint',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

// The desktop app does not raise the hint row, so the card draws in the band.
const BAND = {
  plugin: 'weekly-pace',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 107,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

test('half the week gone and half the tokens used is on pace', () => {
  const pace = computePace({ percentUsed: 50, resetsAt: HALF }, NOW)

  expect(pace?.elapsed).toBe(50)
  expect(pace?.usage).toBe(50)
  expect(pace?.delta).toBe(0)
  expect(pace?.tone).toBe('green')
})

test('the tones follow the lead over the clock, in points of the week', () => {
  expect(toneOf(-20)).toBe('green')
  expect(toneOf(5)).toBe('green')
  expect(toneOf(6)).toBe('yellow')
  expect(toneOf(10)).toBe('yellow')
  expect(toneOf(11)).toBe('orange')
  expect(toneOf(20)).toBe('orange')
  expect(toneOf(21)).toBe('red')
  expect(at(52, 44).tone).toBe('yellow')
  expect(at(70, 55).tone).toBe('orange')
  expect(at(81, 57).tone).toBe('red')
  // The tone reads the lead as shown, in whole points.
  expect(at(55.3, 50).tone).toBe('green')
})

test('one bar shows usage thick, the week medium, and usage ahead of the clock shaded', () => {
  expect(bar(30, 50)).toBe('████████████━━━━━━━━────────────────────')
  expect(bar(40, 37)).toBe('███████████████▓────────────────────────')
  expect(bar(52, 44)).toBe('██████████████████▓▓▓───────────────────')
  expect(bar(70, 55)).toBe('██████████████████████▓▓▓▓▓▓────────────')
  expect(bar(81, 57)).toBe('███████████████████████▓▓▓▓▓▓▓▓▓────────')
})

test('the bar names its parts so each can take its own color', () => {
  expect(barSegments(at(52, 44), 40).map(s => s.kind)).toEqual(['used', 'ahead', 'rest'])
  expect(barSegments(at(30, 50), 40).map(s => s.kind)).toEqual(['used', 'week', 'rest'])
})

test('the labels say the usage and the week, with no point lead', () => {
  expect(labels(at(52, 44)).summary).toBe('52% used · 44% of week')
  expect(labels(at(30, 50)).summary).toBe('30% used · 50% of week')
  expect(labels(at(50, 50)).summary).toBe('50% used · 50% of week')
})

test('the status line starts with the reset, with no pace word', () => {
  // HALF is Sat 7 PM in Chicago, 84 hours after NOW.
  expect(labels(at(50, 50)).reset).toBe('Resets Sat 7 PM, in 3d 12h')
  expect(Object.keys(labels(at(81, 57)))).toEqual(['summary', 'reset', 'per5h'])
})

test('the next five hours share what is left evenly', () => {
  const pace = computePace({ percentUsed: 50, resetsAt: HALF }, NOW)

  // 50% left over 84 hours is 16.8 windows of five hours.
  expect(pace?.per5h.toFixed(1)).toBe('3.0')
})

test('no weekly window means no pace', () => {
  expect(computePace(null, NOW)).toBe(null)
  expect(computePace({ percentUsed: 10, resetsAt: 'not a date' }, NOW)).toBe(null)
})

test('a window whose reset has passed means no pace', () => {
  expect(computePace({ percentUsed: 80, resetsAt: HALF }, Date.parse(HALF))).toBe(null)
  expect(computePace({ percentUsed: 80, resetsAt: HALF }, Date.parse(HALF) + 2 * HOUR)).toBe(null)
})

test('the time left rounds to whole minutes', () => {
  expect(remainingLabel(2.999)).toBe('3h 0m')
  expect(remainingLabel(0.9999)).toBe('1h 0m')
  expect(remainingLabel(164.5)).toBe('6d 20h')
})

test('labels are in Central time, not UTC', () => {
  // 2026-10-28 12:00 UTC is Wed 7 AM in Chicago (CDT, UTC-5).
  const p = localParts(new Date(NOW))
  expect(p.day).toBe(3)
  expect(p.h).toBe(7)
  expect(clockLabel(new Date(NOW))).toBe('Wed 7 AM')
})

test('a start with no weekly window keeps the last one', async ($, on) => {
  mock.clock(on, { now: NOW })
  const written: unknown[] = []
  on('state.set', (_, e, next) => {
    if (e.key === 'limit') written.push(e.value)
    return next(e)
  })
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(written).toEqual([])
})

test('the week clock moves once a minute', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const written: unknown[] = []
  on('state.set', (_, e, next) => {
    if (e.key === 'now') written.push(e.value)
    return next(e)
  })
  on('session.usage', () => ({ value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(60_000)
  await clock.settle()

  expect(written).toEqual([NOW, NOW + 60_000])
})

test('a usage update stores the new weekly window', async ($, on) => {
  const written: unknown[] = []
  on('state.set', (_, e, next) => {
    if (e.key === 'limit') written.push(e.value)
    return next(e)
  })
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [{ kind: 'seven_day', percentUsed: 52, resetsAt: HALF }],
    changed: ['rateLimits'],
  })

  expect(written).toEqual([{ percentUsed: 52, resetsAt: HALF }])
})

type Drawn = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

const textOf = (n: unknown): string =>
  typeof n === 'string' ? n : ((n as Drawn | undefined)?.children ?? []).map(textOf).join('')

// The Text rows that cut at their end, in the order drawn.
function cutRows(n: unknown, out: Drawn[] = []): Drawn[] {
  if (n && typeof n === 'object') {
    const d = n as Drawn
    if (d.type === 'Text' && d.props?.wrap) out.push(d)
    for (const c of d.children ?? []) cutRows(c, out)
  }

  return out
}

const seeded = (on: Parameters<TestBody>[1], limit: unknown, text: string) => {
  on('state.get', (_, e) => ({
    value: { value: e.key === 'limit' ? limit : NOW, version: 1 },
  }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{text}</Text>
  })
}

// The old status words, but not the "on pace:" of the five-hour budget.
const NO_WORD = /●|On pace|Under pace|[Ff]ast/

// Half the week is gone: behind, level, a bit ahead, ahead, far ahead.
for (const used of [30, 52, 58, 62, 81]) {
  test(`no dot or pace word at ${used}% used`, async ($, on) => {
    seeded(on, { percentUsed: used, resetsAt: HALF }, 'engine hint')
    const hint = await $.ui.mount({ ...HINT, surface: 'terminal' })

    expect(textOf(cutRows(await hint.drawn())[1])).toMatch(/^Resets .* · Next 5 hours on pace: \d/)
    expect(await hint.find({ type: 'Text', text: NO_WORD })).toBeFalsy()
    await hint.unmount()

    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Text', text: /^Resets .* · Next 5 hours on pace:$/ })).toBeTruthy()
    expect(await band.find({ type: 'Text', text: NO_WORD })).toBeFalsy()
    await band.unmount()
  })
}

test('the hint keeps the engine line first and adds the bar and the status below it', async ($, on) => {
  seeded(on, { percentUsed: 52, resetsAt: HALF }, 'engine hint')
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine hint')
  expect(await ui.find({ type: 'Text', text: /█+▓*━*─*/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /52% used · 50% of week$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Resets .* · Next 5 hours on pace:/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: NO_WORD })).toBeFalsy()
  await ui.unmount()
})

test('on the terminal both lines fit the padded hint row and cut at their end', async ($, on) => {
  // 99.9% used at 44.6% of the week is the longest summary: 37 columns with its space.
  seeded(on, { percentUsed: 99.9, resetsAt: new Date(NOW + 0.554 * WEEK).toISOString() }, 'engine hint')
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal', viewport: { columns: 80, rows: 24 } })
  const rows = cutRows(await ui.drawn())

  expect(rows.map(r => r.props?.wrap)).toEqual(['truncate-end', 'truncate-end'])
  // The engine pads the hint row by two columns on each side.
  expect(textOf(rows[0]).length).toBeLessThanOrEqual(76)
  await ui.unmount()
})

test('without a weekly window the hint is the engine line alone', async ($, on) => {
  seeded(on, null, 'engine hint')
  const ui = await $.ui.mount({ ...HINT, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /% used/ })).toBeFalsy()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine hint')
  await ui.unmount()
})

test('on the desktop the hint row stays the engine line', async ($, on) => {
  seeded(on, { percentUsed: 52, resetsAt: HALF }, 'other band')
  const ui = await $.ui.mount({ ...HINT, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /% used/ })).toBeFalsy()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  await ui.unmount()
})

test('on the desktop the band keeps what other mods draw first and adds the card', async ($, on) => {
  seeded(on, { percentUsed: 52, resetsAt: HALF }, 'other band')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  expect(await ui.find({ type: 'Text', text: /█+/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /52% used · 50% of week$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Resets .* · Next 5 hours on pace:/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: NO_WORD })).toBeFalsy()
  await ui.unmount()
})

test('the terminal band stays what other mods draw', async ($, on) => {
  seeded(on, { percentUsed: 52, resetsAt: HALF }, 'other band')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /% used/ })).toBeFalsy()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  await ui.unmount()
})

test('the band gives way to a survey', async ($, on) => {
  seeded(on, { percentUsed: 52, resetsAt: HALF }, 'other band')
  const ui = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
    surface: 'desktop',
  })

  expect(await ui.find({ type: 'Text', text: /% used/ })).toBeFalsy()
  await ui.unmount()
})

test('without a weekly window the band draws only the other mods', async ($, on) => {
  seeded(on, null, 'other band')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect(await ui.find({ type: 'Text', text: /% used/ })).toBeFalsy()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  await ui.unmount()
})
