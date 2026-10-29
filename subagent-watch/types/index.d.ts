export type Running = {
  id: string
  type: string
  description: string
  startedAt: number
  model: string
  effort: string
  tokens: number
  outTokens: number
  activity: string
}

declare module 'claude-code' {
  interface PluginState {
    'subagent-watch': { running: Running[] }
  }
}
