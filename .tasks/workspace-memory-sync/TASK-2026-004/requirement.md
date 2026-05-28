# Requerimientos Funcionales: TASK-2026-004 - Sincronización y Versionado de Memorias ICM

## Resumen

Incorporar a la infraestructura agéntica una capacidad gobernada para importar
memorias desde otros workspaces almacenados en ICM, fusionarlas con la memoria
del workspace activo y producir una nueva versión operativa trazable. El flujo
debe permanecer bajo control explícito del Owner, permitir importaciones
totales o parciales, aceptar contexto adicional para orientar la unificación y
garantizar reversibilidad hacia una versión anterior si la memoria activa se
considera corrupta o inconsistente.

## Problema

Hoy el proyecto usa ICM como base obligatoria de memoria, pero no existe un
flujo formal para importar memoria desde otro workspace, seleccionar sólo una
parte del conocimiento disponible, documentar qué se retiene o se descarta ni
activar una nueva versión de memoria con trazabilidad completa. Tampoco existe
un contrato funcional que garantice el retorno a una versión previa si el merge
degrada la calidad o coherencia de la memoria activa.

## Objetivos

- Resolver de forma explícita el workspace fuente y la versión de memoria de
	origen desde el inicio del flujo.
- Permitir sincronizaciones totales o parciales según la intención del Owner.
- Incorporar contexto adicional del Owner para orientar el criterio de
	importación, retención y descarte.
- Normalizar y fusionar la memoria existente con la memoria importada para
	producir una nueva versión operativa identificable.
- Hacer explícitas las decisiones de `retain`, `complement` y `discard` durante
	la unificación.
- Vincular la constitución dinámica de memoria con la versión resultante.
- Garantizar rollback explícito hacia una versión anterior cuando la memoria
	activa resulte sospechada de corrupción, inconsistencia o degradación.

## Fuera de Alcance

- Construir en esta primera iteración una interfaz visual completa dentro del
	dashboard de operaciones para gestionar la sincronización.
- Implementar sincronización continua o automática entre workspaces sin acción
	explícita del Owner.
- Redefinir la gobernanza de `.resources/` o modificar artefactos de `.tasks/`
	ajenos a este dominio funcional.
- Delegar en el agente la decisión final de condensar o unificar memorias sin
	confirmación del Owner.

## Historias de Usuario

1. Como Owner, quiero elegir de qué workspace y de qué versión de memoria
	 importar información, para evitar sincronizaciones ambiguas o accidentales.
2. Como Owner, quiero decidir si la importación será completa o parcial, para
	 traer sólo el conocimiento que necesito en el contexto actual.
3. Como Owner, quiero aportar contexto adicional antes de sincronizar, para
	 indicar qué conocimiento es prioritario, cuál debe preservarse y cuál no
	 debería incorporarse.
4. Como Owner, quiero revisar qué partes del contenido se retienen, cuáles se
	 complementan y cuáles se descartan, para mantener la trazabilidad del merge.
5. Como Owner, quiero restaurar una versión anterior si detecto corrupción o
	 inconsistencia en la memoria activa, para no quedar atado a un merge fallido.

## Requerimientos Funcionales

- **Resolución explícita de origen y versión**: El sistema debe exigir la
	identificación del workspace fuente y de la versión de memoria de origen antes
	de comenzar cualquier importación.
- **Selección de alcance**: El sistema debe permitir que el Owner determine si
	la sincronización será total o parcial sobre los bloques de memoria
	disponibles.
- **Contexto directivo del Owner**: El sistema debe aceptar instrucciones o
	contexto adicional del Owner para orientar el sentido de la sincronización y
	el tratamiento esperado del contenido importado.
- **Normalización y fusión**: El sistema debe combinar la memoria del workspace
	activo con la memoria importada para producir una nueva versión operativa de
	memoria, sin sobrescribir silenciosamente el estado previo.
- **Trazabilidad de decisiones**: El sistema debe registrar de manera
	verificable qué contenido fue retenido, qué contenido fue incorporado como
	complemento y qué contenido fue descartado.
- **Constitución dinámica por versión**: La versión resultante debe quedar
	asociada a una constitución dinámica que represente el estado funcional de esa
	memoria activa.
- **Control del Owner sobre la unificación**: La validación final de la memoria
	fusionada y la decisión de consolidarla como estado aceptado deben permanecer
	bajo jurisdicción explícita del Owner.
- **Rollback explícito**: El sistema debe ofrecer un mecanismo controlado por el
	Owner para restaurar una versión anterior cuando la memoria activa se
	considere corrupta, inconsistente o degradada.
- **Restauración íntegra**: El rollback debe devolver al workspace a una versión
	previa validable, no sólo revertir una parte aislada del conocimiento.

## Restricciones

- La sincronización debe mantenerse como un flujo gobernado y auditable, no como
	una operación implícita o silenciosa.
- La ausencia de contexto adicional del Owner no debe bloquear el flujo, pero
	sí debe conservarse la necesidad de una selección explícita de origen y
	versión.
- El sistema no debe asumir que toda información importada es útil; siempre debe
	existir una diferenciación funcional entre retener, complementar y descartar.
- El rollback debe operar sobre versiones previamente identificables y
	restaurables; no puede depender de reconstrucciones manuales improvisadas.

## Señales de Aceptación

- Ningún flujo de sincronización avanza sin haber resuelto explícitamente el
	workspace fuente y la versión de memoria correspondiente.
- El Owner puede indicar si desea importar todo o sólo una parte del contenido
	disponible.
- El flujo acepta contexto adicional del Owner y lo incorpora como guía del
	proceso de sincronización.
- El resultado de la unificación muestra con claridad qué contenido fue
	retenido, complementado o descartado.
- La sincronización produce una nueva versión de memoria identificable y ligada
	a su constitución dinámica.
- Existe un mecanismo explícito de rollback que permite restaurar una versión
	anterior cuando la memoria activa sea considerada defectuosa.

## Riesgos y Consideraciones

- **Imposibilidad de retorno**: Si las versiones no quedan suficientemente
	aisladas, el rollback puede volverse parcial o imposible.
- **Delegación excesiva**: Si el sistema decide por sí mismo qué unificar o
	descartar, se rompe la frontera de responsabilidad del Owner.
- **Crecimiento desmedido de memoria**: Importaciones complementarias sin
	criterio pueden inflar el volumen y la complejidad de la memoria activa.
- **Falsa reversibilidad**: Un rollback que no restaure íntegramente la versión
	previa daría una sensación engañosa de seguridad operativa.