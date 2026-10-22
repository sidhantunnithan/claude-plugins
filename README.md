# claude-plugins

Personal [Claude Code](https://claude.com/claude-code) mods.

## Install

One mod, in one step:

```
/plugin install statusline --marketplace sidhantunnithan/claude-plugins
```

Or add the marketplace once, then install any mod from it:

```
/plugin marketplace add sidhantunnithan/claude-plugins
/plugin install <mod>@jindan
```

## Mods

| Mod | What it does |
| --- | --- |
| [`statusline`](./statusline) | Status line in the prompt footer. At the left, the model (`Opus 5.5 (1M context)`) and working directory (`~/Projects/foo`, cut from the left past 40 characters), then the 5h rate-limit window as a thin blue bar with its percentage and reset time (`5h ━━━━━━━━━━ 47% » 17:05`, or `17:05 (EDT)` in a chosen zone; left out off a subscription). At the right, a context window bar (`▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▒▒▒ 32%`) coloured by what fills the context. **simple** (default): grey for system (prompt, tools, MCP, commands), blue for custom (agents, memory files, skills), yellow for messages. **granular**: each category in its `/context` colour. Free space is `▱`, the autocompact buffer `▒`; the percentage is green below 60%, yellow below 80%, red above. A shorthand line under the bar names each segment (`sys 16k · custom 3k · msgs 92k`). In `/config`: Colour mode; Show model / Show directory / Show context bar / Show 5h limit bar; and 5h reset time zone (picked from a list of every tz-database zone, such as `America/New_York`; `Host`, the default, means the machine's own zone; any other zone is named after the time, or shown as its offset such as `GMT+9` when it has no English abbreviation). |
| [`tmux-session-rename`](./tmux-session-rename) | Names the tmux window after the conversation. `/rename <name>` renames it at once; a bare `/rename` takes the name Claude generates; resuming a named session (`--resume`, `--continue`) names it as the session starts. When the session ends (exit or `/clear`) the window goes back to tmux's automatic name. Does nothing outside tmux; needs no `tmux.conf` changes. |

## Adding a mod

1. Put it in its own folder with `.claude-plugin/plugin.json` and `hooks/`.
2. List it under `plugins` in `.claude-plugin/marketplace.json`.
3. `claude plugin validate .` and `claude plugin test <mod>`.
