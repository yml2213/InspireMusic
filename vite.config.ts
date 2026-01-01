import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['android-chrome-192x192.png', 'android-chrome-512x512.png', 'apple-touch-icon.png', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon.ico'],
      manifest: {
        name: 'InspireMusic',
        short_name: 'InspireMusic',
        description: 'A modern music player',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        id: 'ins-music-202512',
        start_url: '/',
        dir: 'ltr',
        lang: 'zh',
        scope: '/',
        orientation: 'natural',
        display_override: ['standalone', 'window-controls-overlay'],
        categories: ['music'],
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2015',
    outDir: 'dist',
  }
})

