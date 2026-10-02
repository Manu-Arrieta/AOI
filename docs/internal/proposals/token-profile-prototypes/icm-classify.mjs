// Clasifica memorias ICM contaminadas con reglas deterministas. Lee un dump JSON
// del RESPALDO; no toca la base viva. Imprime conteos y escribe la lista de ids.
import fs from 'node:fs'
const [, , dumpPath, outPath] = process.argv
const rows = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
const AOI_TOPIC = (t) => /aoi/i.test(t)
// Fragmento extraído de la salida de una herramienta: no es una frase, es una línea suelta.
const FRAGMENT = [
  /^\s*\d+\s*[:\s]\s*(\*|\/\/|['"`]|\S)/,     // "66     // ..." o "14:  ✖ ..." (número de línea)
  /^\s*(\/\/|\/\*|\*\s|\*$)/,                 // comentario de código suelto
  /^\s*['"`]/,                                // cita suelta de un string
  /^\s*[✖✔ℹ▶]/,                              // salida de node --test
  /^Structured output provided successfully$/,
]
// El texto con el que el extractor se niega a guardar algo, guardado como memoria.
const REFUSAL = /^(These outputs (are|contain)|The outputs (contain|are)|These (tool )?outputs)/i
// Aparece en pruebas descartables: nombre del workspace de test + sufijo aleatorio o de corrida.
const THROWAWAY_TOPIC = /^aoi-[a-z0-9.-]+-(context|errors-resolved|services-catalog|session-summaries)$|^aoi-probe-throwaway$/
const STALE_PATH = /scripts\/aoi-os\b/
const out = { fragment: [], refusal: [], throwaway: [], stale: [] }
for (const r of rows) {
  const s = r.summary ?? ''
  if (THROWAWAY_TOPIC.test(r.topic)) out.throwaway.push(r)
  else if (!AOI_TOPIC(r.topic)) { if (REFUSAL.test(s)) out.refusal.push(r); continue }
  else if (REFUSAL.test(s)) out.refusal.push(r)
  else if (s.length < 140 && FRAGMENT.some((re) => re.test(s))) out.fragment.push(r)
  else if (STALE_PATH.test(s)) out.stale.push(r)
}
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(10)} ${v.length}  (critical: ${v.filter((r) => r.importance === 'critical').length})`)
const ids = Object.values(out).flat().map((r) => r.id)
console.log(`TOTAL a purgar: ${ids.length} de ${rows.length}`)
fs.writeFileSync(outPath, JSON.stringify(out, null, 1))
