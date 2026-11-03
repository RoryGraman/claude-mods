import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { WeeklyLimit } from '../types'
import { COLORS, barSegments, computePace, labels } from './pace'
import type { Pace } from './pace'

const limit = atom({ plugin: 'weekly-pace', key: 'limit' } as const, null as WeeklyLimit | null)
const now = atom({ plugin: 'weekly-pace', key: 'now' } as const, 0)

function weekly(rateLimits: readonly SessionRateLimit[]): WeeklyLimit | null {
  const w = rateLimits.find(r => r.kind === 'seven_day' && r.resetsAt)

  return w && w.resetsAt ? { percentUsed: w.percentUsed, resetsAt: w.resetsAt } : null
}

// The bar fills the row.
function bar(pace: Pace, columns: number) {
  const parts = barSegments(pace, Math.max(20, columns))
  const text = (kind: string) => parts.find(s => s.kind === kind)?.text ?? ''

  return { used: text('used'), ahead: text('ahead'), week: text('week'), rest: text('rest') }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    const usage = await $.session.usage()
    const w = weekly(usage.rateLimits)
    if (w) await update($, limit, () => w)
    const t = await $.clock.now()
    await update($, now, () => t)

    // The time track moves on its own: redraw once a minute.
    $.clock.every(60_000, () => {
      void $.clock.now().then(ms => update($, now, () => ms))
    })

    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const w = weekly(e.rateLimits)
      if (w) await update($, limit, () => w)
    }

    return next(e)
  })

  // The terminal draws the card under the prompt.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const base = await next(e)
    if (e.surface !== 'terminal') return base
    const ms = (await read($, now)) || Date.now()
    const pace = computePace(await read($, limit), ms)
    if (!pace) return base

    const l = labels(pace)
    const color = COLORS[pace.tone]
    // The engine pads the hint row by two columns on each side.
    const b = bar(pace, (e.viewport?.columns ?? 80) - 4)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {base}
        <Text wrap="truncate-end">
          <Text color={color}>{b.used + b.ahead}</Text>
          <Text>{b.week}</Text>
          <Text dimColor>{b.rest}</Text>
        </Text>
        <Text wrap="truncate-end">
          <Text dimColor>{l.reset} · </Text>
          <Text>{l.summary}</Text>
        </Text>
      </Box>
    )
  })

  // The desktop app does not raise the hint row, so its card sits in the band
  // above the prompt, under what other mods draw there.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const base = await next(e)
    if (e.surface === 'terminal' || e.props.hasSurvey) return base
    const ms = (await read($, now)) || Date.now()
    const pace = computePace(await read($, limit), ms)
    if (!pace) return base

    const l = labels(pace)
    const color = COLORS[pace.tone]
    const b = bar(pace, e.props.bodyColumns)
    const { Box, Text } = $.ui.resolve(e)

    // The band holds about 12 rows and draws its own frame; spacing counts rows.
    return (
      <Box flexDirection="column" gap={1}>
        {base}
        <Box flexDirection="column" gap={0}>
          <Box flexDirection="row" gap={0}>
            <Text mono color={color}>{b.used + b.ahead}</Text>
            <Text mono>{b.week}</Text>
            <Text mono dimColor>{b.rest}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text dimColor>{l.reset} ·</Text>
            <Text>{l.summary}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
