import type { Register } from 'claude-code'

const WIDTH = 10

const colorFor = (percent: number) =>
  percent >= 80 ? 'error' : percent >= 60 ? 'warning' : 'success'

export const register: Register = on => {
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { context } = await $.session.usage()
    const { Box, Text } = $.ui.resolve(e)
    const percent = context.percent
    const filled = percent === undefined ? 0 : Math.round((percent / 100) * WIDTH)
    const engine = await next(e)

    return (
      <Box>
        {engine}
        {e.props.modes.length > 0 ? <Text dimColor> · </Text> : null}
        <Text color={percent === undefined ? 'inactive' : colorFor(percent)}>
          {'▰'.repeat(filled)}
        </Text>
        <Text color="inactive">{'▱'.repeat(WIDTH - filled)}</Text>
        <Text dimColor> {percent === undefined ? '--' : `${percent}%`}</Text>
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
