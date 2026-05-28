# Sandbox: dashboard-nuxtui-refactor

## Metadata
- **Created**: 2026-05-27
- **Owner**: equinox
- **Related Task**: TASK-2026-003
- **Status**: 🟢 Active

## Purpose
Refactor visual del dashboard con Nuxt UI en su ultima version, evaluando componente por componente y usando Figma para iterar estilos modernos y simples sin cambiar los contratos backend ni alterar la funcionalidad del componente.

## Scope
- `apps/agentic-ops-dashboard`
- `scaffold/apps/agentic-ops-dashboard`
- `.tasks/agentic-ops-dashboard/TASK-2026-003`
- Artefactos de diseno asociados al refactor visual

## Stack Constraints
- Usar Nuxt UI en la ultima version estable
- Usar el plugin de Figma para iterar y mejorar estilos
- Mantener contratos server/runtime existentes
- Mantener paridad entre live app y scaffold
- Evitar por ahora librerias externas de charts salvo aprobacion explicita

## Rules
1. This config is IMMUTABLE after creation - changes go to `changelog.md`
2. All sandbox work is exploratory - no guarantees of integration
3. Export before integration via `.sandboxes/dashboard-nuxtui-refactor/exports/`