import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Gestión APSOL',
        short_name: 'APSOL',
        description: 'Sistema de gestión operativa de APSOL',
        theme_color: '#161b22',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Archivos estáticos que se guardan en caché para funcionar offline
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Caché para las fuentes de Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Caché para llamadas a Supabase (stale-while-revalidate: muestra caché y actualiza en background)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } // 5 minutos
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
})
