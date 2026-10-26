import type { ContextCategory, Register } from 'claude-code'

const WIDTH = 20
const FIVE_HOUR_WIDTH = 10

// Catppuccin Mocha as its nearest xterm-256 colours. Inside tmux Claude Code rounds each
// channel to six steps (round(v / 51)), so each value sits in the step of the palette
// entry it stands for and lands on exactly that entry; elsewhere it draws as given,
// a few points off the entry at most.
const MOCHA = {
  teal: '#7fd7d7',
  green: '#7fd77f',
  yellow: '#ffd7af',
  red: '#ff7faf',
  blue: '#7fafff',
  overlay1: '#7f7faf',
  surface2: '#4c4c7f',
} as const

const colorFor = (percent: number) =>
  percent >= 80 ? MOCHA.red : percent >= 60 ? MOCHA.yellow : MOCHA.green

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

// The 5h window as one thin continuous line, filled from the left.
const slab = (width = FIVE_HOUR_WIDTH) => Array.from({ length: width }, () => '━')

// Intl names a zone only in the locales that use it; these are the English ones that name any zone
// (IST only in en-IN, SGT only in en-SG). A zone none of them names reads as its offset (GMT+9).
const NAMING_LOCALES = ['en-CA', 'en-GB', 'en-BW', 'en-NZ', 'en-ID', 'en-SG', 'en-GU', 'en-IN', 'en-GY', 'en-HK', 'en-IE']

// Reset time on a 24-hour clock in `timeZone` (an IANA name), then the zone's abbreviation;
// host time, with no abbreviation, for Host, empty or unknown.
const clockFormat = (timeZone: string | undefined) => {
  const time = (zone?: string) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone })
  const zone = timeZone && timeZone !== 'Host' ? timeZone : undefined
  try {
    const format = time(zone)
    if (!zone) return (at: number) => format.format(at)
    const names = NAMING_LOCALES.map(locale => new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' }))
    const nameAt = (at: number) => {
      const found = names.map(f => f.formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? '')
      return found.find(name => name && !/^GMT[+-]|Time$/.test(name)) ?? found[0]
    }
    return (at: number) => `${format.format(at)} (${nameAt(at)})`
  } catch {
    const format = time()
    return (at: number) => format.format(at)
  }
}

const clockTime = (iso: string | undefined, clock: (at: number) => string) => {
  const at = iso === undefined ? NaN : Date.parse(iso)
  return Number.isNaN(at) ? '--:--' : clock(at)
}

// Simple mode: grey for the system's own context, blue for what you add, yellow for the conversation.
// The breakdown has no kind finer than `used`, so the group is read off the row's /context label.
const SIMPLE = [
  { name: 'System', color: MOCHA.overlay1 },
  { name: 'Custom', color: MOCHA.blue },
  { name: 'Messages', color: MOCHA.yellow },
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

// Shorthand labels for the line under the bar; an unlisted category falls back to its first word.
const SHORT: [RegExp, string][] = [
  [/^system prompt/i, 'sys'],
  [/^system tools/i, 'tools'],
  [/^mcp/i, 'mcp'],
  [/agent/i, 'agents'],
  [/memory/i, 'mem'],
  [/skill/i, 'skills'],
  [/command/i, 'cmds'],
  [/^messages/i, 'msgs'],
  [/^system$/i, 'sys'],
  [/^custom$/i, 'custom'],
]

const shortName = (name: string) =>
  SHORT.find(([pattern]) => pattern.test(name))?.[1] ?? (name.split(' ')[0] ?? name).toLowerCase()

const shortTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`

const MAX_CWD = 40

// Home as ~, then cut from the left so the end of the path stays readable.
const shortCwd = (cwd: string, home: string | undefined) => {
  const path = home && (cwd === home || cwd.startsWith(`${home}/`)) ? `~${cwd.slice(home.length)}` : cwd
  return path.length > MAX_CWD ? `…${path.slice(-(MAX_CWD - 1))}` : path
}

// $.session.model() gives the id (`claude-opus-5-5[1m]`); show it the way the welcome banner does.
const modelName = (id: string) => {
  const match = /^(?:claude-)?([a-z]+)((?:-\d{1,2})*)(?:-\d{8})?(\[1m\])?$/i.exec(id)
  if (!match) return id
  const [, family = '', version = '', isLong] = match
  const name = family[0]!.toUpperCase() + family.slice(1) + (version ? ` ${version.slice(1).replace(/-/g, '.')}` : '')
  return isLong ? `${name} (1M context)` : name
}

type Show = { model: boolean; cwd: boolean; bar: boolean; fiveHour: boolean }

export const register: Register = (on, options) => {
  const mode = options.mode === 'granular' ? 'granular' : 'simple'
  const show: Show = {
    model: options.showModel !== false,
    cwd: options.showCwd !== false,
    bar: options.showBar !== false,
    fiveHour: options.showFiveHour !== false,
  }
  const clock = clockFormat(typeof options.timeZone === 'string' ? options.timeZone.trim() : undefined)

  // Model, directory and the 5h window at the left of the footer, drawn with the engine's hint line.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const engine = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    // Off a subscription there is no 5h window, so no bar.
    const { rateLimits } = show.fiveHour ? await $.session.usage() : { rateLimits: [] }
    const fiveHour = rateLimits.find(limit => limit.kind === 'five_hour')
    let fiveHourBar = null
    if (fiveHour) {
      const cells = slab()
      const filled = Math.min(FIVE_HOUR_WIDTH, Math.round((fiveHour.percentUsed / 100) * FIVE_HOUR_WIDTH))
      fiveHourBar = [
        <Text color={MOCHA.blue}>5h </Text>,
        <Text color={MOCHA.blue}>{cells.slice(0, filled).join('')}</Text>,
        <Text color={MOCHA.surface2}>{cells.slice(filled).join('')}</Text>,
        <Text color={MOCHA.blue}> {Math.round(fiveHour.percentUsed)}% » {clockTime(fiveHour.resetsAt, clock)}</Text>,
      ]
    }

    if (!show.model && !show.cwd && !fiveHourBar) return engine
    return (
      <Box flexDirection="column">
        <Box>
          {show.model ? <Text color={MOCHA.teal}>{modelName(await $.session.model())}</Text> : null}
          {show.model && show.cwd ? <Text> </Text> : null}
          {show.cwd ? <Text color={MOCHA.green}>{shortCwd(await $.session.cwd(), await $.env.get('HOME'))}</Text> : null}
          {(show.model || show.cwd) && fiveHourBar ? <Text> </Text> : null}
          {fiveHourBar}
        </Box>
        {engine}
      </Box>
    )
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const engine = await next(e)

    if (!show.bar) return engine

    const { context } = await $.session.usage({ breakdown: 'summary' })

    // Drawn against the model's whole window, not the compaction window the breakdown's free and
    // buffer rows fill; deferred tool schemas sit outside it, as /context leaves them off its grid.
    const categories = (context.breakdown?.categories ?? []).filter(row => row.kind === 'used')
    const used = mode === 'simple' ? simplify(categories) : categories
    const usedTokens = categories.reduce((sum, row) => sum + row.tokens, 0)
    const free: ContextCategory = { name: 'Free space', color: MOCHA.surface2, kind: 'free', isDeferred: false, tokens: Math.max(0, context.window - usedTokens) }
    const segments = categories.length > 0 ? allocate([...used, free]) : []

    // The percent is read off the rows the bar draws, so the two never disagree; the API's
    // figure is absent from a compaction to the next response.
    const percent = segments.length > 0 ? Math.round((usedTokens / context.window) * 100) : context.percent

    let bar
    if (segments.length > 0) {
      bar = segments.map(({ row, cells }) => (
        <Text color={row.kind === 'used' ? row.color : MOCHA.surface2}>
          {glyph[row.kind as keyof typeof glyph].repeat(cells)}
        </Text>
      ))
    } else {
      const filled = percent === undefined ? 0 : Math.round((percent / 100) * WIDTH)
      bar = [
        <Text color={percent === undefined ? MOCHA.surface2 : colorFor(percent)}>{'▰'.repeat(filled)}</Text>,
        <Text color={MOCHA.surface2}>{'▱'.repeat(WIDTH - filled)}</Text>,
      ]
    }

    const labelled = used.filter(row => row.tokens > 0)
    const legend = labelled.map((row, i) => (
      <Text color={row.color}>
        {i > 0 ? ' · ' : ''}{shortName(row.name)} {shortTokens(row.tokens)}
      </Text>
    ))

    return (
      <Box flexDirection="column" alignItems="flex-end">
        <Box>
          {engine}
          {e.props.modes.length > 0 ? <Text dimColor> · </Text> : null}
          {bar}
          <Text color={percent === undefined ? MOCHA.surface2 : colorFor(percent)}>
            {' '}{percent === undefined ? '--' : `${percent}%`}
          </Text>
        </Box>
        {legend.length > 0 ? <Box>{legend}</Box> : null}
      </Box>
    )
  })

  // Context grows with each API response: redraw after turns, tool calls and compactions.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')
    return result
  })

  // A compaction reaches no hook of an installed plugin on Team and Enterprise organizations (the
  // built-in security plugin passes it on past them), but it clears the API's figure: watch that.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (!show.bar) return result
    let last: number | undefined
    $.clock.every(2000, async () => {
      const { context } = await $.session.usage()
      if (context.tokens !== last) $.ui.invalidate('ui.render')
      last = context.tokens
    })
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    $.ui.invalidate('ui.render')
    return result
  }).catch(($, e, next) => next(e))
}
