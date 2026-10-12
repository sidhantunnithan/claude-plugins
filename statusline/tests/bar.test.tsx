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

const info = (on: any, cwd = '/Users/me/Projects/foo') => {
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }) as never)
  on('session.cwd', () => ({ value: cwd }) as never)
  on('env.get', () => ({ value: '/Users/me' }) as never)
}

const engine = ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text dimColor>engine</Text> }

test('draws the bar and percent beside the engine modes', async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(42) }) as never)
  on('ui.render', engine)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'statusline', surface, component: 'SessionMode', props: { modes: ['focus'] } })
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▰'.repeat(8) })).toBeDefined()
    await ui.unmount()
  }
})

test('shows -- before the first response', async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(undefined) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
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
  info(on)
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  // 200k over 20 cells: 3k and 500 round to zero but still get one cell each.
  expect(await cellsIn(ui, 'promptBorder')).toEqual(['▰'])
  expect(await cellsIn(ui, 'claude')).toEqual(['▰', '▰'])
  expect(await cellsIn(ui, 'warning')).toEqual(['▰'])
  expect((await cellsIn(ui, 'permission'))[0]).toMatch(/^▰+$/)
  expect(await cellsIn(ui, 'inactive')).toEqual(['▰'])
  expect(await cellsIn(ui, '#4c4c7f')).toEqual(['▱▱▱▱▱', '▒▒▒'])
  expect((await ui.find({ type: 'Text', text: / 55%/ }))?.props.color).toBe('#7fd77f')
  await ui.unmount()
})

test('simple: overlay for system, blue for custom, yellow for messages', { options: { mode: 'simple' } }, async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  // System 15.5k and custom 2.5k get a cell each, messages 92k nine; per-category colours are gone.
  expect(await cellsIn(ui, '#7f7faf')).toEqual(['▰'])
  expect(await cellsIn(ui, '#7fafff')).toEqual(['▰'])
  expect(await cellsIn(ui, '#ffd7af')).toEqual(['▰'.repeat(9)])
  expect(await cellsIn(ui, 'permission')).toEqual([])
  await ui.unmount()
})

test('writes a shorthand legend under the bar', { options: { mode: 'simple' } }, async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect((await ui.find({ type: 'Text', text: 'sys 16k' }))?.props.color).toBe('#7f7faf')
  expect((await ui.find({ type: 'Text', text: ' · custom 3k' }))?.props.color).toBe('#7fafff')
  expect((await ui.find({ type: 'Text', text: ' · msgs 92k' }))?.props.color).toBe('#ffd7af')
  expect(await ui.find({ type: 'Text', text: /free/ })).toBeUndefined()
  await ui.unmount()
})

test('granular legend names each category', { options: { mode: 'granular' } }, async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(55, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  for (const text of ['sys 3k', ' · tools 12k', ' · mcp 500', ' · mem 1k', ' · skills 2k', ' · msgs 92k'])
    expect(await ui.find({ type: 'Text', text })).toBeDefined()
  await ui.unmount()
})

const hint = ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text dimColor>? for shortcuts</Text> }
const mountHint = ($: any) =>
  $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })

test('draws model and directory at the left of the footer', async ($, on) => {
  info(on)
  on('ui.render', hint)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'statusline', surface, component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } })
    expect((await ui.find({ type: 'Text', text: 'Opus 5.5 (1M context)' }))?.props.color).toBe('#7fd7d7')
    expect((await ui.find({ type: 'Text', text: '~/Projects/foo' }))?.props.color).toBe('#7fd77f')
    expect(await ui.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
    await ui.unmount()
  }
})

test('cuts a long directory from the left', async ($, on) => {
  info(on, '/opt/a/very/long/path/that/goes/on/and/on/to/the/project')
  on('ui.render', hint)
  const ui = await mountHint($)
  const cwd = await ui.find({ type: 'Text', text: /^…/ })
  expect(cwd?.text.length).toBe(40)
  expect(cwd?.text.endsWith('/to/the/project')).toBe(true)
  await ui.unmount()
})

test('each part can be switched off', { options: { showModel: false, showBar: false } }, async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(42) }) as never)
  on('ui.render', hint)
  const left = await mountHint($)
  expect(await left.find({ type: 'Text', text: /Opus/ })).toBeUndefined()
  expect(await left.find({ type: 'Text', text: '~/Projects/foo' })).toBeDefined()
  await left.unmount()
  const right = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await right.find({ type: 'Text', text: /42%/ })).toBeUndefined()
  expect(await right.find({ type: 'Text', text: /^[▰▱▒]+$/ })).toBeUndefined()
  await right.unmount()
})

test('names models the way the banner does', async ($, on) => {
  on('session.cwd', () => ({ value: '/tmp' }) as never)
  on('env.get', () => ({ value: '/Users/me' }) as never)
  let model = ''
  on('session.model', () => ({ value: model }) as never)
  on('ui.render', hint)
  for (const [id, name] of [
    ['claude-sonnet-5-5', 'Sonnet 5.5'],
    ['claude-haiku-4-5-20251001', 'Haiku 4.5'],
    ['opus[1m]', 'Opus (1M context)'],
    ['some-custom/model', 'some-custom/model'],
  ]) {
    model = id!
    const ui = await mountHint($)
    expect(await ui.find({ type: 'Text', text: name })).toBeDefined()
    await ui.unmount()
  }
})
