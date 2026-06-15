import { defineNuxtPlugin, onNuxtReady, useCookie } from '#imports'
import { watch } from 'vue'

import { initializeLocale, readStoredLocale, setLocale, useLocale } from '../composables/useLocale'
import { localeStorageKey, type DashboardLocale } from '../utils/locales'

function createCookieStorage(localeCookie: ReturnType<typeof useCookie<DashboardLocale | null>>) {
  return {
    getItem(key: string) {
      if (key !== localeStorageKey) {
        return null
      }

      return localeCookie.value ?? null
    },
    setItem(key: string, value: string) {
      if (key === localeStorageKey) {
        localeCookie.value = value === 'es' ? 'es' : 'en'
      }
    },
  }
}

export default defineNuxtPlugin(() => {
  const localeCookie = useCookie<DashboardLocale | null>(localeStorageKey, {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  const hadCookie = localeCookie.value !== null && localeCookie.value !== undefined

  initializeLocale(createCookieStorage(localeCookie))

  if (import.meta.client) {
    const { locale } = useLocale()

    watch(locale, (nextLocale) => {
      localeCookie.value = nextLocale
    }, { immediate: true })

    onNuxtReady(() => {
      if (hadCookie) {
        return
      }

      const storedLocale = readStoredLocale()

      if (storedLocale !== locale.value) {
        setLocale(storedLocale)
      }
    })
  }
})