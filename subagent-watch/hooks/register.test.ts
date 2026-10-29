import { test, expect, mock } from 'claude-code/testing'

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
