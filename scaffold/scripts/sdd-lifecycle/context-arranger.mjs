/**
 * scripts/sdd-lifecycle/context-arranger.mjs
 *
 * Context Arranger & Relevance-Contrast Engine for AOI workflows.
 * Implements context stratification, calibrated signal-to-noise batching (50:50 / 70:30),
 * and positional optimization based on the empirical findings of Shamay (2026).
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Arranges items with a calibrated signal/noise ratio for relevance contrast.
 *
 * @param {object} options
 * @param {Array<object>} options.signalItems - High relevance / target items.
 * @param {Array<object>} [options.backgroundItems] - Same-domain low-relevance items for calibration.
 * @param {number} [options.targetRatio] - Fraction of signal items in window (e.g. 0.5 for 50:50, 0.7 for 70:30). Default 0.5.
 * @param {'start'|'end'|'scattered'} [options.position] - Placement of signal items in the batch. Default 'end'.
 * @param {number} [options.maxItems] - Maximum total items in prompt window. Default 10.
 * @returns {Array<object>} Calibrated and arranged array of items.
 */
export function arrangeContext({
  signalItems = [],
  backgroundItems = [],
  targetRatio = 0.5,
  position = 'end',
  maxItems = 10,
}) {
  if (!Array.isArray(signalItems) || signalItems.length === 0) {
    return backgroundItems.slice(0, maxItems)
  }

  // If no background items available, return signal items capped at maxItems
  if (!Array.isArray(backgroundItems) || backgroundItems.length === 0) {
    return signalItems.slice(0, maxItems)
  }

  const signalCount = Math.max(1, Math.min(signalItems.length, Math.round(maxItems * targetRatio)))
  const backgroundCount = Math.max(0, Math.min(backgroundItems.length, maxItems - signalCount))

  const selectedSignals = signalItems.slice(0, signalCount)
  const selectedBackgrounds = backgroundItems.slice(0, backgroundCount)

  if (position === 'start') {
    return [...selectedSignals, ...selectedBackgrounds]
  }

  if (position === 'end') {
    return [...selectedBackgrounds, ...selectedSignals]
  }

  // Interleaved / scattered placement
  const result = []
  let sIdx = 0
  let bIdx = 0
  while (sIdx < selectedSignals.length || bIdx < selectedBackgrounds.length) {
    if (sIdx < selectedSignals.length) {
      result.push(selectedSignals[sIdx++])
    }
    if (bIdx < selectedBackgrounds.length) {
      result.push(selectedBackgrounds[bIdx++])
    }
  }

  return result
}

/**
 * Stratifies a collection of context items by domain/type.
 *
 * @param {Array<{ type?: string, domain?: string, [key: string]: any }>} items
 * @returns {Record<string, Array<object>>}
 */
export function stratifyByDomain(items = []) {
  if (!Array.isArray(items)) return {}

  const buckets = {}
  for (const item of items) {
    const domain = item.domain || item.type || 'general'
    if (!buckets[domain]) {
      buckets[domain] = []
    }
    buckets[domain].push(item)
  }

  return buckets
}

/**
 * Formats arranged items into a structured prompt context block.
 *
 * @param {Array<{ id?: string, title?: string, content?: string, relevance?: number|string }>} arrangedItems
 * @returns {string}
 */
export function formatArrangedContext(arrangedItems = []) {
  if (!Array.isArray(arrangedItems) || arrangedItems.length === 0) {
    return ''
  }

  const lines = ['<!-- CALIBRATED_CONTEXT_START -->']
  for (const [idx, item] of arrangedItems.entries()) {
    const id = item.id || `item-${idx + 1}`
    const title = item.title ? ` - ${item.title}` : ''
    lines.push(`### [${id}]${title}`)
    if (item.content) {
      lines.push(item.content.trim())
    }
  }
  lines.push('<!-- CALIBRATED_CONTEXT_END -->')

  return lines.join('\n')
}

// CLI Execution
export async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(
      `Usage: node scripts/sdd-lifecycle/context-arranger.mjs --signals <signals.json> [--background <bg.json>] [--ratio 0.5] [--pos end]\n`
    )
    process.exit(0)
  }

  let signalItems = []
  let backgroundItems = []
  let targetRatio = 0.5
  let position = 'end'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--signals' && args[i + 1]) {
      const file = args[++i]
      if (fs.existsSync(file)) signalItems = JSON.parse(fs.readFileSync(file, 'utf8'))
    } else if (args[i] === '--background' && args[i + 1]) {
      const file = args[++i]
      if (fs.existsSync(file)) backgroundItems = JSON.parse(fs.readFileSync(file, 'utf8'))
    } else if (args[i] === '--ratio' && args[i + 1]) {
      targetRatio = parseFloat(args[++i]) || 0.5
    } else if (args[i] === '--pos' && args[i + 1]) {
      position = args[++i]
    }
  }

  const arranged = arrangeContext({ signalItems, backgroundItems, targetRatio, position })
  process.stdout.write(formatArrangedContext(arranged) + '\n')
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}

