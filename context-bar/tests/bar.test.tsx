import { expect, test } from 'claude-code/testing'

const usageAt = (percent: number | undefined) => ({
  startedAt: 0,
  context: { window: 200_000, percent, tokens: percent === undefined ? undefined : percent * 2000 },
  rateLimits: {},
  cost: {},
})

test('draws the bar and percent beside the engine modes', async ($, on) => {
  on('session.usage', () => ({ value: usageAt(42) }) as never)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text dimColor>engine</Text> })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'context-bar', surface, component: 'SessionMode', props: { modes: ['focus'] } })
    expect(await ui.find({ type: 'Text', text: /42%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '▰▰▰▰' })).toBeDefined()
    await ui.unmount()
  }
})

test('shows -- before the first response', async ($, on) => {
  on('session.usage', () => ({ value: usageAt(undefined) }) as never)
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text dimColor>engine</Text> })
  const ui = await $.ui.mount({ plugin: 'context-bar', surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await ui.find({ type: 'Text', text: /--/ })).toBeDefined()
  await ui.unmount()
})
