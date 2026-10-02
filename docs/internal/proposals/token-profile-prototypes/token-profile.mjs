// Perfil de consumo real sobre transcripts de Claude Code (sesiones + subagentes).
// Mide: uso de prompt-cache por request, tamaño de Read, comandos Bash más caros,
// y cuánto del recall de UserPromptSubmit es ruido. Bytes; tokens ≈ bytes/4.
import fs from 'node:fs'; import path from 'node:path'; import readline from 'node:readline'
const root = process.argv[2]
const files = []
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.jsonl')) files.push(p) } }
walk(root)
const u = { req: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
const reads = []; const bash = {}; const recall = { fires: 0, bytes: 0, junkLines: 0, lines: 0, shortPrompt: 0, shortBytes: 0 }
const prompts = new Map()
for (const f of files) {
  const uses = new Map()
  for await (const line of readline.createInterface({ input: fs.createReadStream(f) })) {
    let e; try { e = JSON.parse(line) } catch { continue }
    const us = e.message?.usage
    if (e.type === 'assistant' && us && e.message?.id && !prompts.has(e.message.id)) {
      prompts.set(e.message.id, 1); u.req++
      u.input += us.input_tokens ?? 0; u.cacheRead += us.cache_read_input_tokens ?? 0
      u.cacheWrite += us.cache_creation_input_tokens ?? 0; u.output += us.output_tokens ?? 0
    }
    if (e.type === 'user' && typeof e.message?.content === 'string') e.__lastPrompt = e.message.content
    const a = e.attachment
    if (e.type === 'attachment' && a?.hookEvent === 'UserPromptSubmit' && a.content) {
      const body = String(a.content); recall.fires++; recall.bytes += body.length
      for (const l of body.split('\n').filter((l) => l.startsWith('- '))) {
        recall.lines++
        if (/^- (\d+\s|\/\/|\s*\*|Structured output|These outputs|The outputs)/.test(l)) recall.junkLines++
      }
    }
    const c = e.message?.content; if (!Array.isArray(c)) continue
    for (const x of c) {
      if (x.type === 'text' && e.type === 'user' && x.text && x.text.length < 25 && !x.text.startsWith('<')) recall.shortPrompt++
      if (x.type === 'tool_use') uses.set(x.id, x)
      if (x.type === 'tool_result') {
        const t = uses.get(x.tool_use_id); if (!t) continue
        const b = JSON.stringify(x.content ?? '').length
        if (t.name === 'Read') reads.push({ b, file: t.input?.file_path ?? '', limit: t.input?.limit })
        if (t.name === 'Bash') { const k = String(t.input?.command ?? '').trim().split(/\s+/).slice(0, 2).join(' ').replace(/^cd$/, 'cd'); (bash[k] ??= { n: 0, b: 0 }); bash[k].n++; bash[k].b += b }
      }
    }
  }
}
const K = (b) => `${Math.round(b / 1024)}KB`
const tot = u.input + u.cacheRead + u.cacheWrite
console.log(`archivos=${files.length} requests=${u.req}`)
console.log(`input fresco=${(u.input/1e6).toFixed(2)}M  cache_read=${(u.cacheRead/1e6).toFixed(1)}M  cache_write=${(u.cacheWrite/1e6).toFixed(2)}M  output=${(u.output/1e6).toFixed(2)}M`)
console.log(`hit-rate de cache (read / todo el input)=${(100*u.cacheRead/tot).toFixed(1)}%  write/read=${(u.cacheWrite/u.cacheRead).toFixed(3)}`)
reads.sort((a, b) => b.b - a.b)
const rTot = reads.reduce((s, r) => s + r.b, 0), rFull = reads.filter((r) => !r.limit)
console.log(`Read: ${reads.length} llamadas, ${K(rTot)}; sin limit=${rFull.length} (${K(rFull.reduce((s,r)=>s+r.b,0))}); >20KB: ${reads.filter(r=>r.b>20480).length} (${K(reads.filter(r=>r.b>20480).reduce((s,r)=>s+r.b,0))})`)
for (const r of reads.slice(0, 5)) console.log(`   ${K(r.b).padStart(6)} ${r.file.replace(/.*GITHUB MIGRATION\//, '')}`)
console.log('Bash top por bytes de salida:')
for (const [k, v] of Object.entries(bash).sort((a, b) => b[1].b - a[1].b).slice(0, 10)) console.log(`   ${K(v.b).padStart(6)} n=${String(v.n).padStart(4)}  ${k.slice(0, 50)}`)
console.log(`Recall UserPromptSubmit: fires=${recall.fires} ${K(recall.bytes)}; líneas=${recall.lines} basura=${recall.junkLines} (${(100*recall.junkLines/Math.max(1,recall.lines)).toFixed(1)}%); prompts cortos (<25 chars)=${recall.shortPrompt}`)
