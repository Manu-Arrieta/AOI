/**
 * scripts/sdd-lifecycle/test-skip-scope.mjs
 *
 * ¿El test que cita un tag CORRE en esta plataforma?
 *
 * Auditoría 2026-09-30 (C4): el Invariant Gate contaba como evidencia cualquier
 * archivo que citara el tag. En macOS, `BIC-2026-003:never.2` y `never.3`
 * figuraban ✅ con un único test que lleva `{ skip: process.platform !== 'win32' }`
 * (`windows-installer-parity.test.mjs:43`). Acá ese test no corre, y el gate
 * reportaba como enforced algo que en esta máquina nadie verifica.
 *
 * **Por qué es una lectura estática y no una corrida.** Correr cada archivo que
 * cita un tag para preguntarle al runner qué saltó cuesta la suite entera
 * —incluido vitest para el dashboard— dentro de una compuerta de 0,1 s. Se lee
 * el fuente: se ubica cada llamada `it`/`test`/`describe` que CONTIENE la cita
 * (paréntesis balanceados, salteando strings, comentarios y regex) y se mira su
 * `skip`/`todo`.
 *
 * **Qué no resuelve, dicho para que no se lea como cobertura.** Sólo se evalúan
 * las condiciones que se pueden decidir sin ejecutar código: un literal, o una
 * comparación de `process.platform` con un string. Algo como `skip: !SETUP_PS1`
 * depende del árbol y queda como "corre", igual que antes de este módulo. Una
 * cita fuera de toda llamada (un comentario de cabecera) también cuenta como
 * corrida: el handshake del BIC permite citar el tag en un comentario.
 */

const CALL = /\b(it|test|describe|suite)(?:\.(skip|todo|only))?\s*\(/g
const OPENERS = { '(': ')', '{': '}', '[': ']' }
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '\n', ''])

/** Índice del cierre de un string que abre en `i` (comilla o backtick), o -1. */
function endOfString(src, i) {
  const quote = src[i]
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++
    else if (src[j] === quote) return j
    else if (quote === '`' && src[j] === '$' && src[j + 1] === '{') {
      j = closing(src, j + 1)
      if (j < 0) return -1
    }
  }
  return -1
}

/** Índice del cierre de una regex literal que abre en `i`, o -1. */
function endOfRegex(src, i) {
  let inClass = false
  for (let j = i + 1; j < src.length && src[j] !== '\n'; j++) {
    if (src[j] === '\\') j++
    else if (src[j] === '[') inClass = true
    else if (src[j] === ']') inClass = false
    else if (src[j] === '/' && !inClass) return j
  }
  return -1
}

/** El último carácter significativo antes de `i`: decide si `/` abre una regex. */
function previousToken(src, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (src[j] === '\n') return '\n'
    if (!/\s/.test(src[j])) return src[j]
  }
  return ''
}

/** Índice del cierre que balancea la apertura en `open`, o -1 si no balancea. */
export function closing(src, open) {
  const stack = []
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    let skipTo = i
    if (c === '/' && src[i + 1] === '/') skipTo = src.indexOf('\n', i)
    else if (c === '/' && src[i + 1] === '*') skipTo = src.indexOf('*/', i + 2) + 1
    else if (c === '"' || c === "'" || c === '`') skipTo = endOfString(src, i)
    else if (c === '/' && REGEX_PRECEDERS.has(previousToken(src, i))) skipTo = endOfRegex(src, i)
    else if (OPENERS[c]) stack.push(OPENERS[c])
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return -1
      if (stack.length === 0) return i
    }
    if (skipTo < 0 || skipTo < i) return -1
    i = skipTo
  }
  return -1
}

/** El objeto de opciones literal que sigue al título de una llamada, o ''. */
function optionsAfterTitle(src, paren) {
  let i = paren + 1
  while (/\s/.test(src[i] ?? '')) i++
  if (!`'"\``.includes(src[i] ?? 'x')) return ''
  const titleEnd = endOfString(src, i)
  if (titleEnd < 0) return ''
  const rest = /^\s*,\s*\{/.exec(src.slice(titleEnd + 1))
  if (!rest) return ''
  const brace = titleEnd + rest[0].length
  const end = closing(src, brace)
  return end < 0 ? '' : src.slice(brace, end + 1)
}

/**
 * Decide una condición de `skip`/`todo` SIN ejecutarla.
 * @returns {boolean | null} `true` salta acá, `false` corre, `null` no se puede decidir
 */
export function evaluateSkip(expr, platform) {
  const e = expr.trim()
  if (e === 'true' || /^(['"`]).+\1$/.test(e)) return true
  if (e === 'false' || e === '' || /^(['"`])\1$/.test(e)) return false
  const direct = /^process\.platform\s*(===|!==|==|!=)\s*(['"])(\w+)\2$/.exec(e)
  const reversed = /^(['"])(\w+)\1\s*(===|!==|==|!=)\s*process\.platform$/.exec(e)
  if (!direct && !reversed) return null
  const op = direct ? direct[1] : reversed[3]
  const value = direct ? direct[3] : reversed[2]
  return op.startsWith('!') ? platform !== value : platform === value
}

/** Las llamadas de test del fuente con su extensión y si saltan en `platform`. */
export function testCalls(src, platform) {
  const calls = []
  for (const m of src.matchAll(CALL)) {
    const paren = m.index + m[0].length - 1
    const end = closing(src, paren)
    if (end < 0) continue // Sin balance no hay extensión confiable: no se le atribuye nada
    let skip = m[2] === 'skip' || m[2] === 'todo'
    let condition = skip ? `.${m[2]}` : ''
    const option = /\b(skip|todo)\s*:\s*([^,}\n]+)/.exec(optionsAfterTitle(src, paren))
    if (!skip && option && evaluateSkip(option[2], platform) === true) {
      skip = true
      condition = `${option[1]}: ${option[2].trim()}`
    }
    calls.push({ start: m.index, end, skip, condition })
  }
  return calls
}

/**
 * ¿Toda cita de `tag` en `src` cae dentro de una llamada que salta en `platform`?
 * @returns {{ skipped: boolean, condition: string }}
 */
export function tagSkippedOn(src, tag, platform = process.platform) {
  const calls = testCalls(src, platform)
  let condition = ''
  for (let i = src.indexOf(tag); i !== -1; i = src.indexOf(tag, i + tag.length)) {
    const skipping = calls.find((c) => c.skip && c.start <= i && i <= c.end)
    if (!skipping) return { skipped: false, condition: '' }
    condition ||= skipping.condition
  }
  return { skipped: condition !== '', condition }
}
