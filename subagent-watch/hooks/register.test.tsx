import { test, expect, mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

test('reports a subagent from spawn until its turn ends', async ($, on) => {
  mock.clock(on)
  const status: unknown[] = []
  const toasts: unknown[] = []
  on('agent.spawn', () => ({ model: 'test', agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', (_$, e) => {
    status.push(e)
    return { value: undefined } as never
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e)
    return { value: undefined } as never
  })

  await $.agent.spawn({ prompt: 'x', description: 'look around', subagentType: 'Explore' } as never)
  expect(JSON.stringify(toasts)).toContain('Explore')
  expect(JSON.stringify(status)).toContain('1 subagent running')

  await $.turn.complete({ agentId: 'a1', answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  expect(status).toHaveLength(2)
})

const NOW = Date.parse('2026-11-02T12:00:00Z')

const BAND = {
  plugin: 'subagent-watch',
  component: 'AbovePrompt',
  requestId: 'band',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 12,
    bodyColumns: 107,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const explore = {
  id: 'a1',
  type: 'Explore',
  description: 'look around',
  startedAt: NOW - 5000,
  model: 'claude-test',
  effort: 'high',
  tokens: 1200,
  outTokens: 300,
  activity: 'Read: a.ts',
}

const seeded = (on: Parameters<TestBody>[1], list: unknown[], other?: string) => {
  mock.clock(on, { now: NOW })
  on('state.get', () => ({ value: { value: list, version: 1 } }))
  // The engine's own band: another mod's line, or nothing.
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return other === undefined ? <Box /> : <Text>{other}</Text>
  })
}

test('while a subagent runs, the band keeps what other mods draw first', async ($, on) => {
  seeded(on, [explore], 'other band')
  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  expect(await ui.find({ type: 'Text', text: /◆ Explore: look around \(5s\)/ })).toBeTruthy()
  await ui.unmount()
})

test('with no other mod, the band shows the subagent alone', async ($, on) => {
  seeded(on, [explore])
  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ type: 'Text' }))?.text).toMatch(/^◆ Explore/)
  await ui.unmount()
})

test('with no subagent, the band stays what other mods draw', async ($, on) => {
  seeded(on, [], 'other band')
  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  expect(await ui.find({ type: 'Text', text: /◆/ })).toBeFalsy()
  await ui.unmount()
})

test('the band gives way to a survey, and keeps what other mods draw', async ($, on) => {
  seeded(on, [explore], 'other band')
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('other band')
  expect(await ui.find({ type: 'Text', text: /◆/ })).toBeFalsy()
  await ui.unmount()
})
