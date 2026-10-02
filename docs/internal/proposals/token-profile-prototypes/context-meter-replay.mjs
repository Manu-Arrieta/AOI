// Replay del medidor sobre los transcripts reales (sólo lectura).
// node context-meter-replay.mjs <worktree> <dir-de-transcripts>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [wt, dir] = process.argv.slice(2)
const T = await import(pathToFileURL(path.join(wt, 'scripts/sdd-lifecycle/context-transcript.mjs')))
const W = await import(pathToFileURL(path.join(wt, 'scripts/sdd-lifecycle/context-window.mjs')))
const M = await import(pathToFileURL(path.join(wt, 'scripts/sdd-lifecycle/context-meter.mjs')))

const isPrompt = (rec) => {
  if (rec.type !== 'user' || rec.isMeta || rec.isSidechain || rec.toolUseResult) return false
  const c = rec.message?.content
  if (typeof c === 'string') return true
  return Array.isArray(c) && !c.some((b) => b?.type === 'tool_result')
}

const rows = []
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  const lines = fs.readFileSync(path.join(dir, name), 'utf8').split('\n')
  const scan = T.emptyScan(name)
  const req = [] // contexto por request (exacto)
  let lastId = null
  let level = -1
  const fires = [] // {req, tokens, threshold, window, est}
  const prompts = [] // {req, threshold}: dónde dispara UserPromptSubmit
  for (const line of lines) {
    if (!line) continue
    let rec = null
    try { rec = JSON.parse(line) } catch {}
    if (rec && isPrompt(rec)) {
      // UserPromptSubmit: el hook ve el transcript hasta acá.
      const { tokens } = T.measure(scan)
      const { window } = W.resolveWindow({ model: T.effectiveModel(scan), maxUsage: scan.maxUsage })
      const threshold = W.thresholdFor(window)
      prompts.push({ req: req.length, threshold })
      const c = M.crossing(tokens, threshold, level)
      level = c.level
      if (c.fire) {
        fires.push({ req: req.length, tokens, threshold, window, est: Math.round(scan.contentBytes / 4) })
      }
    }
    T.scanLine(scan, line)
    const m = rec?.message
    if (rec && !rec.isSidechain && m?.id && m.model !== '<synthetic>' && m.id !== lastId) {
      const t = T.usageTotal(m.usage)
      if (t > 0) { req.push(t); lastId = m.id }
    }
  }
  if (req.length === 0) continue
  const total = req.reduce((a, b) => a + b, 0)
  // Simulación del corte: en cada aviso la sesión sigue en un contexto nuevo cuyo
  // arranque es F = contexto del primer request (prefijo fijo + primer prompt), y desde
  // ahí crece con los mismos incrementos. Una compactación real (caída > 50 %) reinicia.
  // Los cortes se deciden sobre el contexto VIRTUAL (el de la sesión nueva), en cada
  // prompt: la sesión nueva vuelve a avisar al cruzar su umbral.
  const F = req[0] + Number(process.env.HANDOFF ?? 0)
  let offset = 0
  let simulated = 0
  let splits = 0
  const at = new Map(prompts.map((p) => [p.req, p.threshold]))
  for (let i = 0; i < req.length; i++) {
    if (i > 0 && req[i] < req[i - 1] * 0.5) offset = 0
    if (i > 0 && at.has(i) && req[i - 1] - offset >= at.get(i)) { offset = Math.max(0, req[i - 1] - F); splits++ }
    simulated += Math.max(Math.min(req[i], F), req[i] - offset)
  }
  rows.push({ name, requests: req.length, total, peak: Math.max(...req), fires, simulated, F, splits })
}

rows.sort((a, b) => b.total - a.total)
const all = rows.reduce((a, r) => a + r.total, 0)
const allSim = rows.reduce((a, r) => a + r.simulated, 0)
const fmt = (n) => `${(n / 1e6).toFixed(1)}M`
console.log(`sesiones con usage: ${rows.length}; releído total ${fmt(all)}; simulado con cortes ${fmt(allSim)} (−${(100 * (1 - allSim / all)).toFixed(1)} %)`)
console.log(`sesiones que habrían recibido aviso: ${rows.filter((r) => r.fires.length).length}`)
for (const r of rows.slice(0, 10)) {
  const f = r.fires[0]
  const first = f ? `1er aviso en request ${f.req} de ${r.requests} (exacto ${Math.round(f.tokens / 1000)}k, est. ${Math.round(f.est / 1000)}k, umbral ${f.threshold / 1000}k, ventana ${f.window / 1000}k)` : 'sin aviso'
  console.log(`${r.name.slice(0, 8)} req=${r.requests} pico=${Math.round(r.peak / 1000)}k releído=${fmt(r.total)} avisos=${r.fires.length} cortes=${r.splits} → ${first}; F=${Math.round(r.F / 1000)}k; simulado=${fmt(r.simulated)} (−${(100 * (1 - r.simulated / r.total)).toFixed(1)} %)`)
}
const est = rows.flatMap((r) => r.fires.map((f) => f.est / f.tokens))
est.sort((a, b) => a - b)
if (est.length) console.log(`estimado/exacto en los avisos: mediana ${est[Math.floor(est.length / 2)].toFixed(2)}, min ${est[0].toFixed(2)}, max ${est.at(-1).toFixed(2)} (n=${est.length})`)
