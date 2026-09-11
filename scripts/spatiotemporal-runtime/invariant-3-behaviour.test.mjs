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

  it('records the unload of a provider a live consumer depends on', async () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })
    rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    await provider.deactivate()

    assert.equal(
      provider.fiber.metadata.unloadedWhileRelied,
      1,
      'se desmontó un proveedor con consumidor vivo y no quedó registrado'
    )
  })

  it('does not record anything when nobody depends on the provider', async () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })

    await provider.deactivate()

    assert.equal(provider.fiber.metadata.unloadedWhileRelied, undefined)
  })

  it('does not count a fiber as relying on itself', async () => {
    // `if (uid === providerUid) continue` — inverted, a fiber that both
    // provides and injects the same key would look relied upon by itself.
    const { rt } = runtime(['db'])
    const solo = rt.instantiate({ name: 'solo', inject: ['db'], provide: ['db'], apply: () => () => {} })

    await solo.deactivate()

    assert.equal(solo.fiber.metadata.unloadedWhileRelied, undefined, 'una fiber se contó a sí misma')
  })

  it('stops counting a consumer once it is inactive', async () => {
    const { rt } = runtime(['db'])
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => {} })
    const consumer = rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    await consumer.deactivate()
    await provider.deactivate()

    assert.equal(
      provider.fiber.metadata.unloadedWhileRelied,
      undefined,
      'un consumidor ya inactivo siguió contando como dependiente'
    )
  })

  it('runs the inverse even when teardown arrives before activation finishes', async () => {
    // The race this closes. A zero-dependency fiber is activated
    // fire-and-forget, so a teardown in the same tick used to call `recover()`
    // before `apply()` had registered its inverse: the effect then survived
    // the rollback with nothing reporting a problem. You cannot undo what has
    // not finished being done, so teardown waits for the activation it means
    // to reverse.
    const { rt } = runtime()
    const order = []
    const fiber = rt.instantiate({ name: 'carrera', inject: [], provide: [], apply: () => () => order.push('inverso') })

    await fiber.deactivate() // sin dejar pasar un tick a propósito

    assert.deepEqual(order, ['inverso'], 'el inverso se perdió porque el teardown ganó la carrera')
  })

  it('a provider that provides nothing is never relied upon', async () => {
    const { rt } = runtime()
    const plain = rt.instantiate({ name: 'plain', inject: [], provide: [], apply: () => () => {} })

    await plain.deactivate()

    assert.equal(plain.fiber.metadata.unloadedWhileRelied, undefined)
  })

  it('a fiber that declares no provide list at all is never relied upon', async () => {
    // Distinct from the empty-array case above, and the distinction is the
    // point: `provide: []` is truthy, so it walks the whole map and finds
    // nothing, while a missing `provide` takes the early return. Only this
    // case exercises that return, which is why a mutation of it survived.
    const { rt } = runtime(['db'])
    const noDecl = rt.instantiate({ name: 'sin-provide', inject: [], apply: () => () => {} })
    rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => {} })

    await noDecl.deactivate()

    assert.equal(
      noDecl.fiber.metadata.unloadedWhileRelied,
      undefined,
      'una fiber sin lista de provide se declaró en uso'
    )
  })

  it('only a fiber with dependencies subscribes to context changes', async () => {
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

describe('teardown happens in dependency order, which is what Guarded Unload promised', () => {
  // For years this was a comment inside an empty `if`. A provider tore down
  // while a consumer still relied on the keys it supplies, and the consumer's
  // own inverses then ran against a context whose dependency had already
  // vanished — the exact state reversibility exists to make impossible.

  it('tears the dependent down before the provider it relies on', async () => {
    const { rt } = runtime(['db'])
    const order = []
    const provider = rt.instantiate({
      name: 'provider',
      inject: [],
      provide: ['db'],
      apply: () => () => order.push('provider'),
    })
    rt.instantiate({ name: 'consumer', inject: ['db'], provide: [], apply: () => () => order.push('consumer') })

    await provider.deactivate()

    assert.deepEqual(order, ['consumer', 'provider'], 'el proveedor se desmontó antes que su consumidor')
  })

  it('unwinds a three-level chain from the leaf inwards', async () => {
    const { rt } = runtime(['db', 'repo'])
    const order = []
    const base = rt.instantiate({ name: 'base', inject: [], provide: ['db'], apply: () => () => order.push('base') })
    rt.instantiate({ name: 'repo', inject: ['db'], provide: ['repo'], apply: () => () => order.push('repo') })
    rt.instantiate({ name: 'ui', inject: ['repo'], provide: [], apply: () => () => order.push('ui') })

    await base.deactivate()

    assert.deepEqual(order, ['ui', 'repo', 'base'], 'la cadena no se desarmó desde la hoja')
  })

  it('terminates on a dependency cycle instead of recursing forever', async () => {
    // Two fibers providing keys to each other is a real possibility, and
    // without the visited guard the first teardown blows the stack.
    const { rt } = runtime(['a', 'b'])
    const order = []
    const first = rt.instantiate({ name: 'first', inject: ['b'], provide: ['a'], apply: () => () => order.push('first') })
    rt.instantiate({ name: 'second', inject: ['a'], provide: ['b'], apply: () => () => order.push('second') })

    await first.deactivate()

    assert.ok(order.includes('first'), 'el ciclo impidió desmontar el que se pidió')
    assert.ok(order.length <= 2, 'una fiber se desmontó más de una vez')
  })

  it('leaves an unrelated fiber alone', async () => {
    // Ordered teardown must not become a cascade that takes the system down.
    const { rt } = runtime(['db', 'otra'])
    const order = []
    const provider = rt.instantiate({ name: 'provider', inject: [], provide: ['db'], apply: () => () => order.push('provider') })
    rt.instantiate({ name: 'ajena', inject: ['otra'], provide: [], apply: () => () => order.push('ajena') })

    return provider.deactivate().then(() => {
      assert.deepEqual(order, ['provider'], 'se desmontó una fiber que no dependía del proveedor')
    })
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
