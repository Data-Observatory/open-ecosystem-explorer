import { buildFixtureInput } from '../../fixtures/valid-graph.js';
import type { ValidationInput } from '../../../src/lib/invariants/run.js';
import type { Entity } from '../../../src/lib/model/types.js';
import type { EntityFileEntry, ProseFileEntry, ViewFileEntry } from '../../../src/lib/invariants/types.js';

/** A deep, independent copy of the shared fixture — every test mutates its own copy. */
export function freshInput(): ValidationInput {
  return structuredClone(buildFixtureInput()) as unknown as ValidationInput;
}

export function withEntity(input: ValidationInput, id: string, patch: Partial<Entity>): ValidationInput {
  return {
    ...input,
    entityFiles: input.entityFiles.map((e): EntityFileEntry => (e.id === id ? { ...e, entity: { ...e.entity, ...patch } as Entity } : e)),
  };
}

export function addEntity(input: ValidationInput, entity: Entity, file?: string): ValidationInput {
  return { ...input, entityFiles: [...input.entityFiles, { id: entity.id, file: file ?? `src/content/entities/${entity.id}.md`, entity }] };
}

export function removeEntity(input: ValidationInput, id: string): ValidationInput {
  return { ...input, entityFiles: input.entityFiles.filter((e) => e.id !== id) };
}

export function findEntity(input: ValidationInput, id: string): EntityFileEntry {
  const entry = input.entityFiles.find((e) => e.id === id);
  if (!entry) throw new Error(`fixture has no entity '${id}'`);
  return entry;
}

export function withProse(input: ValidationInput, id: string, locale: string, patch: Partial<ProseFileEntry['prose']>): ValidationInput {
  return {
    ...input,
    proseFiles: input.proseFiles.map((p): ProseFileEntry => (p.id === id && p.locale === locale ? { ...p, prose: { ...p.prose, ...patch } } : p)),
  };
}

export function removeProse(input: ValidationInput, id: string, locale: string): ValidationInput {
  return { ...input, proseFiles: input.proseFiles.filter((p) => !(p.id === id && p.locale === locale)) };
}

export function withView(input: ValidationInput, id: string, patch: Partial<ViewFileEntry['view']>): ValidationInput {
  return {
    ...input,
    viewFiles: input.viewFiles.map((v): ViewFileEntry => (v.id === id ? { ...v, view: { ...v.view, ...patch } } : v)),
  };
}
