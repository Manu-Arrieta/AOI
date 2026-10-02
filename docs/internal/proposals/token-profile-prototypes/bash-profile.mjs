// Agrupa la salida de Bash por el comando real (después de `cd ... &&`) y mide
// la longitud de las sesiones: cuántos requests y cuánto contexto releído cada una.
import fs from 'node:fs'; import path from 'node:path'; import readline from 'node:readline'
const root = process.argv[2]; const files = []
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.jsonl')) files.push(p) } }
walk(root)
const bash = {}; const sess = []
for (const f of files) {
  const uses = new Map(); let req = 0, cr = 0, maxCtx = 0; const seen = new Set()
  for await (const line of readline.createInterface({ input: fs.createReadStream(f) })) {
    let e; try { e = JSON.parse(line) } catch { continue }
    const us = e.message?.usage
    if (e.type === 'assistant' && us && !seen.has(e.message.id)) { seen.add(e.message.id); req++; const ctx = (us.cache_read_input_tokens ?? 0) + (us.cache_creation_input_tokens ?? 0) + (us.input_tokens ?? 0); cr += ctx; maxCtx = Math.max(maxCtx, ctx) }
    const c = e.message?.content; if (!Array.isArray(c)) continue
    for (const x of c) {
      if (x.type === 'tool_use' && x.name === 'Bash') uses.set(x.id, x)
      if (x.type === 'tool_result' && uses.has(x.tool_use_id)) {
        let cmd = String(uses.get(x.tool_use_id).input?.command ?? '').replace(/^\s*cd\s+("[^"]*"|\S+)\s*(&&|;)\s*/, '').replace(/^(\w+=\S+\s+)+/, '')
        let k = cmd.split(/\s+/).slice(0, 2).join(' ')
        if (/^(node|pnpm)$/.test(k.split(' ')[0])) k = cmd.split(/\s+/).slice(0, 2).join(' ').replace(/scripts\/[\w-]+\//, '')
        const b = JSON.stringify(x.content ?? '').length
        ;(bash[k] ??= { n: 0, b: 0 }); bash[k].n++; bash[k].b += b
      }
    }
  }
  if (req) sess.push({ f: path.basename(f), sub: f.includes('/subagents/'), req, cr, maxCtx })
}
const K = (b) => `${Math.round(b / 1024)}KB`
console.log('Bash: comando real, top 14 por bytes de salida')
for (const [k, v] of Object.entries(bash).sort((a, b) => b[1].b - a[1].b).slice(0, 14)) console.log(`  ${K(v.b).padStart(7)} n=${String(v.n).padStart(4)} avg=${K(v.b / v.n).padStart(5)}  ${k.slice(0, 60)}`)
const main = sess.filter((s) => !s.sub), sub = sess.filter((s) => s.sub)
const agg = (a) => ({ n: a.length, req: a.reduce((s, x) => s + x.req, 0), cr: a.reduce((s, x) => s + x.cr, 0) })
for (const [name, a] of [['principal', main], ['subagentes', sub]]) { const g = agg(a); console.log(`${name}: sesiones=${g.n} requests=${g.req} contexto releído=${(g.cr / 1e6).toFixed(0)}M tok (${(g.cr / g.req / 1000).toFixed(0)}k/request)`) }
main.sort((a, b) => b.cr - a.cr)
console.log('sesiones principales más caras (contexto releído):')
for (const s of main.slice(0, 5)) console.log(`  ${(s.cr / 1e6).toFixed(0)}M tok  req=${s.req}  pico=${Math.round(s.maxCtx / 1000)}k`)
const top5 = main.slice(0, 5).reduce((s, x) => s + x.cr, 0), all = agg(main).cr
console.log(`las 5 más caras = ${(100 * top5 / all).toFixed(0)}% del contexto releído de todas las sesiones principales`)
