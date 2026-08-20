/**
 * scripts/aoi-os/tui/ascii-dag-renderer.mjs
 *
 * Deterministic ASCII & ANSI DAG Wave Renderer for Terminal UI in AOI-OS:
 * Formats parallel DAG execution batches into visual terminal ASCII boxes and dependency arrows (0 LLM Tokens).
 */

/**
 * Renders an ASCII box representing a single DAG wave.
 *
 * @param {number} waveIndex
 * @param {Array<object>} tasks
 * @returns {string[]} Lines of box
 */
function renderWaveBox(waveIndex, tasks = []) {
  const width = 64
  const header = ` Wave ${waveIndex + 1} [${tasks.length} task${tasks.length === 1 ? '' : 's'}] `
  const topBorder = `┌${header.padEnd(width - 2, '─')}┐`
  const bottomBorder = `└${'─'.repeat(width - 2)}┘`

  const lines = [topBorder]

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const prefix = i === tasks.length - 1 ? '└─' : '├─'
    const roleTag = task.role ? `(@${task.role})` : ''
    const content = ` ${prefix} [${task.id}] ${task.title || 'Task'} ${roleTag}`
    const padded = content.length > width - 2 ? content.slice(0, width - 5) + '...' : content.padEnd(width - 2, ' ')
    lines.push(`│${padded}│`)
  }

  lines.push(bottomBorder)
  return lines
}

/**
 * Renders an entire multi-wave DAG into a printable ASCII diagram.
 *
 * @param {Array<Array<object>>} waves - Array of execution waves
 * @returns {string} ASCII rendered DAG
 */
export function renderAsciiDag(waves = []) {
  if (!waves || waves.length === 0) {
    return '┌──────────────────────────────┐\n│       Empty Task Graph       │\n└──────────────────────────────┘'
  }

  const allLines = []
  const centerPad = ' '.repeat(31)

  for (let i = 0; i < waves.length; i++) {
    const boxLines = renderWaveBox(i, waves[i])
    allLines.push(...boxLines)

    if (i < waves.length - 1) {
      allLines.push(`${centerPad}│`)
      allLines.push(`${centerPad}▼`)
    }
  }

  return allLines.join('\n')
}
