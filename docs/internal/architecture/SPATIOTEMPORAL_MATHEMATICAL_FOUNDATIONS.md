# Mathematical Foundations of the Spatiotemporal Runtime ($\partial\Gamma$)

> **Architecture Document and Formal Specification**  
> **Module:** `scripts/spatiotemporal-runtime/` and `scripts/subagent-context/`  
> **Version:** AOI v2.0.0+  

---

## 1. Problem Statement & Motivation

In traditional AI agent architectures (ReAct, AutoGPT, prompt-based subagents), error recovery is **stochastic and dissipative**:
1. An agent applies mutations directly to the user's repository file tree.
2. If a test or quality gate fails, the model is prompted with the stack trace: *"please fix the broken code"*.
3. This loop introduces critical failure modes:
   - **Explosive token consumption**: Hundreds of thousands of tokens wasted repairing side effects.
   - **Hallucinations and cascading defects**: The model frequently modifies unrelated pre-existing files.
   - **Non-determinism**: No mathematical guarantee exists that the repository can be restored to its baseline state if the task is aborted.

AOI uses this formalism to decouple LLM inference from deterministic state control inside the runtime. The current filesystem adapter controls only effects explicitly registered through its tracking API; it does not govern every physical action an agent can take.

> **Implementation scope.** The equations below describe a reversible-effect model. Their operational guarantee applies only when the effect is captured in the runtime accumulator; it is not a claim of automatic process, filesystem, environment, or remote-service isolation.

---

## 2. Canonical Nomenclature

| Symbol | Technical Term | Formal Definition | Operational Role in AOI |
| :---: | :--- | :--- | :--- |
| **$\Gamma$** | **Context / Environment** | $\Gamma = \{ x_1 : \tau_1, \dots, x_n : \tau_n \}$ | State-space model; the runtime controls only the subset it records. |
| **$\partial\Gamma$** | **Revertible Effect** | $E_\Gamma := \Gamma \to \Gamma \times (\Gamma \to \Gamma)$ | Registered mutation that carries an inverse morphism (*disposer*). |
| **$\diamond$** | **Monoidal Composition** | $(f \diamond g)(\gamma) := (\epsilon, s \circ t)$ | Sequential effect composition preserving contravariant disposal order. |
| **$\text{recover}_\Gamma$** | **Rollback Operator** | $\text{recover}(\Gamma) \equiv \text{id}_\Gamma$ | LIFO recovery of registered inverses without LLM inference; no universal timing or workspace-completeness claim. |
| **$\Sigma$** | **Coeffects** | Contextual demands ($\sigma \models d$) | Environmental requirements needed by the agent (MCP tools, database, CLI binaries). |
| **$\Sigma^{\text{iso}}$** | **Isolated Realms** | $\rho : K \to R$ (Disjoint realms) | Logical namespace isolation for runtime coeffects, not process or filesystem isolation. |
| **$\Sigma^{\text{inter}}$** | **Coeffect Interception** | $\iota : K \to M_k$ | Capability-Based Access Control (CBAC) for system calls and external tools. |

---

## 3. Theoretical Foundations & Mathematical Studies

The runtime in `scripts/spatiotemporal-runtime/` is grounded in three core pillars of theoretical computer science:

### A. Algebraic Effects and Coeffects Theory
- **Computational Effects (E. Moggi, G. Plotkin, J. Power)**:  
  Formalize impure programming operations as free algebras over monads. An effect describes what a computation *produces* or *modifies* in the outer world.
- **Coeffects (T. Petricek, D. Orchard, A. Mycroft — 2013, 2014)**:  
  Categorical dual of effects: model what a computation *requires* from the ambient environment to execute. In AOI, reactive coeffects $\Sigma$ model dependencies (e.g. `codebase-memory-mcp` availability).
  - Satisfaction predicate: $\sigma \models d$.
  - Transition classification: *activating*, *deactivating*, or *neutral*.

### B. Reversible Computing & Landauer's Principle
- **R. Landauer (1961) & C. Bennett (1973)**:  
  Established that erasing information incurs an irreversible thermodynamic cost. In AI systems, disorderly state destruction pollutes LLM context windows and exhausts token budgets.
- **Microscopic Invertibility**:  
  Each mutation registered in the AOI runtime can return a pair:
  $$( \Gamma', f^{-1} )$$
  where $f^{-1} : \Gamma' \to \Gamma$ makes rollback local and deterministic for that registered effect.

### C. Spatiotemporal Composability Formalism
Grounded in formal definitions from the *Spatiotemporal Composability* research:
1. **Monoidal Effect Composition (Definitions 8 & 9)**:
   Let $f, g \in E_\Gamma$. Their composition $f \diamond g$ is defined as:
   $$(f \diamond g)(\gamma) := \text{let } (\delta, s) = g(\gamma) \text{ in let } (\epsilon, t) = f(\delta) \text{ in } (\epsilon, s \circ t)$$
   where $s$ and $t$ are inverse functions. $\diamond$ forms a monoid with identity $\text{id}_\Gamma$.
2. **Soundness Invariant (Theorem 7)**:  
   For any finite mutation sequence $\Delta = [e_1, e_2, \dots, e_n]$, the operator $\text{recover}_\Gamma$ executes the reverse sequence in strict LIFO order:
   $$\text{recover}(\Gamma_n) = (e_1^{-1} \circ e_2^{-1} \circ \dots \circ e_n^{-1})(\Gamma_n) = \Gamma_0$$
   guaranteeing reversal within the accumulator when every relevant effect was registered; untracked host effects are outside this guarantee.

---

## 4. Efficiency Benchmark Comparison

| Metric | Traditional Agentic Paradigm (ReAct / LLM Repair) | AOI Spatiotemporal ($\partial\Gamma$) |
| :--- | :--- | :--- |
| **Rollback Cost (LLM inference)** | Depends on repair loop | None for in-process registered-effect recovery |
| **Recovery Latency** | Environment-dependent | No published time SLO |
| **Restoration Success Rate** | Environment-dependent | Deterministic for registered reversible effects |
| **Concurrency Safety** | Shared filesystem (race conditions) | Coeffect namespaces; external I/O remains shared |

---

## References
1. Moggi, E. (1991). *Notions of computation and monads*. Information and Computation.
2. Plotkin, G., & Power, J. (2002). *Notions of computation determine monads*. FoSSaCS.
3. Petricek, T., Orchard, D., & Mycroft, A. (2014). *Coeffects: A calculus of context-dependent computation*. ICFP.
4. Bennett, C. H. (1973). *Logical reversibility of computation*. IBM Journal of Research and Development.
5. DeepSeek / AOI Research (2026). *Spatiotemporal Composability in Agentic Software Engineering*.
