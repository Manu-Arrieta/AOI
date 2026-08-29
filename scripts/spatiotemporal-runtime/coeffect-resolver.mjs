/**
 * scripts/spatiotemporal-runtime/coeffect-resolver.mjs
 *
 * Implements Reactive Coeffects, Coeffect Isolation (Realms Σ^iso),
 * and Coeffect Interception (Σ^inter) from the Spatiotemporal Composability Paper.
 *
 * Coeffects model environmental requirements (what a component needs).
 * Reactive notification classifies state transitions as activating, deactivating, or neutral.
 */

import { createEffectContext } from './effect-tracker.mjs';

/**
 * Creates a reactive coeffect registry with realm isolation and interception capabilities.
 */
export function createCoeffectRegistry() {
  const effectCtx = createEffectContext();
  
  // Store: realm -> value mapping
  const store = new Map();
  // Isolate table: key -> realm mapping (ρ : K -> R)
  const isolateTable = new Map();
  // Intercept table: key -> metadata merge mapping (ι : K -> M_k)
  const interceptTable = new Map();
  // Registered listeners: Set of { spec: Set<string>, realm: string, callback: (event) => void }
  const listeners = new Set();

  /**
   * Resolves the active store slot for a key in a given realm
   */
  function resolveRealm(key, realm = null) {
    if (realm) {
      return `${realm}#${key}`;
    }
    const mappedRealm = isolateTable.get(key);
    if (mappedRealm) {
      return `${mappedRealm}#${key}`;
    }
    return key;
  }

  /**
   * Evaluates the satisfaction predicate σ ⊧ d
   * @param {Array<string>|Set<string>} spec - Required keys
   * @param {string} [realm=null] - Optional realm identifier
   * @returns {boolean} True if all keys in spec exist in the active store
   */
  function isSatisfied(spec, realm = null) {
    const keys = Array.isArray(spec) ? spec : Array.from(spec);
    for (const key of keys) {
      const targetRealm = resolveRealm(key, realm);
      if (!store.has(targetRealm)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Classifies a context transition according to a specification d
   * notify_d(σ, σ') in { 'activating', 'deactivating', 'neutral' }
   */
  function classifyTransition(spec, wasSatisfied, isNowSatisfied) {
    if (!wasSatisfied && isNowSatisfied) return 'activating';
    if (wasSatisfied && !isNowSatisfied) return 'deactivating';
    return 'neutral';
  }

  /**
   * Dispatches notifications to registered listeners whose satisfaction changed
   */
  function notify(changedKeys, changedRealm = null) {
    for (const listener of listeners) {
      const touchesKey = Array.from(listener.spec).some(k => changedKeys.includes(k));
      if (!touchesKey) continue;

      const wasSatisfied = listener.lastSatisfied;
      const isNowSatisfied = isSatisfied(listener.spec, listener.realm);
      const transition = classifyTransition(listener.spec, wasSatisfied, isNowSatisfied);

      if (transition !== 'neutral') {
        listener.lastSatisfied = isNowSatisfied;
        try {
          listener.callback({
            transition,
            satisfied: isNowSatisfied,
            keys: changedKeys,
            realm: listener.realm
          });
        } catch (e) {
          console.error('Error in coeffect listener callback:', e);
        }
      }
    }
  }

  const registry = {
    /**
     * Provides a typed value at a key. Wrapped in a revertible effect.
     * @param {string} key
     * @param {*} value
     * @param {string} [realm=null]
     * @returns {Function} Disposer that withdraws the provision and notifies dependents
     */
    provide(key, value, realm = null) {
      const targetRealm = resolveRealm(key, realm);
      const hadValue = store.has(targetRealm);
      const prevValue = store.get(targetRealm);

      return effectCtx.effect(() => {
        store.set(targetRealm, value);
        notify([key], realm);

        return () => {
          if (hadValue) {
            store.set(targetRealm, prevValue);
          } else {
            store.delete(targetRealm);
          }
          notify([key], realm);
        };
      });
    },

    /**
     * Injects / reads a coeffect by key, applying interceptors and realm isolation.
     * @param {string} key
     * @param {Object} [options={}]
     * @param {string} [options.realm=null]
     * @param {Object} [options.metadata={}]
     * @returns {*} Resolved value or throws if unsatisfied
     */
    inject(key, options = {}) {
      const { realm = null, metadata = {} } = options;
      const targetRealm = resolveRealm(key, realm);

      if (!store.has(targetRealm)) {
        throw new Error(`Coeffect '${key}' is unsatisfied in realm '${targetRealm}'`);
      }

      let value = store.get(targetRealm);

      // Apply coeffect interception (Σ^inter) if metadata or interceptor registered
      const interceptor = interceptTable.get(key);
      if (interceptor && typeof interceptor === 'function') {
        value = interceptor(value, metadata);
      }

      return value;
    },

    /**
     * Isolates a coeffect key into a specific realm (Coeffect Isolation Σ^iso)
     * @param {string} key
     * @param {string} realmSymbol
     * @param {string} [ownerScope=null]
     */
    isolate(key, realmSymbol, ownerScope = null) {
      const isolateKey = ownerScope ? `${ownerScope}:${key}` : key;
      isolateTable.set(isolateKey, realmSymbol);
      return () => {
        isolateTable.delete(isolateKey);
      };
    },

    /**
     * Registers a cross-cutting interceptor on dependency access (Σ^inter)
     * @param {string} key
     * @param {Function} handler - (value, callerMetadata) => interceptedValue
     */
    intercept(key, handler) {
      interceptTable.set(key, handler);
      return () => {
        interceptTable.delete(key);
      };
    },

    /**
     * Subscribes a component's coeffect specification for reactive activation/deactivation
     * @param {Array<string>|Set<string>} spec - Declared dependencies
     * @param {Function} callback - ({ transition, satisfied }) => void
     * @param {string} [realm=null]
     * @returns {Function} Unsubscribe function
     */
    subscribe(spec, callback, realm = null) {
      const specSet = new Set(Array.isArray(spec) ? spec : [spec]);
      const initialSatisfaction = isSatisfied(specSet, realm);
      const listener = {
        spec: specSet,
        realm,
        lastSatisfied: initialSatisfaction,
        callback
      };

      listeners.add(listener);

      // Trigger initial activation if already satisfied
      if (initialSatisfaction) {
        try {
          callback({ transition: 'activating', satisfied: true, keys: Array.from(specSet), realm });
        } catch (e) {
          console.error('Error in initial coeffect subscription callback:', e);
        }
      }

      return () => {
        listeners.delete(listener);
      };
    },

    /**
     * Checks if a coeffect specification is satisfied
     */
    isSatisfied(spec, realm = null) {
      return isSatisfied(new Set(Array.isArray(spec) ? spec : [spec]), realm);
    },

    /**
     * Returns an inventory of all currently provided coeffect keys
     */
    getProvidedKeys() {
      return Array.from(store.keys());
    },

    /**
     * Reverts all registered effects in this coeffect context
     */
    recover() {
      effectCtx.recover();
      store.clear();
      isolateTable.clear();
      interceptTable.clear();
      listeners.clear();
    }
  };

  return registry;
}
