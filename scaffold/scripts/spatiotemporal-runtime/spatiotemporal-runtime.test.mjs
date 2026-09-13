/**
 * scripts/spatiotemporal-runtime/spatiotemporal-runtime.test.mjs
 *
 * Formal mathematical and operational tests for Spatiotemporal Composability runtime.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEffectContext, composeEffects } from './effect-tracker.mjs';
import { createCoeffectRegistry } from './coeffect-resolver.mjs';
import { createFiberRuntime } from './fiber-lifecycle.mjs';
import { createAgentHMREngine } from './agent-hmr-engine.mjs';

describe('Spatiotemporal Runtime: Revertible Effects (∂Γ)', () => {
  it('records mutations and recovers state in LIFO order with exactness', () => {
    const ctx = createEffectContext({ count: 0, flags: [] });

    // Step 1: mutates count
    const undo1 = ctx.set('count', 10);
    assert.equal(ctx.getState().count, 10);

    // Step 2: appends flag
    const undo2 = ctx.effect((state) => {
      state.flags.push('A');
      return (s) => {
        s.flags.pop();
      };
    });
    assert.deepEqual(ctx.getState().flags, ['A']);
    assert.equal(ctx.activeEffectCount, 2);

    // Step 3: undo second effect
    undo2();
    assert.deepEqual(ctx.getState().flags, []);
    assert.equal(ctx.activeEffectCount, 1);
    assert.equal(ctx.getState().count, 10);

    // Step 4: recover all
    ctx.recover();
    assert.equal(ctx.getState().count, 0);
    assert.equal(ctx.activeEffectCount, 0);
  });

  it('composes effect functions preserving inverses (f ⋄ g)', () => {
    const eff1 = (state) => {
      state.val += '1';
      return (s) => { s.val = s.val.slice(0, -1); };
    };

    const eff2 = (state) => {
      state.val += '2';
      return (s) => { s.val = s.val.slice(0, -1); };
    };

    const combined = composeEffects(eff2, eff1);
    const mockState = { val: 'start_' };

    const res = combined(mockState);
    assert.equal(res.state.val, 'start_12');

    // Run inverse
    res.inverse(res.state);
    assert.equal(res.state.val, 'start_');
  });
});

describe('Spatiotemporal Runtime: Reactive Coeffects (Σ, Σ^iso, Σ^inter)', () => {
  it('reactively activates and deactivates dependents on service availability', () => {
    const registry = createCoeffectRegistry();
    let isDbActive = false;

    // Dependent component requires 'db'
    const unsub = registry.subscribe(['db'], ({ transition }) => {
      if (transition === 'activating') isDbActive = true;
      if (transition === 'deactivating') isDbActive = false;
    });

    assert.equal(isDbActive, false);

    // Provider adds 'db'
    const withdrawDb = registry.provide('db', { query: () => 'result' });
    assert.equal(isDbActive, true);
    assert.equal(registry.inject('db').query(), 'result');

    // Provider withdraws 'db'
    withdrawDb();
    assert.equal(isDbActive, false);
    assert.throws(() => registry.inject('db'), /unsatisfied/);

    unsub();
  });

  it('isolates dependencies into independent realms (Σ^iso)', () => {
    const registry = createCoeffectRegistry();

    registry.provide('config', { env: 'production' }, 'prod_realm');
    registry.provide('config', { env: 'sandbox' }, 'sandbox_realm');

    registry.isolate('config', 'prod_realm', 'agentA');
    registry.isolate('config', 'sandbox_realm', 'agentB');

    assert.equal(registry.inject('config', { realm: 'prod_realm' }).env, 'production');
    assert.equal(registry.inject('config', { realm: 'sandbox_realm' }).env, 'sandbox');
  });

  it('intercepts coeffects applying capability-based access control (Σ^inter)', () => {
    const registry = createCoeffectRegistry();

    registry.provide('fs', {
      readFile: (path) => `content of ${path}`
    });

    // Intercept fs calls to restrict path access based on metadata
    registry.intercept('fs', (originalFs, metadata) => {
      return {
        readFile: (path) => {
          if (metadata.role === 'untrusted' && path.startsWith('/root')) {
            throw new Error('Access denied to root');
          }
          return originalFs.readFile(path);
        }
      };
    });

    const trustedFs = registry.inject('fs', { metadata: { role: 'admin' } });
    assert.equal(trustedFs.readFile('/root/secret.txt'), 'content of /root/secret.txt');

    const untrustedFs = registry.inject('fs', { metadata: { role: 'untrusted' } });
    assert.throws(() => untrustedFs.readFile('/root/secret.txt'), /Access denied/);
  });
});

describe('Spatiotemporal Runtime: Fiber Lifecycle & Orchestration', () => {
  it('manages fiber lifecycle transitions and automatic cleanup', async () => {
    const registry = createCoeffectRegistry();
    const runtime = createFiberRuntime(registry);

    let providerRan = false;
    let providerCleaned = false;

    const databaseComponent = {
      name: 'database-provider',
      inject: [],
      provide: ['database'],
      apply: (ctx) => {
        providerRan = true;
        ctx.provide('database', { connected: true });
        return () => {
          providerCleaned = true;
        };
      }
    };

    let consumerRan = false;
    const apiComponent = {
      name: 'api-service',
      inject: ['database'],
      provide: ['api'],
      apply: (ctx) => {
        const db = ctx.inject('database');
        assert.equal(db.connected, true);
        consumerRan = true;
      }
    };

    // Instantiate consumer first (should stay INACTIVE waiting for dependency)
    const apiFiber = runtime.instantiate(apiComponent);
    assert.equal(apiFiber.fiber.state, 'INACTIVE');
    assert.equal(consumerRan, false);

    // Instantiate provider (should activate immediately and trigger consumer activation)
    const dbFiber = runtime.instantiate(databaseComponent);
    // Allow event loop to tick
    await new Promise(r => setTimeout(r, 10));

    assert.equal(dbFiber.fiber.state, 'ACTIVE');
    assert.equal(apiFiber.fiber.state, 'ACTIVE');
    assert.equal(providerRan, true);
    assert.equal(consumerRan, true);

    // Deactivating provider deactivates consumer
    await dbFiber.deactivate();
    await new Promise(r => setTimeout(r, 10));

    assert.equal(dbFiber.fiber.state, 'INACTIVE');
    assert.equal(apiFiber.fiber.state, 'INACTIVE');
    assert.equal(providerCleaned, true);

    runtime.disposeAll();
  });
});

describe('el guardado de descarga vale para TODOS los caminos del teardown', () => {
  // El encabezado de `fiber-lifecycle.mjs` afirma: *"guarded unloading: ¬relied_n(γ)
  // prevents provider teardown until all dependent fibers have finished
  // deactivation"*. Es una afirmación sobre el teardown, no sobre un camino del
  // teardown, y `dispose()` la violaba.
  //
  // `dispose()` hacía `deactivate()` SIN await y borraba la fibra del mapa en el
  // mismo tick. `deactivate()` empieza esperando `pendingActivation` —cede a un
  // microtask—, así que al llegar a `isReliedUpon()` la fibra ya no estaba en
  // `fibers`: `providerFiber` quedaba `undefined`, el guard no veía dependientes
  // y el proveedor se destruía primero. El inverso del dependiente corría
  // entonces contra un contexto al que le faltaba su dependencia.
  //
  // El caso de `deactivate()` ya estaba cubierto más arriba. Éste fija el OTRO
  // camino, y la aserción es el ORDEN y no el estado final: los dos terminan con
  // las dos fibras INACTIVE, así que mirar el estado no distingue el correcto del
  // corrupto.
  const orden = [];
  const provider = () => ({
    name: 'db-provider',
    inject: [],
    provide: ['db'],
    apply: (ctx) => {
      ctx.provide('db', { connected: true });
      return () => orden.push('inverse:proveedor');
    },
  });
  const consumer = () => ({
    name: 'api-consumer',
    inject: ['db'],
    provide: [],
    apply: (ctx) => {
      ctx.inject('db');
      return () => {
        // Si el proveedor se fue primero, este `inject` tira.
        let presente = true;
        try {
          ctx.inject('db');
        } catch {
          presente = false;
        }
        orden.push(presente ? 'inverse:consumidor (dep presente)' : 'inverse:consumidor (dep AUSENTE)');
      };
    },
  });

  it('por dispose(): el dependiente se desactiva ANTES que el proveedor', async () => {
    orden.length = 0;
    const registry = createCoeffectRegistry();
    const runtime = createFiberRuntime(registry);

    // Consumidor primero: queda INACTIVE esperando la dependencia.
    const api = runtime.instantiate(consumer());
    const db = runtime.instantiate(provider());
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(db.fiber.state, 'ACTIVE');
    assert.equal(api.fiber.state, 'ACTIVE', 'premisa: el consumidor tiene que estar activo');

    await db.dispose();
    await new Promise((r) => setTimeout(r, 10));

    assert.deepEqual(
      orden,
      ['inverse:consumidor (dep presente)', 'inverse:proveedor'],
      'el proveedor se destruyó antes que su dependiente, que corrió su inverso sin la dependencia'
    );
    runtime.disposeAll();
  });

  it('por dispose() y por deactivate() el orden es el MISMO', async () => {
    // La aserción que impide que los dos caminos vuelvan a divergir: el guardado
    // es una propiedad del teardown, no de la función que lo invoca.
    const correr = async (via) => {
      orden.length = 0;
      const registry = createCoeffectRegistry();
      const runtime = createFiberRuntime(registry);
      const api = runtime.instantiate(consumer());
      const db = runtime.instantiate(provider());
      await new Promise((r) => setTimeout(r, 10));
      if (via === 'dispose') await db.dispose();
      else await db.deactivate();
      await new Promise((r) => setTimeout(r, 10));
      runtime.disposeAll();
      return orden.join(' | ');
    };

    assert.equal(await correr('deactivate'), await correr('dispose'));
  });
});
