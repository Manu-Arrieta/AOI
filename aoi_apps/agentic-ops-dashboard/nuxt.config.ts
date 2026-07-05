import { fileURLToPath, URL } from 'node:url'

import { defineNuxtConfig } from 'nuxt/config'

// Absolute path to the root shared/ directory, resolved relative to this
// config file. Using import.meta.url makes this work regardless of CWD or
// the filesystem location where the project lives (AOI, MoviHub, Trash, etc.)
const sharedDir = fileURLToPath(new URL('./shared', import.meta.url))

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
  // Vite / Vue (client-side) alias
  alias: {
    '~/shared': sharedDir,
  },
  // Nitro / Rollup (server-side) alias — required separately
  nitro: {
    alias: {
      '~/shared': sharedDir,
    },
  },
  ui: {
    fonts: false,
    colorMode: true,
    experimental: {
      componentDetection: true,
    },
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  typescript: {
    strict: true,
  },
})