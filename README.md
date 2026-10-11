# jindan-cc-marketplace

Personal [Claude Code](https://claude.com/claude-code) mods.

## Install

One mod, in one step:

```
/plugin install context-bar --marketplace sidhantunnithan/jindan-cc-marketplace
```

Or add the marketplace once, then install any mod from it:

```
/plugin marketplace add sidhantunnithan/jindan-cc-marketplace
/plugin install <mod>@jindan
```

## Mods

| Mod | What it does |
| --- | --- |
| [`context-bar`](./context-bar) | Context window usage bar (`▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▒▒▒ 32%`) at the right edge of the prompt footer. Each category (system prompt, tools, MCP, memory, messages, …) is drawn in its `/context` colour, with free space `▱` and the autocompact buffer `▒`. The percentage is green below 60%, yellow below 80%, red above. |

## Adding a mod

1. Put it in its own folder with `.claude-plugin/plugin.json` and `hooks/`.
2. List it under `plugins` in `.claude-plugin/marketplace.json`.
3. `claude plugin validate .` and `claude plugin test <mod>`.
