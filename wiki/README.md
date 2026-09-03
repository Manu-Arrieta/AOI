# Wiki de AOI (Agentic Operational Infrastructure)

Esta carpeta contiene la **Wiki Oficial de GitHub** para el repositorio de AOI.

Está diseñada cumpliendo estrictamente los estándares del motor de documentación de **GitHub Wiki**:
* **`Home.md`**: Página de inicio y portal principal de navegación.
* **`_Sidebar.md`**: Menú lateral nativo de navegación persistente.
* **`_Footer.md`**: Pie de página institucional estándar.
* **Artículos temáticos (`01-*.md` a `12-*.md`)**: Documentación modular en profundidad.

---

## 🚀 Publicación y Despliegue en GitHub

GitHub gestiona las wikis como un repositorio Git separado bajo la URL:  
`https://github.com/Manu-Arrieta/AOI.wiki.git`

Para sincronizar y publicar todos los artículos de esta carpeta a la Wiki oficial con un solo comando, ejecuta:

```bash
bash wiki/deploy-wiki.sh
```

### Requisitos para el Despliegue:
1. Tener permisos de escritura sobre el repositorio de GitHub.
2. Si la pestaña de Wiki no está activa en tu repositorio, habilítala en:  
   `Settings` ➔ `Features` ➔ Marcar `Wikis`.
3. Crear una primera página de prueba desde la interfaz web de GitHub si el repositorio wiki aún no ha sido inicializado.

---

## 📚 Índice de Artículos Disponibles

1. [**01. Estructura y Arquitectura**](01-Estructura-y-Arquitectura.md): Árbol físico, Principio I de Scaffold Mirror y orquestación Hub-and-Spoke.
2. [**02. Componentes del Sistema**](02-Componentes-del-Sistema.md): Los 27 agentes, runtimes deterministas, Dashboard C2 e ICM v4.
3. [**03. Paradigmas Fundamentales**](03-Paradigmas-Fundamentales.md): Spec-Driven Development, Behavioral Intent Contracts (BIC) y determinismo.
4. [**04. Estudios y Fundamentos Científicos**](04-Estudios-y-Fundamentos-Cientificos.md): Runtime espaciotemporal ($\partial\Gamma$), efectos algebraicos y teoría de atención LLM.
5. [**05. Ecosistema de Agentes y Roles**](05-Ecosistema-de-Agentes-y-Roles.md): Catálogo de los 27 agentes, matriz RACI y protocolo TOON.
6. [**06. Funcionalidades y Herramientas**](06-Funcionalidades-y-Herramientas.md): AOI Doctor, MCP Gateway, Spatiotemporal Engine y sandboxes.
7. [**07. Ciclo de Vida SDD y Flujo Operativo**](07-Ciclo-de-Vida-SDD-y-Flujo-Operativo.md): Fases Pre-Flight a Archive, compuertas de calidad y estrategias de ejecución.
8. [**08. Dashboard Operativo C2**](08-Dashboard-Operativo-C2.md): Consola web Nuxt 4, Kanban, TanStack Table, grafo 3D y telemetría.
9. [**09. Optimización de Tokens y Benchmarks**](09-Optimizacion-de-Tokens-y-Benchmarks.md): Baseline oficial v2.0.0, ahorro >85%, ROI financiero y Prompt Caching.
10. [**10. Guía Práctica y Ejemplos Reales**](10-Guia-Practica-y-Ejemplos-Reales.md): Flujo E2E completo, simulación de fallo y rollback en 0 tokens.
11. [**11. Diagnóstico, Gobernanza y AOI Doctor**](11-Diagnostico-Gobernanza-y-AOI-Doctor.md): Chequeo 360° en 0 tokens, reglas multi-harness y gestión de bundles de memoria.
12. [**12. Referencia de Comandos y Cheat Sheet**](12-Referencia-de-Comandos-y-Cheat-Sheet.md): Los 30 comandos slash, scripts pnpm y flujo diario.
