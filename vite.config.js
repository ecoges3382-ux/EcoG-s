import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'EcoGès - Gestion scolaire',
        short_name: 'EcoGès',
        description: 'Application de gestion scolaire moderne et rapide.',
        theme_color: '#0F4C3A', // Le vert de ta barre en haut
        background_color: '#FAF8F4', // La couleur de fond au démarrage
        display: 'standalone', // Force le mode "vraie application" (sans barre d'adresse)
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // 👇 LA NOUVELLE PARTIE POUR LES NOTIFICATIONS 👇
      workbox: {
        importScripts: ['/push-sw.js']
      }
    })
  ]
});
