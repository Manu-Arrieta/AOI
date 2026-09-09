/**
 * scripts/spatiotemporal-runtime/invariant-3-behaviour.test.mjs
 *
 * The decisions Invariant 3 rests on, each one exercised because a mutation
 * survived there.
 *
 * "Fiber Sandboxes Reversibles" is the invariant AOI advertises most loudly,
 * and it scored 35% under mutation — the second worst area in the repository.
 * Chasing those survivors turned up something bigger than a coverage hole: the
 * Guarded Unload was a comment. `isReliedUpon` computed a correct answer into
 * an empty `if`, so no mutation of it could ever be observed, and no test
 * could bind it. Recording the answer is what makes these cases possible.
 *
 * The reversibility guarantee is made of three questions — may this fiber be
 * torn down, can this effect be undone, and does this context change mean wake
 * or sleep. None of the three was constrained by a test.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createFiberRuntime } from './fiber-lifecycle.mjs'
import { createCoeffectRegistry } from './coeffect-resolver.mjs'
import { createEffectContext } from './effect-tracker.mjs'

/** A runtime whose registry already satisfies the given keys. */
function runtime(provided = []) {
  const registry = createCoeffectRegistry()
  for (const k of provided) registry.provide(k, { ready: true })
  return { registry, rt: createFiberRuntime(registry) }
}

describe('the runtime knows when a provider is still relied upon', () => {
  // Every predicate below had a surviving mutant, and all of them for the same
  // reason: the answer was computed into an empty branch.

  it('records the unload of a provider a live consumer depends on', () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })
    rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    provider.deactivate()

    assert.equal(
      provider.fiber.metadata.unloadedWhileRelied,
      1,
      'se desmontó un proveedor con consumidor vivo y no quedó registrado'
    )
  })

  it('does not record anything when nobody depends on the provider', () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })

    provider.deactivate()

    assert.equal(provider.fiber.metadata.unloadedWhileRelied, undefined)
  })

  it('does not count a fiber as relying on itself', () => {
    // `if (uid === providerUid) continue` — inverted, a fiber that both
    // provides and injects the same key would look relied upon by itself.
    const { rt } = runtime(['db'])
    const solo = rt.instantiate({ name: 'solo', inject: ['db'], provide: ['db'], apply: () => () => {} })

    solo.deactivate()

    assert.equal(solo.fiber.metadata.unloadedWhileRelied, undefined, 'una fiber se contó a sí misma')
  })

  it('stops counting a consumer once it is inactive', () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })
    const consumer = rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    consumer.deactivate()
    provider.deactivate()

    assert.equal(
      provider.fiber.metadata.unloadedWhileRelied,
      undefined,
      'un consumidor ya inactivo siguió contando como dependiente'
    )
  })

  it('a provider that provides nothing is never relied upon', () => {
    const { rt } = runtime()
    const plain = rt.instantiate({ name: 'plain', inject: [], provide: [], apply: () => () => {} })

    plain.deactivate()

    assert.equal(plain.fiber.metadata.unloadedWhileRelied, undefined)
  })

  it('a fiber that declares no provide list at all is never relied upon', () => {
    // Distinct from the empty-array case above, and the distinction is the
    // point: `provide: []` is truthy, so it walks the whole map and finds
    // nothing, while a missing `provide` takes the early return. Only this
    // case exercises that return, which is why a mutation of it survived.
    const { rt } = runtime(['db'])
    const noDecl = rt.instantiate({ name: 'sin-provide', inject: [], apply: () => () => {} })
    rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    noDecl.deactivate()

    assert.equal(
      noDecl.fiber.metadata.unloadedWhileRelied,
      undefined,
      'una fiber sin lista de provide se declaró en uso'
    )
  })

  it('only a fiber with dependencies subscribes to context changes', () => {
    // The subscribe guard is `inject && inject.length > 0`. Relaxing it to
    // `>= 0` makes every fiber subscribe to an empty spec — a listener that
    // can never fire, held for the life of the fiber, on every fiber in the
    // system. Nothing observed it, so the mutation survived.
    const { rt } = runtime(['db'])
    const withDeps = rt.instantiate({ name: 'con-deps', inject: ['db'], provide: [], apply: () => () => {} })
    const withNone = rt.instantiate({ name: 'sin-deps', inject: [], provide: [], apply: () => () => {} })

    assert.ok(withDeps.fiber.unsubs.length > 0, 'una fiber con dependencias no se suscribió')
    assert.equal(withNone.fiber.unsubs.length, 0, 'una fiber sin dependencias se suscribió igual')
  })
})

describe('a context transition means wake or sleep, never both', () => {
  // The `&&` in classifyTransition had a surviving mutant. An OR there reports
  // 'activating' on a change that should put a fiber to sleep, which inverts
  // the lifecycle of every reactive fiber at once.

  it('wakes a fiber when its coeffects become satisfied', () => {
    const registry = createCoeffectRegistry()
    const seen = []
    registry.subscribe(['db'], ({ transition }) => seen.push(transition))

    registry.provide('db', { ready: true })

    assert.deepEqual(seen, ['activating'])
  })

  it('reports satisfaction correctly in both directions', () => {
    const registry = createCoeffectRegistry()
    assert.equal(registry.isSatisfied(['db']), false, 'una clave ausente se declaró satisfecha')

    registry.provide('db', { ready: true })
    assert.equal(registry.isSatisfied(['db']), true)
  })

  it('wakes a subscriber whose keys are already satisfied, then stays quiet', () => {
    // Two distinct behaviours, and the first is easy to mistake for a bug:
    // subscribing to a key that is ALREADY provided fires `activating` at
    // once, which is how a fiber whose dependencies exist starts up rather
    // than waiting for a change that will never come. Re-providing the same
    // key afterwards fires nothing, because satisfaction did not change.
    const registry = createCoeffectRegistry()
    registry.provide('db', { ready: true })

    const seen = []
    registry.subscribe(['db'], ({ transition }) => seen.push(transition))
    assert.deepEqual(seen, ['activating'], 'un suscriptor con sus claves ya provistas no despertó')

    registry.provide('db', { ready: true, v: 2 })
    assert.deepEqual(seen, ['activating'], 'una reprovisión sin cambio de satisfacción disparó una transición')
  })
})

describe('an effect is reversible only when it hands back its inverse', () => {
  // `res && typeof res.inverse === 'function'` separates an undoable effect
  // from one that is not. Its `&&` had a surviving mutant: an OR would read
  // `.inverse` off null, or accept a shape carrying no undo at all.

  it('runs an inverse returned as a bare function', () => {
    const ctx = createEffectContext({})
    let undone = false
    ctx.effect(() => () => {
      undone = true
    })

    ctx.recover()
    assert.equal(undone, true, 'no se ejecutó el inverso devuelto como función')
  })

  it('runs an inverse carried on the returned object', () => {
    const ctx = createEffectContext({})
    let undone = false
    ctx.effect(() => ({ inverse: () => { undone = true } }))

    ctx.recover()
    assert.equal(undone, true, 'no se ejecutó el inverso devuelto como propiedad')
  })

  it('survives an effect that returns nothing, which simply is not reversible', () => {
    // Not every effect can be undone. Recording that honestly beats pretending
    // otherwise, and it must not take the whole recovery down with it.
    const ctx = createEffectContext({})
    ctx.effect(() => undefined)
    ctx.effect(() => null)

    ctx.recover()
  })

  it('undoes in LIFO order, so a later effect cannot survive an earlier undo', () => {
    const ctx = createEffectContext({})
    const order = []
    ctx.effect(() => () => order.push('primero'))
    ctx.effect(() => () => order.push('segundo'))

    ctx.recover()

    assert.deepEqual(order, ['segundo', 'primero'], 'el rollback no fue en orden inverso')
  })
})
