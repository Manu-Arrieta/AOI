/**
 * scripts/multi-harness/importance-consistency.test.mjs
 *
 * Control negativo de la compuerta que cruza los `importance` de la prosa contra
 * el protocolo ICM.
 *
 * Los casos importan más de lo habitual acá, porque la primera versión de la
 * compuerta marcó SIETE líneas donde sólo DOS eran el defecto: buscaba una palabra
 * de decisión en cualquier parte de la llamada, así que teñía stores de progreso
 * que mencionan decisiones dentro de su plantilla de contenido. Una compuerta con
 * más falsos positivos que aciertos se desactiva, y desactivada es peor que
 * inexistente.
 *
 * Por eso hay dos baterías y no una: la de verdaderos positivos, y la de FALSOS
 * positivos que la compuerta tiene que dejar pasar.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { SURFACES, decisionLevelFromProtocol, findMismatches, formatVerdict } from './importance-consistency.mjs'

const SANDBOXES = []

after(() => {
  for (const dir of SANDBOXES) fs.rmSync(dir, { recursive: true, force: true })
})

/** Un repo mínimo con la prosa que se quiere probar. */
function repo(files, { protocol = '.github/instructions/icm-protocol.instructions.md' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-importance-'))
  SANDBOXES.push(root)
  const write = (rel, body) => {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  write(protocol, '* `critical` → project stack o contexto · decisión de arquitectura · preferencia del Owner\n')
  for (const [rel, body] of Object.entries(files)) write(rel, body)
  return root
}

describe('caza el defecto que la sonda conductual encontró', () => {
  it('un store rotulado "architecture" con high', () => {
    // El caso real: `solution-architect.agent.md` persistía la arquitectura como
    // `high`. Una sonda conductual lo destapó —un modelo contestó "high" para una
    // decisión de arquitectura y citó un archivo de agente como respaldo—, y
    // ninguna compuerta estructural lo veía porque ninguna cruzaba la prosa
    // contra la tabla del protocolo.
    const root = repo({
      '.github/agents/arq.agent.md': '9. **Persist architecture**:\n```\nicm_memory_store(\n  topic: "t",\n  importance: "high",\n)\n```\n',
    })
    assert.deepEqual(
      findMismatches(root).map((m) => m.label),
      ['architecture']
    )
  })

  it('un store rotulado "infra decisions" con high', () => {
    const root = repo({
      '.github/agents/devops.agent.md':
        '4. **Store** infra decisions: `icm_memory_store(topic: "t", content: "x", importance: "high")`\n',
    })
    assert.deepEqual(
      findMismatches(root).map((m) => m.level),
      ['high']
    )
  })

  it('y el mismo store con critical pasa', () => {
    const root = repo({
      '.github/agents/arq.agent.md': '9. **Persist architecture**:\n```\nicm_memory_store(\n  importance: "critical",\n)\n```\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })
})

describe('NO marca lo que está bien — la batería de falsos positivos', () => {
  // Éstos son los que la primera versión marcaba, y marcarlos era el error.
  const FALSOS = {
    'progress con decisiones en la plantilla': '.github/agents/be.agent.md',
  }

  it('un store de PROGRESO que menciona decisiones en su contenido', () => {
    // `backend-developer.agent.md` decía "**Store** progress: ... [DB decisions,
    // API contracts]" con `high`. El rótulo es progreso y el protocolo asigna
    // `high` a "tarea completada": está bien, y la palabra aparece en la
    // plantilla de lo que se escribe, no en lo que el store ES.
    const root = repo({
      [FALSOS['progress con decisiones en la plantilla']]:
        '5. **Store** progress: `icm_memory_store(topic: "t", content: "**What**: tasks completed — [DB decisions, API contracts]", importance: "high")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('una fase completada que registra "Key decisions" como campo', () => {
    const root = repo({
      '.github/agents/sup.agent.md':
        '2. `icm_memory_store(topic: "t", content: "**What**: [Phase] completed\\n**Learned**: [Key decisions]", importance: "high")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('una decisión de DISEÑO no es una decisión de ARQUITECTURA', () => {
    // `ux-designer.agent.md` decía "**Store** design decisions" con `high`. El
    // protocolo enumera `critical` para *decisión de arquitectura*, no para
    // cualquier decisión, y `high` —"spec o plan producido"— le queda razonable.
    // Marcarla habría sido subir a `critical` algo que el protocolo no pide.
    const root = repo({
      '.github/agents/ux.agent.md':
        '4. **Store** design decisions: `icm_memory_store(topic: "t", content: "x", importance: "high")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('un persist de verificación sin palabra de arquitectura', () => {
    const root = repo({
      '.github/prompts/verify.prompt.md': '### Step 8: ICM Persist\n```\nicm_memory_store(\n  importance: "high",\n)\n```\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })
})

describe('el reporte', () => {
  it('nombra el archivo, la línea, el rótulo y el nivel', () => {
    const root = repo({
      '.github/agents/arq.agent.md': 'x\n9. **Persist architecture**:\n```\nicm_memory_store(\n  importance: "high",\n)\n```\n',
    })
    const { text, code } = formatVerdict(root)
    assert.equal(code, 1)
    assert.match(text, /\.github\/agents\/arq\.agent\.md:5/)
    assert.match(text, /architecture/)
    assert.match(text, /high/)
  })

  it('cita la tabla del protocolo, no una copia propia', () => {
    // Si el protocolo cambia de niveles, el veredicto tiene que citar el nuevo.
    const root = repo({}, { protocol: '.github/instructions/icm-protocol.instructions.md' })
    const { text } = formatVerdict(root)
    assert.match(text, /decisión de arquitectura/)
  })

  it('verde cuando no hay nada que reportar', () => {
    const { code, text } = formatVerdict(repo({}))
    assert.equal(code, 0)
    assert.match(text, /Ningún store/)
  })
})

describe('sobre el repositorio real', () => {
  it('la prosa no contradice al protocolo ICM', (t) => {
    // `fileURLToPath`, NO `new URL(...).pathname`: la ruta de este repo tiene un
    // espacio y el pathname lo entrega como `%20`, con lo que `existsSync` falla en
    // silencio y el test se SALTEA en vez de verificar. Ver A.3 del protocolo — y es
    // la tercera vez en esta auditoría que ese mismo error aparece en código nuevo.
    const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    if (!fs.existsSync(path.join(REPO, '.github/instructions/icm-protocol.instructions.md'))) {
      t.skip('sin protocolo ICM en este workspace')
      return
    }
    assert.deepEqual(
      findMismatches(REPO).map((m) => `${m.file}:${m.line}`),
      [],
      `un agente leería esta contradicción en cada tarea (nivel esperado: ${decisionLevelFromProtocol(REPO)})`
    )
  })

  it('verifica sobre las superficies que un agente lee en contexto', () => {
    assert.ok(SURFACES.includes('.github/agents'))
    assert.ok(SURFACES.includes('.github/instructions'))
  })
})

describe('lo que la verificación adversarial encontró y ahora está cubierto', () => {
  it('lee la forma CLI `icm store -i high`, no sólo `importance:`', () => {
    // La forma CLI es la que `icm-protocol.instructions.md` documenta como
    // fallback canónico. Una compuerta que no la lee no puede vigilar su propia
    // fuente, y la primera versión sólo miraba `importance: "X"`.
    const root = repo({
      '.github/agents/arq.agent.md': '4. **Store** infra decisions: `icm store -t "t" -c "chose ECS" -i high`\n',
    })
    assert.deepEqual(
      findMismatches(root).map((m) => m.level),
      ['high']
    )
  })

  it('DERIVA el nivel del protocolo en vez de tenerlo hardcodeado', () => {
    // El encabezado afirmaba que la tabla salía del protocolo y el nivel estaba
    // fijo en `'critical'`: con el protocolo invertido, la compuerta habría
    // marcado como error exactamente lo que el protocolo pedía.
    const root = repo({
      '.github/agents/arq.agent.md': '9. **Persist architecture**:\n```\nicm_memory_store(\n  importance: "high",\n)\n```\n',
    })
    assert.equal(decisionLevelFromProtocol(root), 'critical')

    // Invertido: ahora una decisión de arquitectura se guarda con `high`.
    const invertido = repo(
      { '.github/agents/arq.agent.md': '9. **Persist architecture**:\n```\nicm_memory_store(\n  importance: "high",\n)\n```\n' },
      { protocol: '.github/instructions/icm-protocol.instructions.md' }
    )
    fs.writeFileSync(
      path.join(invertido, '.github/instructions/icm-protocol.instructions.md'),
      '* `high` → decisión de arquitectura · stack\n* `critical` → spec o plan producido\n'
    )
    assert.equal(decisionLevelFromProtocol(invertido), 'high')
    assert.deepEqual(findMismatches(invertido), [], 'siguió exigiendo el nivel viejo en vez de seguir al protocolo')
  })
})

describe('los tres falsos positivos que la lente adversarial encontró', () => {
  // Una compuerta con más falsos positivos que aciertos se desactiva, y
  // desactivada es peor que inexistente. Estos tres la hacían inservible: los
  // tres marcaban líneas CORRECTAS.
  it('un `stack trace` no es el stack tecnológico', () => {
    const root = repo({
      '.github/agents/be.agent.md': '5. **Store** stack traces on failure: `icm_memory_store(topic: "t", importance: "medium")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('un store de PROGRESO con dominio en el rótulo sigue siendo de progreso', () => {
    // `high` es lo que el protocolo asigna a "tarea completada", y el dominio que
    // el rótulo mencione no cambia eso.
    const root = repo({
      '.github/agents/devops.agent.md': '9. **Store** infra task progress: `icm_memory_store(topic: "t", importance: "high")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('un rótulo pertenece a la llamada que SIGUE, no a la anterior', () => {
    // `4. Persist progress:` no matchea ningún patrón de rótulo (no lleva
    // asteriscos), así que heredaba el rótulo de la llamada de arriba y se
    // reportaba con el nombre equivocado.
    const root = repo({
      '.github/agents/arq.agent.md':
        '7. **Store** architecture decisions: `icm_memory_store(topic: "t", importance: "critical")`\n\n4. Persist progress: `icm_memory_store(topic: "t", importance: "high")`\n',
    })
    assert.deepEqual(findMismatches(root), [])
  })

  it('y el caso verdadero SIGUE detectándose', () => {
    // Control: los tres arreglos no pueden haber dejado la compuerta ciega.
    const root = repo({
      '.github/agents/arq.agent.md': '9. **Persist architecture**: `icm_memory_store(topic: "t", importance: "high")`\n',
    })
    assert.deepEqual(
      findMismatches(root).map((m) => m.level),
      ['high']
    )
  })
})
