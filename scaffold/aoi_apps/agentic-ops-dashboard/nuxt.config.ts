import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-26',
  modules: ['@nuxt/ui'],
  future: {
    compatibilityVersion: 4,
  },
  devtools: {
    enabled: true,
  },
  css: ['~/assets/styles/main.css'],
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  ui: {
    fonts: false,
    colorMode: false,
    experimental: {
      componentDetection: true,
    },
  },
  typescript: {
    strict: true,
  },
})