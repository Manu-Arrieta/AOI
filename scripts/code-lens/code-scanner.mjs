/**
 * scripts/code-lens/code-scanner.mjs
 *
 * El escáner léxico que comparten las DOS pasadas del plegador.
 *
 * Por qué existe, y es un defecto medido. `ast-skeletonizer.mjs` tiene dos
 * recorridos sobre el mismo texto: el externo, que decide qué es un bloque y
 * salta comentarios, strings y regex; y el contador INTERNO, que busca la llave
 * de cierre de un cuerpo. Eran dos implementaciones del mismo escaneo, y
 * divergieron: **el externo saltaba comentarios y el interno no.**
 *
 * Consecuencia medida: un apóstrofo en un comentario —`// A discovery item is
 * the file's leading declaration block`— abría un "string" en el contador
 * interno que se tragaba el resto del archivo, la profundidad se desalineaba, y
 * el pliegue cerraba donde no era. **5 de 63 archivos `.mjs`/`.js` del repo
 * producían un esqueleto que `node --check` rechaza**, incluido
 * `coeffect-resolver.mjs`, que la Fase 3 del benchmark cita como su mayor ahorro
 * (91,2%). Un esqueleto roto es peor que no comprimir: el agente lee un archivo
 * verosímil que no es el archivo.
 *
 * La regla que lo cierra es la de A.13 del protocolo de auditoría: **si dos
 * partes tienen que coincidir en cómo leen lo mismo, tienen que compartir el
 * código que lo lee.** Dos implementaciones del mismo cálculo divergen siempre;
 * la pregunta es cuándo. Ya divergieron una vez y esto es lo que costó.
 *
 * Y hay una segunda defensa, independiente de la primera: un string de una línea
 * que llega a un salto de línea **termina ahí** en vez de seguir. En JavaScript
 * eso es un error de sintaxis, así que no existe un string válido que cruce un
 * `\n` sin escapar; cortar en el salto convierte cualquier apóstrofo suelto en un
 * daño de una línea en vez de un archivo entero.
 */

/** Palabras clave tras las cuales una barra abre una regex y no divide. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'instanceof',
  'do', 'else', 'yield', 'await', 'new',
])

/** Puntuación tras la cual una barra abre una regex. */
const REGEX_PRECEDING_PUNCT = '(,=:[!&|?{};+-*%~^<>'

/** Cuenta saltos de línea en `code[from, to)`. */
function countNewlines(code, from, to) {
  let n = 0
  for (let i = from; i < to; i++) if (code[i] === '\n') n++
  return n
}

/**
 * ¿La barra en `i` abre una regex o es una división?
 *
 * En JavaScript las llaves de una regex son TEXTO: `s.replace(/}/g, '')` tiene un
 * `}` que no cierra nada. Sin distinguirlas, ese `}` bajaba la profundidad y el
 * bloque se cerraba antes de tiempo, dejando el resto de la función **huérfano
 * fuera del cuerpo** — no una pérdida de contrato sino código sintácticamente
 * roto.
 *
 * La heurística es la habitual: después de un operador o de una palabra clave
 * que espera una expresión, una barra abre una regex; después de un nombre, un
 * número, `)` o `]`, divide. `a++ /b/` quedaría mal clasificado —es ambiguo sin
 * parsear— y está declarado como límite conocido.
 */
export function isRegexStart(code, i) {
  let k = i - 1
  while (k >= 0 && /\s/.test(code[k])) k--
  if (k < 0) return true
  if (REGEX_PRECEDING_PUNCT.includes(code[k])) return true
  if (/[A-Za-z_$]/.test(code[k])) {
    let start = k
    while (start >= 0 && /[A-Za-z0-9_$]/.test(code[start])) start--
    return REGEX_PRECEDING_KEYWORDS.has(code.slice(start + 1, k + 1))
  }
  return false
}

/** Consume una regex literal y devuelve el índice siguiente, o `null` si esa
 * barra no abría una regex. `null` es la respuesta que deja todo como estaba. */
export function skipRegex(code, i) {
  if (code[i] !== '/' || !isRegexStart(code, i)) return null
  let j = i + 1
  let inClass = false
  while (j < code.length) {
    const c = code[j]
    if (c === '\\') { j += 2; continue }
    if (c === '\n') return null // una regex no cruza de línea
    if (c === '[') inClass = true
    else if (c === ']') inClass = false
    else if (c === '/' && !inClass) { j++; break }
    j++
  }
  while (j < code.length && /[a-z]/i.test(code[j])) j++ // flags
  return j
}

/**
 * Escanea un string, un template o un carácter entre comillas simples.
 * @returns {{ end: number, newlines: number }}
 */
function scanQuoted(code, i) {
  const quote = code[i]
  let j = i + 1
  let newlines = 0
  while (j < code.length) {
    const c = code[j]
    if (c === '\\') { j += 2; continue }
    // Un string de UNA LÍNEA no puede cruzar un salto sin escapar: si aparece
    // uno, el "string" es un apóstrofo suelto y hay que cortar acá en vez de
    // seguir comiendo el archivo. Es la defensa que limita el daño a una línea.
    if (c === '\n' && quote !== '`') { newlines++; break }
    if (quote === '`' && c === '$' && code[j + 1] === '{') {
      const inner = scanInterpolation(code, j + 2)
      newlines += inner.newlines
      j = inner.end
      continue
    }
    if (c === quote) { j++; break }
    if (c === '\n') newlines++
    j++
  }
  return { end: j, newlines }
}

/**
 * Escanea el interior de una interpolación `${ … }` de un template.
 *
 * Adentro hay CÓDIGO, no texto: puede haber strings, regex, llaves de objetos y
 * templates anidados —incluidos los ``` ``` ``` de un bloque de markdown—. Tratar
 * la interpolación como parte del texto es lo que hacía que un template con
 * \`\`\`\`bash\`\`\`\` cerrara antes de tiempo.
 */
function scanInterpolation(code, j) {
  let depth = 1
  let newlines = 0
  while (j < code.length) {
    const step = scanNonStructural(code, j)
    if (step) { newlines += step.newlines; j = step.end; continue }
    const c = code[j]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return { end: j + 1, newlines } }
    else if (c === '\n') newlines++
    j++
  }
  return { end: j, newlines }
}

/**
 * Si en `i` empieza una región que NO es estructura —comentario, string,
 * template o regex— la salta entera.
 *
 * Es la única pieza que ambos recorridos del plegador usan para decidir qué es
 * texto y qué es código. Devolver `null` significa "acá no hay nada que saltar",
 * y es la respuesta que deja el control al llamador.
 *
 * @param {string} code
 * @param {number} i
 * @returns {{ end: number, newlines: number }|null}
 */
export function scanNonStructural(code, i) {
  const two = code.slice(i, i + 2)

  if (two === '//') {
    const eol = code.indexOf('\n', i)
    return { end: eol === -1 ? code.length : eol + 1, newlines: eol === -1 ? 0 : 1 }
  }

  if (two === '/*') {
    const close = code.indexOf('*/', i + 2)
    const end = close === -1 ? code.length : close + 2
    return { end, newlines: countNewlines(code, i, end) }
  }

  const ch = code[i]
  if (ch === '"' || ch === "'" || ch === '`') return scanQuoted(code, i)

  if (ch === '/') {
    const end = skipRegex(code, i)
    if (end !== null) return { end, newlines: countNewlines(code, i, end) }
  }

  return null
}
