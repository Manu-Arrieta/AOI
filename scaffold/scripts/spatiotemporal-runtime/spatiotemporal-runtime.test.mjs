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
