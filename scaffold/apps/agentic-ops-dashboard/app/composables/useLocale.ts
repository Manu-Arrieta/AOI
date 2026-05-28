import { computed, ref } from 'vue'

import {
  dashboardMessages,
  defaultLocale,
  localeStorageKey,
  resolveDashboardLocale,
  type DashboardLocale,
} from '../utils/locales'

export interface LocaleStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const activeLocale = ref<DashboardLocale>(defaultLocale)

let initialized = false

function resolveStorage(storage?: LocaleStorageLike | null) {
  if (storage !== undefined) {
    return storage
  }

  if (!import.meta.client || globalThis.localStorage === undefined) {
    return null
  }

  return globalThis.localStorage
}

export function readStoredLocale(storage?: LocaleStorageLike | null) {
  try {
    const storedValue = resolveStorage(storage)?.getItem(localeStorageKey) ?? null
    return resolveDashboardLocale(storedValue)
  } catch {
    return defaultLocale
  }
}

export function persistLocale(locale: DashboardLocale, storage?: LocaleStorageLike | null) {
  try {
    resolveStorage(storage)?.setItem(localeStorageKey, locale)
  } catch {
    // Ignore storage failures and keep the current in-memory locale.
  }
}

export function initializeLocale(storage?: LocaleStorageLike | null) {
  activeLocale.value = readStoredLocale(storage)
  initialized = true

  return activeLocale.value
}

export function setLocale(nextLocale: string, storage?: LocaleStorageLike | null) {
  const resolvedLocale = resolveDashboardLocale(nextLocale)

  activeLocale.value = resolvedLocale
  persistLocale(resolvedLocale, storage)

  return resolvedLocale
}

export function toggleLocale(storage?: LocaleStorageLike | null) {
  return setLocale(activeLocale.value === 'en' ? 'es' : 'en', storage)
}

export function resetLocaleStateForTests() {
  activeLocale.value = defaultLocale
  initialized = false
}

export function useLocale(storage?: LocaleStorageLike | null) {
  if (!initialized) {
    initializeLocale(storage)
  }

  const locale = computed(() => activeLocale.value)
  const messages = computed(() => dashboardMessages[activeLocale.value])
  const isEnglish = computed(() => activeLocale.value === 'en')
  const isSpanish = computed(() => activeLocale.value === 'es')

  return {
    locale,
    messages,
    isEnglish,
    isSpanish,
    setLocale: (nextLocale: DashboardLocale) => setLocale(nextLocale, storage),
    toggleLocale: () => toggleLocale(storage),
  }
}
