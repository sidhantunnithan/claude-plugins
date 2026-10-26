import { expect, mock, test } from 'claude-code/testing'

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
  rateLimits: [] as { kind: string; percentUsed: number; resetsAt?: string }[],
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
  expect(await cellsIn(ui, '#4c4c7f')).toEqual(['▱'.repeat(8)])
  expect((await ui.find({ type: 'Text', text: / 55%/ }))?.props.color).toBe('#7fd77f')
  await ui.unmount()
})

// Right after a compaction the API figure is absent until the next response: the percent
// follows the rows the bar draws.
test('the percent follows the bar, not the API figure', { options: { mode: 'granular' } }, async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(undefined, breakdown) }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await ui.find({ type: 'Text', text: / 55%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /--/ })).toBeUndefined()
  await ui.unmount()
})

// A compaction window (autoCompactWindow) smaller than the model's: the breakdown's rows total
// 500k, but the bar and percent measure the whole 1M window.
test('measures against the model window, not the compaction window', { options: { mode: 'granular' } }, async ($, on) => {
  info(on)
  const rows = [
    row('Messages', 60_000, 'permission'),
    row('Free space', 407_000, 'promptBorder', 'free'),
    row('Autocompact buffer', 33_000, 'inactive', 'buffer'),
  ]
  const usage = usageAt(undefined, rows)
  on('session.usage', () => ({ value: { ...usage, context: { ...usage.context, window: 1_000_000 } } }) as never)
  on('ui.render', engine)
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await ui.find({ type: 'Text', text: / 6%/ })).toBeDefined()
  expect(await cellsIn(ui, 'permission')).toEqual(['▰'])
  expect(await cellsIn(ui, '#4c4c7f')).toEqual(['▱'.repeat(19)])
  await ui.unmount()
})

const compacted = [
  row('System prompt', 3_000, 'promptBorder'),
  row('System tools', 12_000, 'inactive'),
  row('Messages', 5_000, 'permission'),
  row('Free space', 147_000, 'promptBorder', 'free'),
  row('Autocompact buffer', 33_000, 'inactive', 'buffer'),
]

test('redraws within two seconds of a compaction', { options: { mode: 'granular' } }, async ($, on) => {
  info(on)
  const clock = mock.clock(on)
  let usage = usageAt(55, breakdown)
  on('session.usage', () => ({ value: usage }) as never)
  on('ui.render', engine)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'statusline', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: / 55%/ })).toBeDefined()
  // No event says so; the API's figure clearing is the only sign.
  usage = usageAt(undefined, compacted)
  expect(await ui.find({ type: 'Text', text: / 55%/ })).toBeDefined()
  await clock.advance(2000)
  // 20k of 200k: a tenth of the bar, one cell for messages.
  expect(await ui.find({ type: 'Text', text: / 10%/ })).toBeDefined()
  expect(await cellsIn(ui, 'permission')).toEqual(['▰'])
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
  on('session.usage', () => ({ value: usageAt(42) }) as never)
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
  on('session.usage', () => ({ value: usageAt(42) }) as never)
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
  on('session.usage', () => ({ value: usageAt(42) }) as never)
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

test('draws the 5h window as one bar with its reset time', async ($, on) => {
  info(on)
  const resetsAt = new Date(2026, 9, 20, 17, 5).toISOString()
  on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: '5h ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '━'.repeat(5) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' 50% » 17:05' })).toBeDefined()
  await ui.unmount()
})

test('leaves the 5h row out off a subscription', async ($, on) => {
  info(on)
  on('session.usage', () => ({ value: usageAt(42) }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: '5h ' })).toBeUndefined()
  await ui.unmount()
})

test('the 5h bar can be switched off', { options: { showFiveHour: false } }, async ($, on) => {
  info(on)
  const resetsAt = new Date(2026, 9, 20, 17, 5).toISOString()
  on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: '5h ' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '~/Projects/foo' })).toBeDefined()
  await ui.unmount()
})

test('reads the 5h reset time in the configured time zone', { options: { timeZone: 'America/New_York' } }, async ($, on) => {
  info(on)
  // 21:05 UTC is 17:05 in New York (EDT, UTC-4), whatever the host zone.
  const resetsAt = new Date(Date.UTC(2026, 9, 20, 21, 5)).toISOString()
  on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: ' 50% » 17:05 (EDT)' })).toBeDefined()
  await ui.unmount()
})

// The zone's abbreviation follows the reset time, or its offset when it has no name.
for (const [timeZone, utc, text] of [
  ['America/New_York', Date.UTC(2026, 0, 20, 22, 5), ' 50% » 17:05 (EST)'],
  ['Asia/Kolkata', Date.UTC(2026, 9, 20, 11, 35), ' 50% » 17:05 (IST)'],
  ['Europe/London', Date.UTC(2026, 0, 20, 17, 5), ' 50% » 17:05 (GMT)'],
  ['Europe/London', Date.UTC(2026, 6, 20, 16, 5), ' 50% » 17:05 (BST)'],
  ['Asia/Tokyo', Date.UTC(2026, 9, 20, 8, 5), ' 50% » 17:05 (GMT+9)'],
  ['UTC', Date.UTC(2026, 9, 20, 17, 5), ' 50% » 17:05 (UTC)'],
] as const) {
  test(`names ${timeZone} as ${text.slice(text.indexOf('('))}`, { options: { timeZone } }, async ($, on) => {
    info(on)
    const resetsAt = new Date(utc).toISOString()
    on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
    on('ui.render', engine)
    const ui = await mountHint($)
    expect(await ui.find({ type: 'Text', text })).toBeDefined()
    await ui.unmount()
  })
}

test('an unknown time zone falls back to host time', { options: { timeZone: 'Not/AZone' } }, async ($, on) => {
  info(on)
  const resetsAt = new Date(2026, 9, 20, 17, 5).toISOString()
  on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: ' 50% » 17:05' })).toBeDefined()
  await ui.unmount()
})

test('Host reads the 5h reset time in host time', { options: { timeZone: 'Host' } }, async ($, on) => {
  info(on)
  const resetsAt = new Date(2026, 9, 20, 17, 5).toISOString()
  on('session.usage', () => ({ value: { ...usageAt(42), rateLimits: [{ kind: 'five_hour', percentUsed: 50, resetsAt }] } }) as never)
  on('ui.render', engine)
  const ui = await mountHint($)
  expect(await ui.find({ type: 'Text', text: ' 50% » 17:05' })).toBeDefined()
  await ui.unmount()
})
