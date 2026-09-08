#!/usr/bin/env tsx
// Read-only maintenance aid: prints an entity's facts file plus both locale
// prose files side by side, so a reviewer doesn't have to open 3 files in 2
// directories to see everything about one entity. Does not validate or edit.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { locales } from '../src/i18n/locales.js';

const ROOT = join(import.meta.dirname, '..');

function section(title: string, path: string): void {
  const bar = '─'.repeat(Math.max(8, title.length));
  console.log(`\n┌─ ${title} ${bar}`);
  if (!existsSync(path)) {
    console.log(`  (missing: ${path.replace(ROOT + '/', '')})`);
    return;
  }
  console.log(readFileSync(path, 'utf-8').trimEnd());
}

function main(): void {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: npm run review -- <entity-id>');
    process.exit(1);
  }

  const entityPath = join(ROOT, 'src/content/entities', `${id}.yaml`);
  if (!existsSync(entityPath)) {
    console.error(`No entity file at src/content/entities/${id}.yaml`);
    process.exit(1);
  }

  section(`entities/${id}.yaml`, entityPath);
  for (const { code } of locales) {
    section(`i18n/${code}/${id}.yaml`, join(ROOT, 'src/content/i18n', code, `${id}.yaml`));
  }
  console.log();
}

main();
