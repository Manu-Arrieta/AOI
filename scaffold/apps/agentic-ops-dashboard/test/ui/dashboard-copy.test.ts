import { beforeEach, describe, expect, it } from 'vitest'

import {
  dashboardMessages,
  localeStorageKey,
  translateDashboardStatus,
  translateWorkspaceError,
} from '../../app/utils/locales'
import { resetLocaleStateForTests, useLocale } from '../../app/composables/useLocale'

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed))

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

describe('dashboard localized shell coverage', () => {
  beforeEach(() => {
    resetLocaleStateForTests()
  })

  it('covers the refreshed shell, task board, relations, and governed actions in both languages', () => {
    const localeState = useLocale(createStorage())

    expect(localeState.messages.value.landing.workspace.dashboardTitle)
      .toBe(dashboardMessages.en.landing.workspace.dashboardTitle)
    expect(localeState.messages.value.taskBoard.analysisLane)
      .toBe(dashboardMessages.en.taskBoard.analysisLane)
    expect(localeState.messages.value.relationsPanel.title)
      .toBe(dashboardMessages.en.relationsPanel.title)
    expect(localeState.messages.value.resources.operationsTitle)
      .toBe(dashboardMessages.en.resources.operationsTitle)
    expect(localeState.messages.value.resourceDialog.deleteTitle)
      .toBe(dashboardMessages.en.resourceDialog.deleteTitle)

    localeState.setLocale('es')

    expect(localeState.messages.value.landing.workspace.dashboardTitle)
      .toBe(dashboardMessages.es.landing.workspace.dashboardTitle)
    expect(localeState.messages.value.taskBoard.analysisLane)
      .toBe(dashboardMessages.es.taskBoard.analysisLane)
    expect(localeState.messages.value.relationsPanel.title)
      .toBe(dashboardMessages.es.relationsPanel.title)
    expect(localeState.messages.value.resources.operationsTitle)
      .toBe(dashboardMessages.es.resources.operationsTitle)
    expect(localeState.messages.value.resourceDialog.deleteTitle)
      .toBe(dashboardMessages.es.resourceDialog.deleteTitle)
  })

  it('translates known statuses and feedback while leaving repository-origin text untouched', () => {
    expect(translateDashboardStatus('📐 En Análisis', 'en')).toBe('📐 In analysis')
    expect(translateDashboardStatus('⚙️ In Implementation', 'es')).toBe('⚙️ En implementacion')
    expect(translateDashboardStatus('TASK-2026-003', 'es')).toBe('TASK-2026-003')

    expect(translateWorkspaceError('Could not load the workspace snapshot.', 'es'))
      .toBe('No se pudo cargar el snapshot del workspace.')
    expect(translateWorkspaceError('Could not load task details for TASK-2026-003.', 'es'))
      .toBe('No se pudieron cargar los detalles de la tarea TASK-2026-003.')
    expect(translateWorkspaceError('## Raw artifact preview', 'es')).toBe('## Raw artifact preview')
  })

  it('persists the locale used by the dashboard shell across sessions', () => {
    const storage = createStorage({
      [localeStorageKey]: 'es',
    })

    const localeState = useLocale(storage)

    expect(localeState.messages.value.common.language).toBe(dashboardMessages.es.common.language)

    localeState.setLocale('en')

    expect(storage.getItem(localeStorageKey)).toBe('en')
  })
})