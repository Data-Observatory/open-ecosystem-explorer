#!/usr/bin/env tsx
// Generates standalone JSON Schema files from the canonical Zod schema
// (src/lib/model/schema.ts) for external tooling / editor integrations.
//
// `id` (entities) is stripped: it's injected programmatically at load time
// from the filename (I1, see src/content/loaders.ts) and never appears in
// the file itself, so a schema that required it would flag every real file
// as invalid. `body` (prose) is a real field in the file since the content
// migration to plain YAML and is kept in the generated schema.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { zEntity, zProseFile } from '../src/lib/model/schema.js';
import { zStory } from '../src/lib/stories/schema.js';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'schema');

/** Recursively strip a property (and its `required` entry) from every object schema in the tree — needed because zEntity is a discriminated union and its branches aren't individually exported to `.omit()` before generation. */
function stripProperty(node: unknown, key: string): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.properties && typeof obj.properties === 'object') {
    delete (obj.properties as Record<string, unknown>)[key];
  }
  if (Array.isArray(obj.required)) {
    obj.required = (obj.required as string[]).filter((r) => r !== key);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach((item) => stripProperty(item, key));
    else if (v && typeof v === 'object') stripProperty(v, key);
  }
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const entitySchema = zodToJsonSchema(zEntity, { name: 'Entity', $refStrategy: 'none' });
  stripProperty(entitySchema, 'id');
  writeFileSync(join(OUT_DIR, 'entity.schema.json'), JSON.stringify(entitySchema, null, 2) + '\n');

  const proseSchema = zodToJsonSchema(zProseFile, { name: 'Prose', $refStrategy: 'none' });
  writeFileSync(join(OUT_DIR, 'prose.schema.json'), JSON.stringify(proseSchema, null, 2) + '\n');

  // Stories carry their own id (checked against the filename, ST1), so nothing is stripped.
  const storySchema = zodToJsonSchema(zStory, { name: 'Story', $refStrategy: 'none' });
  writeFileSync(join(OUT_DIR, 'story.schema.json'), JSON.stringify(storySchema, null, 2) + '\n');

  console.log('Wrote schema/entity.schema.json, schema/prose.schema.json and schema/story.schema.json');
}

main();
