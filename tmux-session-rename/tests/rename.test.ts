import { expect, test } from 'claude-code/testing'

// Hooks beneath the plugin: a tmux pane (or none), the session's transcript title
// (or none) and a record of the tmux calls made.
const tmux = (on: any, pane: string | null = '%7', title: string | null = null) => {
  const calls: string[][] = []
  on('env.get', () => ({ value: pane ?? undefined }) as never)
  on('session.id', () => ({ value: 's' }) as never)
  on('process.run', (_: any, e: any) => {
    if (e.argv[0] === 'sh') {
      const row = title === null ? '' : JSON.stringify({ type: 'custom-title', customTitle: title, sessionId: 's' }) + '\n'
      return { value: { exitCode: 0, stdout: row, stderr: '' } } as never
    }
    calls.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('command.run', () => ({ ref: 1 }) as never)
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }) as never)
  on('session.end', () => ({ sessionId: 's' }) as never)
  return calls
}

const run = ($: any, args: string) => $.command.run({ command: 'rename', args })

// A command's output row, appended as the engine appends one.
const appendOutput = ($: any, text: string) =>
  $.session.append({
    message: { type: 'system', name: 'local_command', role: 'user', content: [{ type: 'text', text }] },
    door: 'command',
    origin: { kind: 'engine' },
    uuid: 'row-1',
  })

test('/rename <name> names the window at once', async ($, on) => {
  const calls = tmux(on)
  await run($, 'fix login bug')
  expect(calls).toEqual([['tmux', 'rename-window', '-t', '%7', 'fix login bug']])
})

test('a bare /rename names the window from the output row', async ($, on) => {
  const calls = tmux(on)
  await run($, '')
  expect(calls).toEqual([])
  await appendOutput($, '<local-command-stdout>Session renamed to: reply-with-ok</local-command-stdout>')
  expect(calls).toEqual([['tmux', 'rename-window', '-t', '%7', 'reply-with-ok']])
})

test('other command output leaves the window alone', async ($, on) => {
  const calls = tmux(on)
  await appendOutput($, '<local-command-stdout>Reloaded: 6 plugins</local-command-stdout>')
  expect(calls).toEqual([])
})

const start = ($: any) => $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })

test('/resume names the window after the resumed session', async ($, on) => {
  const calls = tmux(on, '%7', 'probe-one')
  await $.command.run({ command: 'resume', args: '' })
  expect(calls).toEqual([['tmux', 'rename-window', '-t', '%7', 'probe-one']])
})

test('/resume into an unnamed session leaves the window alone', async ($, on) => {
  const calls = tmux(on)
  await $.command.run({ command: 'resume', args: '' })
  expect(calls).toEqual([])
})

test('a named session names the window as it starts', async ($, on) => {
  const calls = tmux(on, '%7', 'probe-one')
  await start($)
  expect(calls).toEqual([['tmux', 'rename-window', '-t', '%7', 'probe-one']])
})

test('an unnamed session start leaves the window alone', async ($, on) => {
  const calls = tmux(on)
  await start($)
  expect(calls).toEqual([])
})

test('session end hands the name back to tmux', async ($, on) => {
  const calls = tmux(on)
  await $.session.end({ reason: 'clear', sessionId: 's', resume: {} as never } as never)
  expect(calls).toEqual([['tmux', 'set-option', '-w', '-t', '%7', 'automatic-rename', 'on']])
})

test('outside tmux nothing runs', async ($, on) => {
  const calls = tmux(on, null, 'probe-one')
  await run($, 'fix login bug')
  await $.command.run({ command: 'resume', args: '' })
  await start($)
  expect(calls).toEqual([])
})
