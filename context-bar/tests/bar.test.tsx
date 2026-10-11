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

test('colours each category and keeps small ones visible', async ($, on) => {
  on('session.usage', () => ({
    value: usageAt(55, [
      row('System prompt', 3_000, 'promptBorder'),
      row('System tools', 12_000, 'inactive'),
      row('MCP tools', 500, 'claude'),
      row('MCP tools (deferred)', 40_000, 'claude', 'deferred'),
      row('Messages', 94_500, 'permission'),
      row('Free space', 57_000, 'promptBorder', 'free'),
      row('Autocompact buffer', 33_000, 'inactive', 'buffer'),
    ]),
  }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'context-bar', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  // 200k over 20 cells: 3k and 500 round to zero but still get one cell each.
  expect(await ui.find({ type: 'Text', text: '▰', props: { color: 'claude' } })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▰', props: { color: 'promptBorder' } })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▰+$/, props: { color: 'permission' } })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▱+$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^▒+$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: / 55%/, props: { color: 'success' } })).toBeDefined()
  await ui.unmount()
})
