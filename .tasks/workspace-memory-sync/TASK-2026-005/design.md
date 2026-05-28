# Architecture & Design: Exportacion e Importacion de Bundles de Memoria Comprimidos

**Branch**: `2026-005-workspace-memory-sync-bundles` | **Date**: 2026-05-28  
**Input**: `.tasks/workspace-memory-sync/TASK-2026-005/spec.md`

## Summary

Esta iteracion extiende `workspace-memory-sync` con un artefacto portable de
transporte llamado `Compressed Memory Bundle`. La capacidad nueva no crea un
segundo sistema de versionado: agrega un nuevo origen de datos para el mismo
lifecycle ya existente de `candidate -> review -> activate -> rollback`.

El diseño propone un bundle como un sobre JSON comprimido con `gzip`, validable
con Node standard library, para evitar dependencias de archivado adicionales y
mantener la implementacion portable entre macOS, Linux y Windows. La exportacion
captura procedencia, compatibilidad, integridad y declaraciones de scopes; la
importacion descomprime, valida y traduce ese contenido hacia la preparacion de
un manifest candidato del workspace destino. Los artefactos exportados se
materializan dentro de `.exportsmemories/` como superficie base gobernada del
repositorio.

## Current State

- El proyecto ya tiene memoria versionada bajo `.specify/memory/versions/` con
  `active.json`, manifests, snapshots constitucionales y scripts de resolucion,
  preparacion, activacion y rollback.
- `/sync-workspace-memory` resuelve un `sourceWorkspace` vivo y una
  `sourceVersionId`, pero no admite una fuente offline o portable.
- ICM no expone un comando nativo de exportacion total de memorias generales;
  la CLI actual ofrece `list`, `recall`, `memoir export` y `feedback search`.
- La capa correcta para esta iteracion sigue siendo workflow-first y local al
  repositorio, sin depender del dashboard.

## Design Goals

1. Introducir un bundle portable y comprimido sin reemplazar el formato
   operativo de la memoria activa.
2. Mantener una validacion estricta de procedencia, compatibilidad e integridad
   antes de permitir cualquier importacion.
3. Reutilizar el lifecycle versionado existente en vez de duplicarlo.
4. Mantener la implementacion pequena, testeable y basada en Node standard
   library.
5. Introducir una carpeta base explicita para artefactos exportados que no deje
   la salida librada a rutas arbitrarias.
6. Preservar paridad entre root, `scaffold`, Copilot y Antigravity para los
   nuevos workflows.

## Export Artifact Base Directory

El bundle no debe escribirse en cualquier ruta libre del filesystem por defecto.
La feature introduce `.exportsmemories/` como carpeta base gobernada para los
artefactos de exportacion dentro del repositorio vivo, y
`scaffold/.exportsmemories/` como mirror instalable.

Reglas operativas:

- los workflows de exportacion resuelven su destino dentro de
  `.exportsmemories/`;
- el Owner puede definir el nombre del archivo o una subruta controlada dentro
  de esa carpeta, pero no un destino arbitrario fuera de ella;
- la carpeta debe existir en root y `scaffold/` con placeholder persistido;
- los bundles generados se consideran artefactos runtime y no deben trackearse
  en git.

## Compressed JSON Bundle Model

### Why a gzipped JSON envelope

El requerimiento pide un formato comprimido, no necesariamente un `.zip` o
`.tar`. Elegir un JSON envelope comprimido con `gzip` tiene tres ventajas
directas:

- evita dependencias externas de archivado;
- mantiene un solo contrato serializable y validable con el schema actual;
- permite pruebas deterministas con `zlib` y fixtures de texto en el repo.

El bundle se modela como un archivo del tipo `*.memory-bundle.json.gz` cuyo
contenido descomprimido es un objeto JSON con dos bloques principales:

```text
{
  "metadata": {
    "sourceWorkspace": "...",
    "sourceVersionId": "...",
    "exportedAt": "...",
    "formatVersion": "1",
    "includedScopes": ["memories", "memoir"],
    "omittedScopes": ["feedback"],
    "integrity": {
      "algorithm": "sha256",
      "digest": "..."
    }
  },
  "payload": {
    "memories": [...],
    "memoir": {...},
    "feedback": [...]
  }
}
```

## Bundle Contract

### Metadata rules

El bloque `metadata` es obligatorio y debe permitir que el destino sepa, sin
ambiguedad:

- de que workspace proviene el bundle;
- que version de memoria representa;
- cuando fue exportado;
- que version de contrato usa el bundle;
- que scopes viajan y cuales quedaron explicitamente fuera;
- como verificar integridad del payload serializado.

### Payload rules

El bloque `payload` solo incluye los scopes solicitados. Un scope ausente no se
interpreta como error silencioso: debe estar reflejado en `omittedScopes`.

El bundle no es una version activa ni un manifest operativo. Es una fotografia
de transporte que luego debe convertirse en candidata dentro del workspace
destino.

## Version Lifecycle Integration Model

### Export flow

1. Resolver el workspace y la version a exportar.
2. Seleccionar scopes e identificar omisiones.
3. Recuperar la informacion necesaria mediante capacidades reales de ICM y del
   arbol versionado ya existente.
4. Normalizar el contenido a un envelope JSON.
5. Resolver el path final dentro de `.exportsmemories/`.
6. Calcular descriptor de integridad y comprimir el archivo.

### Import flow

1. Leer y descomprimir el bundle.
2. Validar schema, procedencia, version de formato e integridad.
3. Traducir el contenido validado a un input equivalente al de un sync live.
4. Preparar un manifest `candidate` en el workspace destino con metadata de
   origen bundle.
5. Detener el flujo a la espera de revision del Owner antes de activar.

### Manifest provenance extension

Los manifests de version no necesitan un modelo paralelo. Deben extenderse con
metadata opcional de transporte para distinguir entre:

- fuente live (`sourceTransport = "workspace-sync"`)
- fuente bundle (`sourceTransport = "bundle"`)

Cuando la fuente sea bundle, el manifest candidato y el manifest activo deben
preservar la trazabilidad minima:

- `sourceWorkspace`
- `sourceVersionId`
- `bundleFormatVersion`
- `bundleExportedAt`
- `includedScopes`
- `omittedScopes`
- `integrity.digest`

## Script Model

La automatizacion minima sigue viviendo en `scripts/memory-sync/`.

```text
scripts/memory-sync/
├── schema.mjs
├── store-utils.mjs
├── export-memory-bundle.mjs
├── import-memory-bundle.mjs
├── export-memory-bundle.test.mjs
├── import-memory-bundle.test.mjs
└── fixtures/
```

### Responsibilities

- `schema.mjs`: valida envelopes comprimidos, metadata de bundle y manifests
  enriquecidos con trazabilidad de transporte.
- `store-utils.mjs`: incorpora utilidades compartidas para serializar,
  comprimir y descomprimir envelopes.
- `export-memory-bundle.mjs`: genera el bundle a partir de una version
  explicitamente resuelta y scopes seleccionados.
- `import-memory-bundle.mjs`: valida y descomprime el bundle, luego normaliza su
  contenido para preparar una nueva version candidata.

Los scripts no sustituyen la decision del Owner: encapsulan validaciones y
transformaciones deterministas.

## Workflow Surface Model

La feature agrega dos workflows de soporte complementarios:

- `.github/prompts/export-memory-bundle.prompt.md`
- `.github/prompts/import-memory-bundle.prompt.md`
- `.exportsmemories/.gitkeep`

Y sus equivalentes Antigravity:

- `.agent/skills/export-memory-bundle/SKILL.md`
- `.agent/skills/import-memory-bundle/SKILL.md`

Ademas, para que esos workflows sean descubribles y queden instalados con la
plantilla, deben actualizarse:

- `.atl/skill-registry.md`
- `scaffold/.atl/skill-registry.md`
- `GEMINI.md`
- `scaffold/GEMINI.md`

## Shared Surfaces

### Live Repository

- `.specify/memory/versions/README.md`
- `.specify/memory/versions/templates/**`
- `.github/prompts/export-memory-bundle.prompt.md`
- `.github/prompts/import-memory-bundle.prompt.md`
- `.agent/skills/export-memory-bundle/SKILL.md`
- `.agent/skills/import-memory-bundle/SKILL.md`
- `.atl/skill-registry.md`
- `GEMINI.md`
- `.gitignore`
- `scripts/memory-sync/**`
- `README.md`
- `README.es.md`
- `package.json`

### Scaffold Mirrors

- `scaffold/.specify/memory/versions/README.md`
- `scaffold/.specify/memory/versions/templates/**`
- `scaffold/.github/prompts/export-memory-bundle.prompt.md`
- `scaffold/.github/prompts/import-memory-bundle.prompt.md`
- `scaffold/.agent/skills/export-memory-bundle/SKILL.md`
- `scaffold/.agent/skills/import-memory-bundle/SKILL.md`
- `scaffold/.atl/skill-registry.md`
- `scaffold/GEMINI.md`
- `scaffold/.gitignore`
- `scaffold/.exportsmemories/.gitkeep`
- `scaffold/package.json`

## Validation Strategy

La validacion debe demostrar contrato e integracion, no solo formato:

- pruebas Node sobre exportacion valida y exportacion parcial;
- pruebas Node sobre importacion rechazada por metadata o integridad invalidas;
- pruebas Node sobre candidata derivada de bundle y su activacion;
- pruebas Node sobre rollback de una version activada desde bundle;
- validacion de paridad root/scaffold y Copilot/Antigravity para prompts,
  skills, registry y templates.

Comando objetivo:

```text
node --test scripts/memory-sync/*.test.mjs
```

## Risks and Mitigations

- **Formato demasiado complejo**: usar `zip/tar` agregaria complejidad y
  dependencias. Mitigacion: sobre JSON comprimido con `gzip`.
- **Asumir un export nativo inexistente en ICM**: la CLI no ofrece exportacion
  total de memorias generales. Mitigacion: diseñar el flujo sobre comandos y
  consultas reales ya disponibles.
- **Bypass del lifecycle**: si el bundle activa directamente, se rompe la
  gobernanza. Mitigacion: toda importacion termina en `candidate`.
- **Deriva entre plataformas**: prompts sin skills o sin registry generan
  workflows invisibles o inconsistentes. Mitigacion: tratar el workflow como una
  superficie dual root/scaffold y Copilot/Antigravity.
- **Artefactos dispersos**: si cada exportacion puede ir a cualquier ruta, se
  pierde discoverability y gobernanza local. Mitigacion: centralizar la salida
  en `.exportsmemories/`.