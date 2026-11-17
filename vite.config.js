import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' : la nouvelle version attend que l'utilisateur appuie sur
      // « Mettre à jour » (voir UpdateButton). Ne PAS ajouter skipWaiting ici :
      // il activerait la nouvelle version en pleine session, pendant que la
      // page tourne encore avec l'ancien code, dont les fichiers n'existent
      // plus sur le serveur : pages qui plantent et bandeau jamais affiché.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        id: '/',
        name: 'EcoGès - Gestion scolaire',
        short_name: 'EcoGès',
        description: "Gestion scolaire pour les écoles privées d'Afrique de l'Ouest.",
        lang: 'fr',
        start_url: '/',
        scope: '/',
        theme_color: '#0F4C3A',
        background_color: '#FAF8F4',
        display: 'standalone',
        categories: ['education', 'business'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // woff2 seulement (tous les navigateurs actuels) ; brand/ et icons/ ne
        // servent pas à l'application (sources de logo, icône de manifeste).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['brand/**', 'icons/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/functions/],
        importScripts: ['/push-sw.js'],
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Ressources externes gardées pour le hors connexion. Les appels à
        // Supabase ne sont volontairement PAS mis en cache (données toujours
        // fraîches).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.sheetjs.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sheetjs',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
