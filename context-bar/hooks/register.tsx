import type { ContextCategory, Register } from 'claude-code'

const WIDTH = 20

const colorFor = (percent: number) =>
  percent >= 80 ? 'error' : percent >= 60 ? 'warning' : 'success'

type Segment = { row: ContextCategory; cells: number }

// Splits `width` cells across the rows by tokens (largest remainder), giving every
// non-empty `used` row at least one cell so small categories stay visible.
const allocate = (rows: ContextCategory[], width = WIDTH): Segment[] => {
  const total = rows.reduce((sum, row) => sum + row.tokens, 0)
  if (total <= 0) return []
  const parts = rows.map(row => {
    const exact = (row.tokens / total) * width
    const min = row.kind === 'used' && row.tokens > 0 ? 1 : 0
    return { row, exact, min, cells: Math.max(min, Math.floor(exact)) }
  })
  let left = width - parts.reduce((sum, p) => sum + p.cells, 0)

  const byRemainder = [...parts].sort((a, b) => (b.exact - b.cells) - (a.exact - a.cells))
  for (let k = 0; left > 0; k++, left--) byRemainder[k % byRemainder.length]!.cells++

  // The minimum cells can overshoot: take them back from the widest segments.
  while (left < 0) {
    const widest = parts.filter(p => p.cells > p.min).sort((a, b) => b.cells - a.cells)[0]
    if (!widest) break
    widest.cells--
    left++
  }

  return parts.filter(p => p.cells > 0).map(({ row, cells }) => ({ row, cells }))
}

const glyph = { used: '▰', free: '▱', buffer: '▒' } as const

// Simple mode: grey for the system's own context, blue for what you add, yellow for the conversation.
// The breakdown has no kind finer than `used`, so the group is read off the row's /context label.
const SIMPLE = [
  { name: 'System', color: 'gray' },
  { name: 'Custom', color: 'blue' },
  { name: 'Messages', color: 'yellow' },
] as const

const groupOf = (row: ContextCategory) =>
  /^messages$/i.test(row.name) ? 2 : /agent|memory|skill/i.test(row.name) ? 1 : 0

const simplify = (used: ContextCategory[]): ContextCategory[] =>
  SIMPLE.map((group, i) => ({
    name: group.name,
    color: group.color,
    kind: 'used' as const,
    isDeferred: false,
    tokens: used.filter(row => groupOf(row) === i).reduce((sum, row) => sum + row.tokens, 0),
  }))

export const register: Register = (on, options) => {
  const mode = options.mode === 'granular' ? 'granular' : 'simple'

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const { Box, Text } = $.ui.resolve(e)
    const percent = context.percent
    const engine = await next(e)

    // Deferred tool schemas sit outside the window; /context leaves them off its grid too.
    const rows = (context.breakdown?.categories ?? []).filter(row => row.kind !== 'deferred')
    const categories = rows.filter(row => row.kind === 'used')
    const used = mode === 'simple' ? simplify(categories) : categories
    const segments = allocate([...used, ...rows.filter(row => row.kind === 'free'), ...rows.filter(row => row.kind === 'buffer')])

    let bar
    if (segments.length > 0) {
      bar = segments.map(({ row, cells }) => (
        <Text color={row.kind === 'used' ? row.color : 'inactive'}>
          {glyph[row.kind as keyof typeof glyph].repeat(cells)}
        </Text>
      ))
    } else {
      const filled = percent === undefined ? 0 : Math.round((percent / 100) * WIDTH)
      bar = [
        <Text color={percent === undefined ? 'inactive' : colorFor(percent)}>{'▰'.repeat(filled)}</Text>,
        <Text color="inactive">{'▱'.repeat(WIDTH - filled)}</Text>,
      ]
    }

    return (
      <Box>
        {engine}
        {e.props.modes.length > 0 ? <Text dimColor> · </Text> : null}
        {bar}
        <Text color={percent === undefined ? 'inactive' : colorFor(percent)}>
          {' '}{percent === undefined ? '--' : `${percent}%`}
        </Text>
      </Box>
    )
  })

  // Context grows with each API response: redraw after turns, tool calls and compactions.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')
    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')
    return result
  }).catch(($, e, next) => next(e))
}
