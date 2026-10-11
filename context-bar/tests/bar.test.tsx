import { expect, test } from 'claude-code/testing'

type Row = { name: string; tokens: number; color: string; kind: 'used' | 'free' | 'buffer' | 'deferred' }

const row = (name: string, tokens: number, color: string, kind: Row['kind'] = 'used'): Row =>
  ({ name, tokens, color, kind, isDeferred: kind === 'deferred' }) as Row

const usageAt = (percent: number | undefined, categories?: Row[]) => ({
  startedAt: 0,
  context: {
    window: 200_000,
    percent,
    tokens: percent === undefined ? undefined : percent * 2000,
    breakdown: categories === undefined ? undefined : { categories },
  },
  rateLimits: {},
  cost: {},
})

// find() matches type, key and text only, so colours are checked on what it returns.
const cellsIn = async (ui: any, color: string) =>
  ((await ui.findAll({ type: 'Text', text: /^[▰▱▒]+$/ })) as { text: string; props: { color?: string } }[])
    .filter(el => el.props.color === color)
    .map(el => el.text)

const engine = ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text dimColor>engine</Text> }

test('draws the bar and percent beside the engine modes', async ($, on) => {
  on('session.usage', () => ({ value: usageAt(42) }) as never)
  on('ui.render', engine)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-bar', surface, component: 'SessionMode', props: { modes: ['focus'] } })
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▰'.repeat(8) })).toBeDefined()
    await ui.unmount()
  }
})

test('shows -- before the first response', async ($, on) => {
  on('session.usage', () => ({ value: usageAt(undefined) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'context-bar', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await ui.find({ type: 'Text', text: /--/ })).toBeDefined()
  await ui.unmount()
})

const breakdown = [
  row('System prompt', 3_000, 'promptBorder'),
  row('System tools', 12_000, 'inactive'),
  row('MCP tools', 500, 'claude'),
  row('MCP tools (deferred)', 40_000, 'claude', 'deferred'),
  row('Memory files', 1_000, 'claude'),
  row('Skills', 1_500, 'warning'),
  row('Messages', 92_000, 'permission'),
  row('Free space', 57_000, 'promptBorder', 'free'),
  row('Autocompact buffer', 33_000, 'inactive', 'buffer'),
]

test('granular: colours each category and keeps small ones visible', { options: { mode: 'granular' } }, async ($, on) => {
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'context-bar', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  // 200k over 20 cells: 3k and 500 round to zero but still get one cell each.
  expect(await cellsIn(ui, 'promptBorder')).toEqual(['▰'])
  expect(await cellsIn(ui, 'claude')).toEqual(['▰', '▰'])
  expect(await cellsIn(ui, 'warning')).toEqual(['▰'])
  expect((await cellsIn(ui, 'permission'))[0]).toMatch(/^▰+$/)
  expect(await cellsIn(ui, 'inactive')).toEqual(['▰', '▱▱▱▱▱', '▒▒▒'])
  expect((await ui.find({ type: 'Text', text: / 55%/ }))?.props.color).toBe('success')
  await ui.unmount()
})

test('simple: grey for system, blue for custom, yellow for messages', { options: { mode: 'simple' } }, async ($, on) => {
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'context-bar', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  // System 15.5k and custom 2.5k get a cell each, messages 92k nine; per-category colours are gone.
  expect(await cellsIn(ui, 'gray')).toEqual(['▰'])
  expect(await cellsIn(ui, 'blue')).toEqual(['▰'])
  expect(await cellsIn(ui, 'yellow')).toEqual(['▰'.repeat(9)])
  expect(await cellsIn(ui, 'permission')).toEqual([])
  await ui.unmount()
})
