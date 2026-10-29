import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Running } from '../types'

const running = atom({ plugin: 'subagent-watch', key: 'running' } as const, [] as Running[])

const label = (n: number) => (n === 0 ? undefined : `${n} subagent${n === 1 ? '' : 's'} running`)

const cut = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const count = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

const detail = (input: Record<string, unknown>) => {
  for (const key of ['command', 'file_path', 'pattern', 'path', 'url', 'query', 'description', 'prompt']) {
    const value = input[key]

    if (typeof value === 'string' && value !== '') {
      return value
    }
  }

  return ''
}

const blank = (id: string): Running => ({
  id,
  type: 'agent',
  description: '',
  startedAt: 0,
  model: '',
  effort: '',
  tokens: 0,
  outTokens: 0,
  activity: 'starting',
})

const touch = ($: Parameters<typeof update>[0], id: string, change: (a: Running) => Running) =>
  update($, running, all =>
    all.some(a => a.id === id) ? all.map(a => (a.id === id ? change(a) : a)) : [...all, change(blank(id))],
  )

export const register: Register = on => {
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)

    if (started.agentId === undefined) {
      return started
    }

    const startedAt = await $.clock.now()
    const list = await touch($, started.agentId, a => ({
      ...a,
      type: e.subagentType,
      description: e.description,
      startedAt,
    }))
    $.ui.toast(`Subagent started: ${e.subagentType}, ${e.description}`)
    $.ui.status(label(list.length))

    return started
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const id = e.agentId

    if (id === undefined) {
      return yield* next(e)
    }

    await touch($, id, a => ({
      ...a,
      model: e.model,
      effort: e.effort === undefined ? '' : String(e.effort),
      activity: 'thinking',
    }))

    const result = yield* next(e)
    const usage = result.usage

    if (usage !== null) {
      await touch($, id, a => ({
        ...a,
        tokens: a.tokens + usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
        outTokens: a.outTokens + usage.output_tokens,
      }))
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId

    if (id !== undefined) {
      const what = detail(e as unknown as Record<string, unknown>)
      await touch($, id, a => ({ ...a, activity: what === '' ? e.tool : `${e.tool}: ${what}` }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const list = await update($, running, all => all.filter(a => a.id !== e.agentId))
      $.ui.status(label(list.length))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, running)

    if (e.props.hasSurvey || list.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    return (
      <Box flexDirection="column">
        {list.map(a => (
          <Box key={a.id} flexDirection="column">
            <Text>
              ◆ {a.type}: {cut(a.description, 40)} ({Math.round((now - a.startedAt) / 1000)}s)
            </Text>
            <Text dimColor>
              {'  '}
              {a.model.replace(/^claude-/, '') || 'model ?'} · {a.effort || 'effort default'} · {count(a.tokens)} tok ({count(a.outTokens)} out) · {cut(a.activity, 50)}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
