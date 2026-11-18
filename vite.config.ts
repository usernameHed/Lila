import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This build's name: inside the app (__BUILD__) and in /build.txt, so an open page can tell a newer version is
// live and show its Update button (src/lib/update.ts).
const BUILD = Date.now().toString(36);

/** Every file of the built site with a short hash of its content (the page itself is "/"). */
function siteFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else {
        const rel = '/' + relative(dir, path).split('\\').join('/');
        if (rel === '/sw.js' || rel === '/build.txt' || name.startsWith('.')) continue;
        out[rel === '/index.html' ? '/' : rel] = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 10);
      }
    }
  };
  walk(dir);
  return out;
}

/** dist/sw.js from src/offline/sw.template.js: this build's name and file list (see the template). */
function writeServiceWorker() {
  const files = siteFiles('dist');
  const sw = readFileSync('src/offline/sw.template.js', 'utf8').replace("'__BUILD__'", JSON.stringify(BUILD)).replace('__FILES__', JSON.stringify(files));
  writeFileSync('dist/sw.js', sw);
}

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    { name: 'build-name', apply: 'build', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build.txt', source: BUILD }); } },
    { name: 'offline', apply: 'build', closeBundle: writeServiceWorker },
  ],
  test: { environment: 'node' },
} as Parameters<typeof defineConfig>[0]);
