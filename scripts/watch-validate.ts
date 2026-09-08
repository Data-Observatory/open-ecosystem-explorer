#!/usr/bin/env tsx
// Watches src/content/** and re-runs the standalone validator, filtered to
// the changed file, on every save — a faster feedback loop than running
// `npm run validate` by hand after each edit.
import { watch } from 'node:fs';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const WATCH_DIR = join(ROOT, 'src/content');

let pending: NodeJS.Timeout | undefined;
let queued = new Set<string>();

function runFor(relPath: string): void {
  console.log(`\n[watch-validate] ${relPath} changed →`);
  const child = spawn('tsx', [join(ROOT, 'scripts/validate.ts'), '--file', relPath], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  child.on('exit', () => console.log('[watch-validate] watching for changes...'));
}

function onChange(_event: string, filename: string | null): void {
  if (!filename || !filename.endsWith('.yaml')) return;
  const relPath = relative(ROOT, join(WATCH_DIR, filename)).split('\\').join('/');
  queued.add(relPath);
  // Debounce: editors often emit multiple fs events per save.
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    for (const f of queued) runFor(f);
    queued = new Set();
  }, 200);
}

function main(): void {
  console.log(`[watch-validate] watching ${relative(ROOT, WATCH_DIR)}/** (Ctrl+C to stop)`);
  watch(WATCH_DIR, { recursive: true }, onChange);
}

main();
