# claude-mods

Mods for Claude Code. This repo is a plugin marketplace. Each mod installs with one command.

| Mod | What it does |
| --- | --- |
| [subagent-watch](#subagent-watch) | Shows a band above the prompt, a toast, and a status entry while subagents run. |

## Install

Add this repo as a marketplace and install a mod from it in one step.

In a Claude Code terminal session:

```
/plugin install subagent-watch --marketplace RoryGraman/claude-mods
```

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

## License

[MIT](LICENSE)
