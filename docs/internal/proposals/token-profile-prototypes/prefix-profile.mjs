// (1) Prefijo fijo vs crecimiento: el contexto del primer request de una sesión
// aproxima el prefijo siempre cargado; lo demás es conversación acumulada.
// (2) Recall repetido: líneas de UserPromptSubmit ya inyectadas antes en la MISMA sesión.
import fs from 'node:fs'; import path from 'node:path'; import readline from 'node:readline'
const root = process.argv[2]
const files = fs.readdirSync(root).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(root, f))
let fixed = 0, total = 0, rl = 0, rlRep = 0, rlBytes = 0, rlRepBytes = 0
for (const f of files) {
  let first = 0, req = 0, sum = 0; const seen = new Set(); const lines = new Set()
  for await (const line of readline.createInterface({ input: fs.createReadStream(f) })) {
    let e; try { e = JSON.parse(line) } catch { continue }
    const us = e.message?.usage
    if (e.type === 'assistant' && us && !seen.has(e.message.id)) {
      seen.add(e.message.id); req++
      const ctx = (us.cache_read_input_tokens ?? 0) + (us.cache_creation_input_tokens ?? 0) + (us.input_tokens ?? 0)
      if (!first) first = ctx; sum += ctx
    }
    const a = e.attachment
    if (e.type === 'attachment' && a?.hookEvent === 'UserPromptSubmit' && a.content) {
      for (const l of String(a.content).split('\n').filter((l) => l.startsWith('- '))) {
        rl++; rlBytes += l.length
        if (lines.has(l)) { rlRep++; rlRepBytes += l.length } else lines.add(l)
      }
    }
  }
  fixed += first * req; total += sum
}
console.log(`prefijo fijo × requests = ${(fixed / 1e6).toFixed(0)}M de ${(total / 1e6).toFixed(0)}M releídos (${(100 * fixed / total).toFixed(1)}%); crecimiento de conversación = ${(100 - 100 * fixed / total).toFixed(1)}%`)
console.log(`recall: ${rl} líneas, repetidas dentro de la misma sesión = ${rlRep} (${(100 * rlRep / rl).toFixed(1)}%), ${Math.round(rlRepBytes / 1024)}KB de ${Math.round(rlBytes / 1024)}KB`)
