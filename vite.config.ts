/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// '/' for local dev and the Mac Mini release build; '/listy/' for the
// GitHub Pages project site (set via BASE_PATH in the Pages workflow).
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Listy',
        short_name: 'Listy',
        description: 'An infinite list for everything on your mind',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#101014',
        theme_color: '#101014',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Serve the manifest (and register the SW) in dev too, so `npm run dev`
      // behaves like the production build instead of falling back to SPA HTML.
      devOptions: { enabled: true },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
