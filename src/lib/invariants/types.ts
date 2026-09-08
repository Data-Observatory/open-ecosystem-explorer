import type { Entity, EntityId, GraphIndex, ProseFile, View, ViewProseFile } from '../model/types.js';
import type { LocaleCode } from '../../i18n/locales.js';
import type { EntityTypesVocab, PredicatesVocab, SimpleVocab } from '../model/vocab.js';

export type InvariantLevel = 'ERROR' | 'WARN';

export interface InvariantMessage {
  level: InvariantLevel;
  ruleId: string; // 'I7'
  file: string; // path relative to repo root
  field?: string; // dotted field path, with array index, e.g. relations[0].predicate
  value?: unknown; // the offending value
  message: string; // one-line summary of what's wrong
  hint: string; // the correction, and where applicable the closed list of legal alternatives
}

export interface EntityFileEntry {
  id: EntityId;
  file: string;
  entity: Entity;
}

export interface ProseFileEntry {
  id: EntityId;
  locale: LocaleCode;
  file: string;
  prose: ProseFile;
}

export interface ViewFileEntry {
  id: string;
  file: string;
  view: View;
}

export interface ViewProseFileEntry {
  id: string;
  locale: LocaleCode;
  file: string;
  prose: ViewProseFile;
}

export interface RunContext {
  entityFiles: EntityFileEntry[];
  proseFiles: ProseFileEntry[];
  viewFiles: ViewFileEntry[];
  viewProseFiles: ViewProseFileEntry[];
  entityTypesVocab: EntityTypesVocab;
  predicatesVocab: PredicatesVocab;
  tagsVocab: SimpleVocab;
  disciplinesVocab: SimpleVocab;
  statusesVocab: SimpleVocab;
  locales: readonly LocaleCode[];
  defaultLocale: LocaleCode;
  index: GraphIndex;
  now: Date;
}

export function fmt(msg: InvariantMessage): string {
  const header = `${msg.level} ${msg.ruleId}  ${msg.file}${msg.field ? `  ${msg.field}` : ''}`;
  const valueLine = msg.value !== undefined ? `\n  ${msg.message} Got: ${JSON.stringify(msg.value)}` : `\n  ${msg.message}`;
  const hintLines = msg.hint
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
  return `${header}${valueLine}\n${hintLines}`;
}
