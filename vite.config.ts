import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This build's name: inside the app (__BUILD__) and in /build.txt, so an open page can tell a newer version is
// live and show its Update button (src/lib/update.ts).
const BUILD = Date.now().toString(36);

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    { name: 'build-name', apply: 'build', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build.txt', source: BUILD }); } },
  ],
  test: { environment: 'node' },
} as Parameters<typeof defineConfig>[0]);
