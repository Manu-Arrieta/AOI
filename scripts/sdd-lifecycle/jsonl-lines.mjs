/**
 * scripts/sdd-lifecycle/jsonl-lines.mjs
 *
 * Las líneas completas que se agregaron a un JSONL desde un offset, leídas por bloques
 * y con un tope.
 *
 * Por bloques porque la primera versión del medidor leía todo lo nuevo en un solo
 * Buffer y lo pasaba a string: con un transcript de más de 512 MB eso tira
 * ERR_STRING_TOO_LONG, el error se tragaba en silencio, el offset no se guardaba y el
 * mismo archivo se releía entero en CADA prompt (1,1-1,4 GB de RSS medidos). Con tope
 * porque lo que el medidor necesita está al final: el `usage` del último request, o el
 * crecimiento reciente. Lo salteado se declara (`skipped`): una estimación por bytes
 * hecha sobre la cola es una cota inferior, nunca una sobrestimación.
 */

import fs from 'node:fs'

export const CHUNK = 8 * 1024 * 1024
export const MAX_READ = 64 * 1024 * 1024

/**
 * Llama a `onLine` por cada línea completa no vacía de `[offset, fin)`. Una línea sin
 * `\n` final queda para la próxima lectura. Si hay más de `maxRead` bytes nuevos, se
 * lee sólo la cola desde la primera línea completa. Con `headBytes`, `onLine` recibe
 * sólo la cabeza de la línea y una función que devuelve la línea entera: no se crea un
 * string por cada línea de 1 MB que el lector no necesita.
 *
 * @returns {{ offset: number, skipped: boolean, newline: boolean, size: number }}
 *   `offset` es el byte siguiente a la última línea consumida; `newline`, si la lectura
 *   vio algún salto de línea.
 */
export function readLines(file, offset, onLine, { maxRead = MAX_READ, chunk = CHUNK, headBytes = 0 } = {}) {
  const size = fs.statSync(file).size
  let pos = offset
  let skipped = false
  if (size - pos > maxRead) {
    pos = size - maxRead
    skipped = true
  }
  // `pending`: dónde empieza lo no consumido, que es desde donde lee la próxima vez.
  let pending = pos
  let dropFirst = skipped
  let carry = Buffer.alloc(0)
  let newline = false
  const fd = fs.openSync(file, 'r')
  try {
    while (pos < size) {
      const buf = Buffer.alloc(Math.min(chunk, size - pos))
      const n = fs.readSync(fd, buf, 0, buf.length, pos)
      if (n <= 0) break
      pos += n
      const data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : buf.subarray(0, n)
      let from = 0
      let nl
      while ((nl = data.indexOf(10, from)) !== -1) {
        newline = true
        if (dropFirst) dropFirst = false
        else if (nl > from && !headBytes) onLine(data.toString('utf8', from, nl))
        else if (nl > from) {
          const [a, b] = [from, nl]
          onLine(data.toString('utf8', a, Math.min(b, a + headBytes)), () => data.toString('utf8', a, b))
        }
        from = nl + 1
        pending = pos - (data.length - from)
      }
      // Lo leído nunca pasa de `maxRead`, así que tampoco la línea a medias que se arrastra.
      carry = Buffer.from(data.subarray(from))
    }
  } finally {
    fs.closeSync(fd)
  }
  return { offset: pending, skipped, newline, size }
}
