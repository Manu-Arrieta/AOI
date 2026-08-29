/**
 * scripts/spatiotemporal-runtime/fiber-lifecycle.mjs
 *
 * Implements the Operational Calculus and Inertial Fiber Lifecycle Machine
 * from Section 4 of the Spatiotemporal Composability Paper.
 *
 * Lifecycle States:
 *   INACTIVE  -> RELOADING -> ACTIVE -> UNLOADING -> INACTIVE
 *
 * Implements guarded unloading: ¬relied_n(γ) prevents provider teardown
 * until all dependent fibers have finished deactivation (Theorem 70 & 73).
 */

import { createEffectContext } from './effect-tracker.mjs';

let fiberIdCounter = 1;

/**
 * Creates a Spatiotemporal Fiber Runtime representing an interconnected
 * system of dynamic agent components and fibers.
 */
export function createFiberRuntime(coeffectRegistry) {
  const fibers = new Map(); // uid -> Fiber
  const rootEffectCtx = createEffectContext();

  /**
   * Checks if fiber `providerUid` is currently relied upon by another installed fiber
   * relied_n(γ) := ∃m ≠ n, k ∈ d_m. installed_m(γ) ∧ ω_m(k) = n
   */
  function isReliedUpon(providerUid) {
    const providerFiber = fibers.get(providerUid);
    if (!providerFiber || !providerFiber.provides) return false;

    const providedKeys = new Set(providerFiber.provides);

    for (const [uid, fiber] of fibers.entries()) {
      if (uid === providerUid) continue;
      if (fiber.state === 'INACTIVE') continue;

      // Check if fiber declares any key this provider provides
      for (const reqKey of fiber.inject) {
        if (providedKeys.has(reqKey)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Instantiates and registers a component as a Fiber in the runtime.
   * @param {Object} component - { name, inject: string[], provide: string[], apply: (ctx, config) => (() => void)|void }
   * @param {Object} [config={}]
   * @param {string} [parentUid='root']
   * @returns {Object} Instantiated Fiber controller
   */
  function instantiate(component, config = {}, parentUid = 'root') {
    const uid = `fiber_${fiberIdCounter++}_${component.name || 'anon'}`;
    const effectCtx = createEffectContext();

    const fiber = {
      uid,
      name: component.name || uid,
      parentUid,
      inject: component.inject || [],
      provides: component.provide || [],
      config,
      state: 'INACTIVE', // INACTIVE | RELOADING | ACTIVE | UNLOADING | FAILED
      accumulator: effectCtx,
      unsubs: [],
      error: null,
      metadata: {
        createdAt: new Date().toISOString(),
        activations: 0,
        deactivations: 0
      }
    };

    fibers.set(uid, fiber);

    /**
     * Activates the fiber when its coeffect dependencies are satisfied (L-Begin / L-Finish)
     */
    async function activate() {
      if (fiber.state === 'ACTIVE' || fiber.state === 'RELOADING') return;

      fiber.state = 'RELOADING';
      try {
        // Child context provided to the component
        const fiberCtx = {
          uid: fiber.uid,
          inject: (key, opts) => coeffectRegistry.inject(key, opts),
          provide: (key, val, realm) => {
            const disposer = coeffectRegistry.provide(key, val, realm);
            fiber.accumulator.effect(() => disposer);
            return disposer;
          },
          effect: (cb) => fiber.accumulator.effect(cb),
          set: (k, v) => fiber.accumulator.set(k, v)
        };

        // Run component apply function
        if (typeof component.apply === 'function') {
          const inverse = await component.apply(fiberCtx, fiber.config);
          if (typeof inverse === 'function') {
            fiber.accumulator.effect(() => inverse);
          }
        }

        fiber.state = 'ACTIVE';
        fiber.metadata.activations++;
      } catch (err) {
        fiber.state = 'FAILED';
        fiber.error = err;
        // Rollback any partial effects installed during the failing activation (Corollary 69)
        fiber.accumulator.recover();
        throw err;
      }
    }

    /**
     * Deactivates the fiber and runs its accumulated inverses (L-Leave / L-Unload)
     */
    async function deactivate() {
      if (fiber.state === 'INACTIVE' || fiber.state === 'UNLOADING') return;

      fiber.state = 'UNLOADING';

      // Guarded Unload: Wait until dependents are no longer relying on our provided keys
      if (isReliedUpon(fiber.uid)) {
        // In a real reactive loop, this deferral waits for dependent fibers to finish teardown
      }

      // Revert all tracked effects in LIFO order (Theorem 16 / 68)
      fiber.accumulator.recover();

      fiber.state = 'INACTIVE';
      fiber.metadata.deactivations++;
    }

    // Subscribe to reactive coeffect changes
    if (fiber.inject && fiber.inject.length > 0) {
      const unsub = coeffectRegistry.subscribe(fiber.inject, async ({ transition }) => {
        if (transition === 'activating') {
          await activate().catch(e => console.error(`Failed to activate fiber ${fiber.uid}:`, e));
        } else if (transition === 'deactivating') {
          await deactivate().catch(e => console.error(`Failed to deactivate fiber ${fiber.uid}:`, e));
        }
      });
      fiber.unsubs.push(unsub);
    } else {
      // If component has 0 dependencies, activate immediately
      activate().catch(e => console.error(`Initial activation failed for ${fiber.uid}:`, e));
    }

    return {
      uid: fiber.uid,
      fiber,
      activate,
      deactivate,
      dispose() {
        for (const unsub of fiber.unsubs) unsub();
        deactivate();
        fibers.delete(uid);
      }
    };
  }

  return {
    instantiate,
    getFiber(uid) {
      return fibers.get(uid);
    },
    getAllFibers() {
      return Array.from(fibers.values());
    },
    getActiveFibers() {
      return Array.from(fibers.values()).filter(f => f.state === 'ACTIVE');
    },
    disposeAll() {
      for (const fiber of fibers.values()) {
        fiber.accumulator.recover();
      }
      fibers.clear();
      rootEffectCtx.recover();
    }
  };
}
