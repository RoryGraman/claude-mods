# claude-mods

Mods for Claude Code. This repo is a plugin marketplace. Each mod installs with one command.

| Mod | What it does |
| --- | --- |
| [subagent-watch](#subagent-watch) | Shows a band above the prompt, a toast, and a status entry while subagents run. |
| [weekly-pace](#weekly-pace) | Shows weekly usage against the week's clock in one colored bar by the prompt. |

## Install

Add this repo as a marketplace and install a mod from it in one step.

In a Claude Code terminal session:

```
/plugin install subagent-watch --marketplace RoryGraman/claude-mods
```

For another mod, put its name in place of `subagent-watch`, for example `weekly-pace`.

Claude asks `Add marketplace?`. Press `y`. Then pick a scope. The user scope keeps the mod active in every session.

When the install ends, you see `Installed subagent-watch. Plugin is now active.` The mod runs in that session at once. You do not need to restart.

From a shell. An agent that can run commands uses this line:

```
claude plugin install subagent-watch --marketplace RoryGraman/claude-mods
```

In the desktop app, `/plugin` does not run. Click **+** next to the prompt box, then **Plugins**, then **Add marketplace**. Enter `RoryGraman/claude-mods`, then choose **Add plugin**.

The mods need a Claude Code version that supports mods (plugins with a hooks module).

## subagent-watch

While a subagent runs, the mod shows three things:

- **A band above the prompt.** Each subagent gets one entry: its type, its task, and the seconds it has run. A dim second line shows the model, the effort, the token count, and what the subagent does now.
- **A toast** when a subagent starts.
- **A status entry**, such as `2 subagents running`.

The band and the status entry go away when no subagent runs.

## weekly-pace

The mod shows how fast you use your weekly limit (the 7-day window), compared with how much of the week has gone.

```
██████████████████▓▓▓─────────────────── 52% used · 44% of week
Resets Mon 2 PM, in 3d 22h · Next 5 hours on pace: 2.6%
```

The bar has four parts:

- `█` is the part of the limit that you used.
- `▓` is usage ahead of the clock: you used more than the share of the week that has gone.
- `━` is the part of the week that has gone past your usage.
- `─` is the rest of the week.

The color shows the lead: the percent used minus the percent of the week gone.

- Green: 5 points or less.
- Yellow: more than 5 points.
- Orange: more than 10 points.
- Red: more than 20 points.

The second line gives the reset time and the share of the limit that you can use in the next 5 hours if you spread what is left evenly until the reset.

In the terminal, the bar is under the prompt. In the desktop app, it is in the band above the prompt. The bar shows only when your plan has a weekly limit. It updates once a minute.

Times show in US Central time. To change the zone, edit `TIME_ZONE` in `weekly-pace/hooks/pace.ts`.

## License

[MIT](LICENSE)
