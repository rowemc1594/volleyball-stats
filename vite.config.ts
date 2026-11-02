/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// The site is served from https://<user>.github.io/volleyball-stats/
const base = '/volleyball-stats/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      // A new version downloads in the background and takes over on the next launch.
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        id: base,
        name: 'Side Out Stats',
        short_name: 'Side Out',
        description: 'Volleyball stat tracker',
        // Relative to the manifest file, so these resolve under /volleyball-stats/
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#060A14',
        theme_color: '#0A1120',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs to start with no network.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // Any page request under the scope gets the cached app shell.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
