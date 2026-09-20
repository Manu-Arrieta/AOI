#!/usr/bin/env node
/**
 * Keeps current public claims tied to executable evidence instead of a stale
 * badge, benchmark, or universal percentage. Historical benchmark documents
 * are intentionally out of scope: their date and corpus are the evidence.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const LEDGER = 'docs/internal/verification/AOI_CLAIMS_EVIDENCE_LEDGER_2026-09-16.md'

export const REQUIRED_CLAIMS = Object.freeze([
  'C-001', 'C-002', 'C-003', 'C-004', 'C-005', 'C-006',
])

export const EVIDENCE_PATHS = Object.freeze([
  'package.json',
  'scripts/installation-profiles.test.mjs',
  'scripts/conf/installation-profiles.test.mjs',
  'scripts/conf/compare-install.test.mjs',
  'scripts/mcp-gateway/server-wrapping.test.mjs',
  'scripts/mcp-gateway/setup-mcp-gateway.mjs',
  'scripts/spatiotemporal-runtime/spatiotemporal-runtime.test.mjs',
  'scripts/scaffold/validate-scaffold-parity.mjs',
])

export const PUBLIC_SURFACES = Object.freeze([
  'README.md',
  'scaffold/README.md',
  'docs/README.md',
  'scripts/mcp-gateway/setup-mcp-gateway.mjs',
  'scaffold/scripts/mcp-gateway/setup-mcp-gateway.mjs',
])

/**
 * La prosa que el ciclo carga SIEMPRE: las `instructions` que el `applyTo`
 * inyecta en cada fase y los prompts de comando. El ledger las trata como
 * públicas por su EFECTO, no por su audiencia: un porcentaje sin evidencia acá
 * no queda en un README que nadie lee, queda en el contexto de un agente que va
 * a actuar sobre él.
 *
 * Se recorren los directorios enteros, no una lista: una lista se desactualiza
 * cuando alguien agrega un archivo, y la compuerta quedaría verde sobre el nuevo.
 *
 * Se agregaron después de medir que el único claim retirado todavía vivo en el
 * repositorio (`60–90%`, R-001) estaba justamente en `.github/instructions/`,
 * fuera del alcance del escaneo: el patrón lo nombraba, el archivo existía, y
 * ninguno de los dos se encontraba con el otro.
 */
export const PROSE_SURFACES = Object.freeze([
  '.github/instructions',
  '.github/prompts',
])

/** Claims that require corpus-qualified documentation, never a live promise. */
export const RETIRED_CLAIMS = Object.freeze([
  // `60–90%` —el signo va DESPUÉS del 60, no antes del 90— es la forma que
  // aparece en el repositorio, y el patrón la dejaba pasar: exigía el `%`
  // pegado al 60. El claim estaba retirado en el ledger (R-001) y seguía vivo
  // en una instrucción que se inyecta en todas las fases, sin que la compuerta
  // pudiera verlo. Se conservan las formas que el patrón anterior sí cubría,
  // porque al arreglarlo no hay que perder alcance.
  { label: 'universal token-saving range', pattern: /60\s*%?\s*(?:al|to|[-–])\s*90\s*%/i },
  { label: 'universal MCP saving rate', pattern: /(?:hasta\s+un|up\s+to)\s+85%/i },
  { label: 'fixed test-count badge', pattern: /badge\/Tests-\d+(?:%2F|\/)\d+_Passing/i },
  { label: 'fixed scaffold-parity badge', pattern: /badge\/Scaffold_Parity-\d+(?:%2F|\/)\d+_Verified/i },
  { label: 'fixed multi-harness badge', pattern: /badge\/Multi--Harness-\d+_Assistants/i },
  { label: 'fixed test-count claim', pattern: /\(\d+\s+tests\)/i },
  { label: 'fixed scaffold-file-count claim', pattern: /\(\d+\s+archivos\s+gobernados\)/i },
  { label: 'fixed agent-count claim', pattern: /\b\d+\s+Agentes\b/i },
  { label: 'infinite-memory guarantee', pattern: /memoria\s+infinita/i },
  { label: 'zero-context-loss guarantee', pattern: /cero\s+pérdida\s+de\s+contexto/i },
  { label: 'general atomic rollback claim', pattern: /reversión\s+atómica/i },
  { label: 'all-profile real-time dashboard claim', pattern: /dashboard\s+de\s+operaciones\s+en\s+tiempo\s+real/i },
])

export function unsupportedClaims(text, rules = RETIRED_CLAIMS) {
  return rules.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

export function auditClaimsEvidence(root) {
  const ledgerPath = path.join(root, LEDGER)
  // Installed workspaces do not receive internal documentation. Their package
  // command remains harmless; source checkouts must carry the ledger.
  if (!fs.existsSync(ledgerPath)) return { applicable: false, errors: [], scanned: 0 }

  const errors = []
  const ledger = fs.readFileSync(ledgerPath, 'utf8')
  for (const id of REQUIRED_CLAIMS) {
    if (!new RegExp(`\\|\\s*${id}\\s*\\|`).test(ledger)) errors.push(`${LEDGER} lacks required claim ${id}`)
  }
  for (const evidence of EVIDENCE_PATHS) {
    if (!fs.existsSync(path.join(root, evidence))) errors.push(`evidence path does not exist: ${evidence}`)
  }

  let scanned = 0
  for (const surface of PUBLIC_SURFACES) {
    const full = path.join(root, surface)
    if (!fs.existsSync(full)) continue
    scanned += 1
    for (const claim of unsupportedClaims(fs.readFileSync(full, 'utf8'))) {
      errors.push(`${surface} reintroduces retired claim: ${claim}`)
    }
  }
  for (const dir of PROSE_SURFACES) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full)) continue
    for (const name of fs.readdirSync(full).filter((f) => f.endsWith('.md')).sort()) {
      const rel = `${dir}/${name}`
      scanned += 1
      for (const claim of unsupportedClaims(fs.readFileSync(path.join(root, rel), 'utf8'))) {
        errors.push(`${rel} reintroduces retired claim: ${claim}`)
      }
    }
  }
  if (scanned === 0) errors.push('no public claim surface was scanned')
  return { applicable: true, errors, scanned }
}

export function formatClaimsEvidence(audit) {
  if (!audit.applicable) {
    return { text: '· Sin ledger de claims en este workspace instalado: nada que verificar.', code: 0 }
  }
  const lines = ['=== AOI Claims Evidence Ledger ===', `Superficies públicas: ${audit.scanned}`]
  if (audit.errors.length === 0) {
    lines.push('✅ Claims vigentes enlazados a evidencia; no hay promesas retiradas en superficies públicas.')
    return { text: lines.join('\n'), code: 0 }
  }
  lines.push(`❌ ${audit.errors.length} problema(s):`)
  for (const error of audit.errors) lines.push(`   · ${error}`)
  return { text: lines.join('\n'), code: 1 }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = formatClaimsEvidence(auditClaimsEvidence(process.cwd()))
  process.stdout.write(result.text + '\n')
  process.exit(result.code)
}
