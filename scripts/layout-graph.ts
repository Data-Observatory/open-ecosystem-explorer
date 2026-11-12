#!/usr/bin/env tsx
// Build-time layout for the minimal map (`/{loc}/map3`): reads every entity
// file's id + relations, runs the deterministic layout in
// src/lib/map/layout.ts, and writes src/generated/graph-layout.json
// (committed, so layout changes show up in review as a diff).
//
//   npm run layout:generate   write the file
//   npm run layout:check      exit 1 if the committed file is stale
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { computeLayout, serializeLayout, type LayoutEdge, type LayoutNode } from '../src/lib/map/layout.js';
import { DEFAULT_ANCHOR_IDS } from '../src/lib/map/anchors.js';

const ROOT = join(import.meta.dirname, '..');
const ENTITIES_DIR = join(ROOT, 'src/content/entities');
const OUT_FILE = join(ROOT, 'src/generated/graph-layout.json');

export function loadLayoutInput(): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const anchors = new Set(DEFAULT_ANCHOR_IDS);
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  for (const file of readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.yaml')).sort()) {
    const id = file.replace(/\.yaml$/, '');
    const data = parseYaml(readFileSync(join(ENTITIES_DIR, file), 'utf-8')) as { relations?: { target: string }[] };
    nodes.push({ id, anchor: anchors.has(id) });
    for (const r of data.relations ?? []) edges.push({ from: id, to: r.target });
  }
  edges.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  return { nodes, edges };
}

export function generateLayoutFile(): string {
  const { nodes, edges } = loadLayoutInput();
  return serializeLayout(computeLayout(nodes, edges));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const body = generateLayoutFile();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT_FILE, 'utf-8');
    } catch {
      /* missing file counts as stale */
    }
    if (current !== body) {
      console.error('src/generated/graph-layout.json is stale. Run: npm run layout:generate');
      process.exit(1);
    }
    console.log('graph layout: up to date');
  } else {
    mkdirSync(join(ROOT, 'src/generated'), { recursive: true });
    writeFileSync(OUT_FILE, body);
    console.log(`graph layout: wrote ${Object.keys(JSON.parse(body).positions).length} positions`);
  }
}
