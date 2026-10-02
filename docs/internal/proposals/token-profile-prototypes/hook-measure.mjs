// Mide disparos de hooks en los transcripts reales (sólo lectura).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'
const D = path.join(os.homedir(), '.claude/projects/-Users-equinox-Desktop-GITHUB-MIGRATION-AOI')
const files = fs.readdirSync(D).filter(f => f.endsWith('.jsonl'))
const agg = {}; const sessionsWith = {}
for (const f of files) {
  for (const line of fs.readFileSync(path.join(D, f), 'utf8').split('\n')) {
    if (!line.includes('"attachment"') || !line.includes('"hook')) continue
    let j; try { j = JSON.parse(line) } catch { continue }
    const a = j.attachment; if (!a?.type?.startsWith('hook_')) continue
    const key = `${a.hookEvent} | ${a.type} | ${a.command ?? '(n/a)'}`
    const g = agg[key] ??= { n: 0, bytes: 0, enoent: 0 }
    g.n++; g.bytes += Buffer.byteLength(String(a.content ?? a.stdout ?? '')); if (/No such file/.test(a.stderr ?? '')) g.enoent++
    ;(sessionsWith[a.hookEvent] ??= new Set()).add(f)
  }
}
console.log('transcripts', files.length)
for (const [k, g] of Object.entries(agg).sort((x, y) => y[1].bytes - x[1].bytes)) console.log(String(g.n).padStart(5), String(g.bytes).padStart(9), 'B', g.enoent ? `ENOENT=${g.enoent}` : '', k)
for (const [e, s] of Object.entries(sessionsWith)) console.log('sesiones con', e, s.size)
