import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Tests run against the real production build, because the service worker only exists there.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/volleyball-stats/`,
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/volleyball-stats/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
