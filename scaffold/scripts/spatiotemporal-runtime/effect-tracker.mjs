/**
 * scripts/spatiotemporal-runtime/effect-tracker.mjs
 *
 * Implements Revertible Effects (Definition 8, 12, 17, 18 from DeepSeek Spatiotemporal Composability Paper).
 * Mathematical formulation: E_Γ := Γ -> Γ × (Γ -> Γ)
 * Every context mutation carries an explicit inverse disposer function that undoes the mutation.
 * Inverses accumulate in LIFO order or commute under independence.
 */

/**
 * Creates an empty or wrapped effect context ∂Γ := Γ × (Γ -> Γ)
 * @param {Object} [initialState={}]
 * @returns {Object} Context with effect tracking primitives
 */
export function createEffectContext(initialState = {}) {
  let state = { ...initialState };
  let inverses = []; // LIFO accumulator φ

  const ctx = {
    /**
     * Reads current state or state property
     */
    getState() {
      return state;
    },

    /**
     * Executes a revertible effect.
     * @param {Function} callback - Pure or state-transforming function that returns an inverse function: () => () => void
     * @returns {Function} Single dispose function for this specific effect
     */
    effect(callback) {
      let armed = true;
      let inverse = null;

      try {
        // Execute the effect and capture its returned inverse disposer
        const res = callback(state);
        if (typeof res === 'function') {
          inverse = res;
        } else if (res && typeof res.inverse === 'function') {
          inverse = res.inverse;
          if (res.state) state = res.state;
        }
      } catch (err) {
        armed = false;
        throw err;
      }

      const disposer = () => {
        if (!armed) return;
        armed = false;
        if (typeof inverse === 'function') {
          try {
            inverse(state);
          } catch (e) {
            console.error('Error executing effect inverse:', e);
          }
        }
        // Remove from accumulator
        const idx = inverses.indexOf(disposer);
        if (idx !== -1) inverses.splice(idx, 1);
      };

      inverses.unshift(disposer); // LIFO stack
      return disposer;
    },

    /**
     * Mutates context state with explicit inverse tracking
     * @param {string} key
     * @param {*} value
     * @returns {Function} Disposer that restores previous value
     */
    set(key, value) {
      const prevValue = state[key];
      const hadKey = Object.prototype.hasOwnProperty.call(state, key);

      return ctx.effect(() => {
        state[key] = value;
        return () => {
          if (hadKey) {
            state[key] = prevValue;
          } else {
            delete state[key];
          }
        };
      });
    },

    /**
     * Reverts all accumulated effects in LIFO order (recover_Γ)
     * Resets accumulator to identity (soundness invariant Theorem 7)
     */
    recover() {
      const toRun = [...inverses];
      inverses = [];
      for (const disposer of toRun) {
        disposer();
      }
    },

    /**
     * Current count of active effect inverses in accumulator
     */
    get activeEffectCount() {
      return inverses.length;
    }
  };

  return ctx;
}

/**
 * Composes two effect functions (Definition 9: f ⋄ g)
 * (f ⋄ g)(γ) := let (δ, s) = g(γ) in let (ε, t) = f(δ) in (ε, s ∘ t)
 */
export function composeEffects(f, g) {
  return (gamma) => {
    const resG = g(gamma);
    const delta = resG.state || gamma;
    const invG = typeof resG === 'function' ? resG : resG.inverse;

    const resF = f(delta);
    const epsilon = resF.state || delta;
    const invF = typeof resF === 'function' ? resF : resF.inverse;

    const combinedInverse = (s) => {
      if (typeof invF === 'function') invF(s);
      if (typeof invG === 'function') invG(s);
    };

    return { state: epsilon, inverse: combinedInverse };
  };
}
