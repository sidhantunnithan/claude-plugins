import type { EngineInterface, Register } from 'claude-code'

// What /rename prints, saved as the command's output row. A bare /rename names the
// session itself, and this row is the only place the plugin can read that name.
const RENAMED = /^<local-command-stdout>Session renamed to: (.+)<\/local-command-stdout>$/s

const renamedTo = (content: unknown) => {
  const text = Array.isArray(content)
    ? content.map(block => (block?.type === 'text' ? block.text : '')).join('')
    : typeof content === 'string' ? content : ''
  return RENAMED.exec(text.trim())?.[1]?.trim()
}

// Outside tmux there is no window to name, so every call is a no-op.
async function nameWindow($: EngineInterface, title: string) {
  const pane = await $.env.get('TMUX_PANE')
  if (pane) await $.process.run(['tmux', 'rename-window', '-t', pane, title])
}

// The session's name as /rename last set it: the newest custom-title row of its
// transcript. classic.SessionStart would carry it, but plugins at the user tier
// are bypassed on that event, so the hook never runs in a real session.
async function sessionTitle($: EngineInterface) {
  const id = await $.session.id()
  const { stdout } = await $.process.run([
    'sh', '-c',
    'cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl 2>/dev/null | grep \'"type":"custom-title"\' | tail -n 1',
    'sh', id,
  ])
  if (!stdout.trim()) return undefined
  return (JSON.parse(stdout) as { customTitle?: string }).customTitle?.trim() || undefined
}

// rename-window turns automatic-rename off for the window; turning it back on
// hands the name back to tmux (the running command) once the session is over.
async function releaseWindow($: EngineInterface) {
  const pane = await $.env.get('TMUX_PANE')
  if (pane) await $.process.run(['tmux', 'set-option', '-w', '-t', pane, 'automatic-rename', 'on'])
}

export const register: Register = on => {
  // /rename <name>: the name is in the args, so the window follows at once.
  on('command.run', { command: 'rename' }, async ($, e, next) => {
    const result = await next(e)
    const title = e.args.trim()
    if (title) await nameWindow($, title)
    return result
  }).catch(($, e, next) => next(e))

  // Bare /rename: read the generated name off the command's output row.
  on('session.append', { door: 'command' }, async ($, e, next) => {
    const result = await next(e)
    const title = renamedTo(e.message.content)
    if (title) await nameWindow($, title)
    return result
  }).catch(($, e, next) => next(e))

  // /resume: the session.end it raises (reason resume) has just handed the window
  // back to tmux, so name it after the session now running.
  on('command.run', { command: 'resume' }, async ($, e, next) => {
    const result = await next(e)
    const title = await sessionTitle($)
    if (title) await nameWindow($, title)
    return result
  }).catch(($, e, next) => next(e))

  // claude --resume / --continue: a named session names the window as it starts.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const title = await sessionTitle($)
    if (title) await nameWindow($, title)
    return result
  }).catch(($, e, next) => next(e))

  // Covers exit and /clear, after which the conversation has no name of its own.
  on('session.end', async ($, e, next) => {
    const result = await next(e)
    await releaseWindow($)
    return result
  }).catch(($, e, next) => next(e))
}
