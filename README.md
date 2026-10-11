# jindan-cc-marketplace

Personal [Claude Code](https://claude.com/claude-code) mods.

## Install

One mod, in one step:

```
/plugin install statusline --marketplace sidhantunnithan/jindan-cc-marketplace
```

Or add the marketplace once, then install any mod from it:

```
/plugin marketplace add sidhantunnithan/jindan-cc-marketplace
/plugin install <mod>@jindan
```

## Mods

| Mod | What it does |
| --- | --- |
| [`statusline`](./statusline) | Status line in the prompt footer. At the left, the model (`Opus 5.5 (1M context)`) and working directory (`~/Projects/foo`, cut from the left past 40 characters). At the right, a context window bar (`▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▒▒▒ 32%`) coloured by what fills the context. **simple** (default): grey for system (prompt, tools, MCP, commands), blue for custom (agents, memory files, skills), yellow for messages. **granular**: each category in its `/context` colour. Free space is `▱`, the autocompact buffer `▒`; the percentage is green below 60%, yellow below 80%, red above. A shorthand line under the bar names each segment (`sys 16k · custom 3k · msgs 92k`). In `/config`: Colour mode, and Show model / Show directory / Show context bar. |

## Adding a mod

1. Put it in its own folder with `.claude-plugin/plugin.json` and `hooks/`.
2. List it under `plugins` in `.claude-plugin/marketplace.json`.
3. `claude plugin validate .` and `claude plugin test <mod>`.
