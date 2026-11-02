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
      registerType: 'autoUpdate',
      manifest: {
        name: 'Side Out Stats',
        short_name: 'Side Out',
        description: 'Volleyball stat tracker',
        // Relative to the manifest, so these resolve under /volleyball-stats/
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#060A14',
        theme_color: '#060A14',
        icons: [],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
