/**
 * scripts/spatiotemporal-runtime/effect-tracker.mjs
 *
 * Implements Revertible Effects (Definition 8, 12, 17, 18 from DeepSeek Spatiotemporal Composability Paper).
 * Mathematical formulation: E_Γ := Γ -> Γ × (Γ -> Γ)
 *
 * El contrato REAL, medido, porque el encabezado anterior afirmaba más de lo que
 * un objeto de JavaScript puede prometer:
 *
 *   - Las mutaciones hechas por `set()` y `effect()` quedan registradas y son
 *     revertibles en orden inverso.
 *   - El inverso de `set()` guarda una **copia** del valor previo, así que una
 *     mutación in-place posterior del objeto original no lo corrompe.
 *   - `getState()` devuelve una **copia desprendida**: mutarla no cambia el
 *     contexto, y por eso no hay mutación sin registro.
 *   - `effect(callback)` recibe el estado vivo, y el contrato es del llamador:
 *     el callback tiene que devolver su inverso. Es la única puerta que queda, y
 *     está declarada en vez de escondida.
 *
 * La versión anterior decía *"Every context mutation carries an explicit inverse
 * disposer function that undoes the mutation"* y era falsa en dos formas que una
 * lente adversarial midió: `getState()` entregaba el objeto VIVO —sin copia ni
 * congelado—, así que `ctx.getState().a.b = 42` mutaba sin registrar nada y
 * `recover()` no lo deshacía; y `set()` guardaba `prevValue` **por referencia**,
 * así que mutar el objeto previo después del `set` hacía que `recover()`
 * restaurara el valor mutado (`{b:999}` en vez de `{b:0}`).
 *
 * Y la frase *"or commute under independence"* era prosa no implementada: no hay
 * detección de conmutatividad, el orden es LIFO incondicional. Se quita en vez de
 * dejar una promesa que el código no cumple.
 */

/**
 * Copia defensiva de un valor del estado.
 *
 * `structuredClone` cubre el caso normal. Un valor con funciones adentro no es
 * clonable, y ahí se devuelve la referencia: es peor copiar mal que no copiar,
 * y el fallback queda declarado en vez de romper el `set`.
 */
function snapshot(value) {
  try {
    return structuredClone(value)
  } catch {
    return value
  }
}

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
     * Una COPIA del estado, no el estado.
     *
     * Devolver el objeto vivo dejaba una puerta abierta para mutar el contexto
     * sin registrar el inverso, que es exactamente lo que este módulo promete
     * impedir. Con una copia, la única forma de cambiar el contexto es por una
     * operación trackeada.
     *
     * @returns {Object}
     */
    getState() {
      return snapshot(state);
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
      // El previo se guarda como COPIA, y es la diferencia entre deshacer y
      // deshacer mal. Con la referencia, `set('a', x)` sobre un objeto que
      // después se muta in-place hacía que `recover()` restaurara ESE objeto
      // mutado: el inverso existía y no servía. Medido: volvía `{b:999}` en vez
      // de `{b:0}`.
      const hadKey = Object.prototype.hasOwnProperty.call(state, key);
      const prevValue = hadKey ? snapshot(state[key]) : undefined;

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
