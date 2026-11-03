export type WeeklyLimit = {
  percentUsed: number
  resetsAt: string
}

declare module 'claude-code' {
  interface PluginState {
    'weekly-pace': {
      limit: WeeklyLimit | null
      now: number
    }
  }
}
