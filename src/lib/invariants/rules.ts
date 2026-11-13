// I1-I31 (specs.md §5.5). Each rule is a pure function over a RunContext,
// returning InvariantMessage[]. Message shape is a requirement (§8.4b): file,
// field path, offending value, rule ID, and a correction drawn from the same
// vocabulary that produced the failure.
import spdxLicenseIds from 'spdx-license-ids/index.json' with { type: 'json' };
import type { Entity, EntityId, PredicateId, Relation, View } from '../model/types.js';
import { ACYCLIC_PREDICATES, ENTITY_TYPES, SYMMETRIC_PREDICATES } from '../model/types.js';
import { findCycle } from '../graph/traverse.js';
import type { InvariantMessage, RunContext } from './types.js';
import type { LocaleCode } from '../../i18n/locales.js';

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_RE = /^https:\/\/[^\s]+$/;
const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PARTIAL_DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function basenameNoExt(file: string): string {
  // split() on any string, including '', always yields >=1 element, so pop()
  // is never undefined — no fallback needed.
  const last = file.split('/').pop()!;
  return last.replace(/\.yaml$/, '');
}

function err(ruleId: string, file: string, message: string, hint: string, field?: string, value?: unknown): InvariantMessage {
  return { level: 'ERROR', ruleId, file, field, value, message, hint };
}
function warn(ruleId: string, file: string, message: string, hint: string, field?: string, value?: unknown): InvariantMessage {
  return { level: 'WARN', ruleId, file, field, value, message, hint };
}

/** Order-insensitive membership check against a predicate's crossTypePairs
 *  escape hatch from sameTypeOnly (I8, A.2's `interoperates-with` note). */
function crossTypePairAllowed(pairs: [string, string][] | undefined, a: string, b: string): boolean {
  if (!pairs) return false;
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// Slugified inverse-label -> canonical id lookup, built from the predicates
// vocab, used by I7 to catch someone authoring the inverse form.
function buildInverseLookup(ctx: RunContext): Map<string, PredicateId> {
  const lookup = new Map<string, PredicateId>();
  for (const [id, def] of ctx.predicatesVocab) {
    for (const label of Object.values(def.inverseLabel)) {
      if (!label) continue;
      const slug = label.toLowerCase().trim().replace(/\s+/g, '-');
      lookup.set(slug, id);
    }
    // Also a naive "<id>-by" / "<id-without-trailing-s>-by" guess for common typos.
    lookup.set(`${id}-by`, id);
  }
  return lookup;
}

export function ruleI1(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { id, file, entity } of ctx.entityFiles) {
    if (!ID_RE.test(id) || id.length < 2 || id.length > 64) {
      out.push(
        err(
          'I1',
          file,
          `id '${id}' does not match /^[a-z0-9]+(?:-[a-z0-9]+)*$/ or is out of the 2-64 char range.`,
          'Use lowercase kebab-case, e.g. "digital-science".',
          'id',
          id,
        ),
      );
    }
    const stem = basenameNoExt(file);
    if (entity.id !== stem) {
      out.push(
        err(
          'I1',
          file,
          `id '${entity.id}' does not equal the filename stem '${stem}'.`,
          `Rename the file to ${entity.id}.yaml, or change id to '${stem}'.`,
          'id',
          entity.id,
        ),
      );
    }
  }
  return out;
}

export function ruleI2(ctx: RunContext): InvariantMessage[] {
  const seen = new Map<EntityId, string>();
  const out: InvariantMessage[] = [];
  for (const { id, file } of ctx.entityFiles) {
    const prior = seen.get(id);
    if (prior) {
      out.push(
        err(
          'I2',
          file,
          `id '${id}' is already used by ${prior}. Ids are unique across all types, no type-scoped namespacing.`,
          'Rename one of the two entities to a distinct id.',
          'id',
          id,
        ),
      );
    } else {
      seen.set(id, file);
    }
  }
  return out;
}

export function ruleI3(ctx: RunContext): InvariantMessage[] {
  const ids = new Set(ctx.entityFiles.map((e) => e.id));
  const out: InvariantMessage[] = [];
  for (const { id, file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (!ids.has(r.target)) {
        out.push(
          err(
            'I3',
            file,
            `relations[${i}].target '${r.target}' does not resolve to any entity.`,
            `Create src/content/entities/${r.target}.yaml in the same change, or remove this relation.`,
            `relations[${i}].target`,
            r.target,
          ),
        );
      }
    });
    void id;
  }
  return out;
}

export function ruleI4(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { id, file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (r.target === id) {
        out.push(err('I4', file, `relations[${i}] is a self-loop (${id} -> ${id}).`, 'Remove this relation.', `relations[${i}]`, r.target));
      }
    });
  }
  return out;
}

export function ruleI5(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    const seen = new Set<string>();
    entity.relations.forEach((r, i) => {
      const key = `${r.predicate}|${r.target}`;
      if (seen.has(key)) {
        out.push(
          err(
            'I5',
            file,
            `duplicate relation (predicate: ${r.predicate}, target: ${r.target}) at relations[${i}].`,
            'Remove the duplicate — a triple is authored at most once.',
            `relations[${i}]`,
          ),
        );
      }
      seen.add(key);
    });
  }
  return out;
}

export function ruleI6(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const validIds = [...ctx.predicatesVocab.keys()].sort();
  for (const { file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (!ctx.predicatesVocab.has(r.predicate as PredicateId)) {
        const inverseLookup = buildInverseLookup(ctx);
        const canonical = inverseLookup.get(r.predicate);
        if (canonical) return; // I7 reports this case with a better message
        out.push(
          err(
            'I6',
            file,
            `Unknown predicate '${r.predicate}'. It is not in the closed vocabulary (src/content/vocab/predicates.yaml).`,
            `Valid predicates: ${validIds.join(', ')}.`,
            `relations[${i}].predicate`,
            r.predicate,
          ),
        );
      }
    });
  }
  return out;
}

export function ruleI7(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const inverseLookup = buildInverseLookup(ctx);
  for (const { file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (ctx.predicatesVocab.has(r.predicate as PredicateId)) return;
      const canonical = inverseLookup.get(r.predicate);
      if (!canonical) return; // I6 reports unrecognised predicates
      const def = ctx.predicatesVocab.get(canonical)!;
      const validForDomain = [...ctx.predicatesVocab.values()]
        .filter((d) => d.domain.includes(entity.type))
        .map((d) => d.id)
        .sort();
      out.push(
        err(
          'I7',
          file,
          `Unknown predicate '${r.predicate}'. It is the INVERSE label of '${canonical}'.`,
          `Relations are authored in the canonical direction only (C2): write '${canonical}' in the file of the ` +
            `entity that ${def.label.en ?? canonical} the target — not the inverse in this file. Inverses are ` +
            `derived at build time; you never author them.\n` +
            `Valid predicates with domain '${entity.type}': ${validForDomain.join(', ')}.`,
          `relations[${i}].predicate`,
          r.predicate,
        ),
      );
    });
  }
  return out;
}

export function ruleI8(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const byId = new Map(ctx.entityFiles.map((e) => [e.id, e.entity]));
  for (const { file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      const def = ctx.predicatesVocab.get(r.predicate as PredicateId);
      if (!def) return; // I6/I7 already reported
      const target = byId.get(r.target);
      if (!target) return; // I3 already reported

      const domainOk = def.domain.includes(entity.type);
      const rangeOk = def.range.includes(target.type);
      const sameTypeOk = !def.sameTypeOnly || entity.type === target.type || crossTypePairAllowed(def.crossTypePairs, entity.type, target.type);

      // A suggested predicate must actually work for this pair — including
      // sameTypeOnly/crossTypePairs — or it just trades one I8 error for another.
      const validAlternatives = (): PredicateId[] =>
        [...ctx.predicatesVocab.values()]
          .filter(
            (d) =>
              d.domain.includes(entity.type) &&
              d.range.includes(target.type) &&
              (!d.sameTypeOnly || entity.type === target.type || crossTypePairAllowed(d.crossTypePairs, entity.type, target.type)),
          )
          .map((d) => d.id);

      if (!domainOk) {
        const suggestions = validAlternatives();
        out.push(
          err(
            'I8',
            file,
            `Domain violation: '${r.predicate}' requires subject.type in [${def.domain.join(', ')}]; '${entity.id}' is a ${entity.type}.`,
            suggestions.length > 0 ? `Did you mean ${suggestions.map((s) => `'${s}'`).join(' or ')}? See A.2.` : 'See A.2 for the full predicate table.',
            `relations[${i}]`,
          ),
        );
      } else if (!rangeOk) {
        const suggestions = validAlternatives();
        out.push(
          err(
            'I8',
            file,
            `Range violation: '${r.predicate}' requires target.type in [${def.range.join(', ')}]; '${target.id}' is a ${target.type}.`,
            suggestions.length > 0 ? `Did you mean ${suggestions.map((s) => `'${s}'`).join(' or ')}? See A.2.` : 'See A.2 for the full predicate table.',
            `relations[${i}]`,
          ),
        );
      } else if (!sameTypeOk) {
        out.push(
          err(
            'I8',
            file,
            `'${r.predicate}' is sameTypeOnly; subject '${entity.id}' (${entity.type}) and target '${target.id}' (${target.type}) differ.`,
            'Point this relation at an entity of the same type, or use a different predicate.',
            `relations[${i}]`,
          ),
        );
      }
    });
  }
  return out;
}

export function ruleI9(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const predicate of SYMMETRIC_PREDICATES) {
    const pairs = new Map<string, { file: string; entity: Entity }[]>();
    for (const { file, entity } of ctx.entityFiles) {
      entity.relations.forEach((r) => {
        if (r.predicate !== predicate) return;
        const [a, b] = [entity.id, r.target].sort();
        const key = `${a}|${b}`;
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key)!.push({ file, entity });
      });
    }
    // A symmetric predicate whose domain differs from its range (`related-to`:
    // any type -> concept) has only one legal direction for a thing -> concept
    // pair, so "authored on the smaller id" cannot apply to it. The smaller-id
    // rule is enforced only where both endpoints could legally author the edge.
    const def = ctx.predicatesVocab.get(predicate);
    const typeOf = new Map(ctx.entityFiles.map((e) => [e.id, e.entity.type]));
    const reversible = (a: string, b: string): boolean => {
      const ta = typeOf.get(a);
      const tb = typeOf.get(b);
      if (!def || !ta || !tb) return true;
      return def.domain.includes(ta) && def.range.includes(ta) && def.domain.includes(tb) && def.range.includes(tb);
    };
    for (const [key, authors] of pairs) {
      const [smaller, larger] = key.split('|') as [string, string];
      if (authors.length > 1) {
        out.push(
          err(
            'I9',
            authors[1]!.file,
            `Symmetric predicate '${predicate}' for pair (${key.replace('|', ', ')}) is authored more than once.`,
            `Author it exactly once, in the file of the lexicographically smaller id ('${smaller}').`,
          ),
        );
      } else if (authors[0]!.entity.id !== smaller && reversible(smaller, larger)) {
        out.push(
          err(
            'I9',
            authors[0]!.file,
            `Symmetric predicate '${predicate}' must be authored on the lexicographically smaller id ('${smaller}'), not '${authors[0]!.entity.id}'.`,
            `Move this relation to src/content/entities/${smaller}.yaml.`,
          ),
        );
      }
    }
  }
  return out;
}

export function ruleI10(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const predicate of ACYCLIC_PREDICATES) {
    const edges = ctx.index.edges.filter((e) => e.predicate === predicate);
    const cycle = findCycle(edges);
    if (cycle) {
      // cycle[0] always names a real entity: findCycle only ever operates on
      // ctx.index.edges, which are built exclusively from authored relations
      // of real entities in ctx.entityFiles.
      out.push(
        err(
          'I10',
          ctx.entityFiles.find((e) => e.id === cycle[0])!.file,
          `Predicate '${predicate}' forms a cycle: ${cycle.join(' -> ')}.`,
          'Break the cycle by removing or redirecting one of these relations.',
        ),
      );
    }
  }
  return out;
}

export function ruleI11(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const id of ctx.index.stats.orphans) {
    const entry = ctx.entityFiles.find((e) => e.id === id)!;
    if (entry.entity.isolated === true && entry.entity.note) continue;
    out.push(
      err(
        'I11',
        entry.file,
        `'${id}' has no incoming or outgoing relations.`,
        `Add a relation, or set "isolated: true" with an explanatory "note" field if this is deliberate.`,
        'relations',
      ),
    );
  }
  return out;
}

export function ruleI12(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  // computeStats pre-initialises byType/byPredicate for every declared
  // type/predicate (§5.4), so these are always numbers, never undefined.
  // A vocab entry flagged `pending: true` is declared ahead of its first
  // instance (e.g. `concept`, `is-a`): exempt while empty, and a WARN once it
  // is populated so the stale flag gets removed.
  for (const type of ENTITY_TYPES) {
    const count = ctx.index.stats.byType[type];
    const pending = ctx.entityTypesVocab.get(type)?.pending === true;
    if (count === 0 && !pending) {
      out.push(
        err(
          'I12',
          'src/content/vocab/entity-types.yaml',
          `Entity type '${type}' has zero instances.`,
          'Add at least one entity of this type, or remove it from vocab/entity-types.yaml (or mark it `pending: true` while the first one is being written).',
          type,
        ),
      );
    } else if (count > 0 && pending) {
      out.push(
        warn(
          'I12',
          'src/content/vocab/entity-types.yaml',
          `Entity type '${type}' is marked pending but has ${count} instance(s).`,
          'Remove `pending: true` from this type in vocab/entity-types.yaml.',
          type,
        ),
      );
    }
  }
  for (const [id, def] of ctx.predicatesVocab) {
    const count = ctx.index.stats.byPredicate[id];
    if (count === 0 && def.pending !== true) {
      out.push(
        err(
          'I12',
          'src/content/vocab/predicates.yaml',
          `Predicate '${id}' has zero edges.`,
          'Author at least one relation using this predicate, remove it from vocab/predicates.yaml, or mark it `pending: true` until its first edge lands.',
          id,
        ),
      );
    } else if (count > 0 && def.pending === true) {
      out.push(
        warn(
          'I12',
          'src/content/vocab/predicates.yaml',
          `Predicate '${id}' is marked pending but has ${count} edge(s).`,
          'Remove `pending: true` from this predicate in vocab/predicates.yaml.',
          id,
        ),
      );
    }
  }
  return out;
}

export function ruleI13(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    entity.tags.forEach((tag, i) => {
      if (!ctx.tagsVocab.has(tag)) {
        out.push(
          err(
            'I13',
            file,
            `tag '${tag}' is not declared in src/content/vocab/tags.yaml.`,
            `Add it there first (a separate PR, C6), or use an existing tag: ${[...ctx.tagsVocab.keys()].slice(0, 8).join(', ')}...`,
            `tags[${i}]`,
            tag,
          ),
        );
      }
    });
    (entity.disciplines ?? []).forEach((d, i) => {
      if (!ctx.disciplinesVocab.has(d)) {
        out.push(
          err(
            'I13',
            file,
            `discipline '${d}' is not declared in src/content/vocab/disciplines.yaml.`,
            `Valid disciplines: ${[...ctx.disciplinesVocab.keys()].join(', ')}.`,
            `disciplines[${i}]`,
            d,
          ),
        );
      }
    });
    if (!ctx.statusesVocab.has(entity.status)) {
      out.push(
        err(
          'I13',
          file,
          `status '${entity.status}' is not declared in src/content/vocab/statuses.yaml.`,
          `Valid statuses: ${[...ctx.statusesVocab.keys()].join(', ')}.`,
          'status',
          entity.status,
        ),
      );
    }
  }
  return out;
}

export function ruleI14(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, prose } of ctx.proseFiles) {
    const len = prose.summary.length;
    if (len < 40 || len > 200) {
      out.push(err('I14', file, `summary is ${len} chars; must be 40-200.`, 'Expand or trim the summary.', 'summary', prose.summary));
    }
    if (prose.summary.includes('\n')) {
      out.push(err('I14', file, 'summary spans multiple lines.', 'Keep summary to a single line.', 'summary'));
    }
    if (/[*_`#[\]]/.test(prose.summary)) {
      out.push(err('I14', file, 'summary contains Markdown syntax.', 'Write summary as plain text; use the body for formatted prose.', 'summary'));
    }
    if (prose.name && prose.summary.trim() === prose.name.trim()) {
      out.push(err('I14', file, 'summary is identical to name.', 'Write a summary that says what the thing is and does, not just its name.', 'summary'));
    }
  }
  return out;
}

export function ruleI15(ctx: RunContext, now: Date): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    if (entity.sources.length < 1) {
      out.push(err('I15', file, 'sources must have at least 1 entry.', 'Add >=1 source with a URL and accessed date.', 'sources'));
    }
    entity.sources.forEach((s, i) => {
      if (!HTTPS_RE.test(s.url)) {
        out.push(err('I15', file, `source url '${s.url}' is not https.`, 'Use an https:// URL.', `sources[${i}].url`, s.url));
      }
      if (!FULL_DATE_RE.test(s.accessed) || new Date(s.accessed) > now) {
        out.push(
          err('I15', file, `source accessed date '${s.accessed}' is invalid or in the future.`, 'Use a valid YYYY-MM-DD date not in the future.', `sources[${i}].accessed`, s.accessed),
        );
      }
    });
    entity.relations.forEach((r, i) => {
      if (r.confidence && r.confidence !== 'asserted' && (!r.sources || r.sources.length === 0)) {
        out.push(
          err(
            'I15',
            file,
            `relations[${i}] has confidence '${r.confidence}' but no sources.`,
            'Add >=1 source, or set confidence to "asserted" if it is self-evident from the target.',
            `relations[${i}].sources`,
          ),
        );
      }
    });
  }
  return out;
}

export function ruleI16(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const spdxSet = new Set(spdxLicenseIds as string[]);
  for (const { file, entity } of ctx.entityFiles) {
    if (entity.codebase === 'open-source') {
      const spdx = entity.identifiers?.spdx;
      if (!spdx && !entity.note) {
        out.push(
          err(
            'I16',
            file,
            `codebase: open-source requires identifiers.spdx or an explanatory note.`,
            'Add identifiers.spdx with a valid SPDX license id, or a note explaining the licensing.',
            'codebase',
          ),
        );
      } else if (spdx && !spdxSet.has(spdx)) {
        out.push(err('I16', file, `identifiers.spdx '${spdx}' is not a valid SPDX license id.`, 'See https://spdx.org/licenses/ for valid ids.', 'identifiers.spdx', spdx));
      }
    }
  }
  return out;
}

export function ruleI17(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    if (!HTTPS_RE.test(entity.url)) {
      out.push(err('I17', file, `url '${entity.url}' is not a valid absolute https URL.`, 'Use an https:// URL.', 'url', entity.url));
    }
  }
  return out;
}

const ID_FORMAT_RES: Record<'ror' | 'doi' | 'wikidata' | 're3data' | 'isni', RegExp> = {
  ror: /^0[a-z0-9]{6}\d{2}$/,
  doi: /^10\.\d{4,9}\/\S+$/,
  wikidata: /^Q\d+$/,
  re3data: /^r3d\d+$/,
  isni: /^\d{4} \d{4} \d{4} \d{3}[\dX]$/,
};

export function ruleI18(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    for (const [rawKey, re] of Object.entries(ID_FORMAT_RES)) {
      const key = rawKey as keyof typeof ID_FORMAT_RES;
      const value = entity.identifiers?.[key];
      if (value && !re.test(value)) {
        out.push(err('I18', file, `identifiers.${key} '${value}' does not match the expected format.`, `Expected pattern: ${re}.`, `identifiers.${key}`, value));
      }
    }
  }
  return out;
}

export function ruleI19(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const byId = new Map(ctx.entityFiles.map((e) => [e.id, e.entity]));
  for (const { file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (r.predicate !== 'owned-by') return;
      const target = byId.get(r.target);
      if (!target) return; // I3
      if (target.type !== 'organization' || target.orgKind !== 'company') {
        out.push(
          err(
            'I19',
            file,
            `'owned-by' target '${r.target}' must be an organization with orgKind: company.`,
            "Use 'governed-by' or 'operated-by' if the owner is not a company.",
            `relations[${i}]`,
          ),
        );
      }
    });
  }
  return out;
}

export function ruleI20(ctx: RunContext, now: Date): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const oneYearAhead = new Date(now);
  oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
  function checkDate(file: string, field: string, value: string | undefined): void {
    if (!value) return;
    if (!PARTIAL_DATE_RE.test(value)) {
      out.push(err('I20', file, `'${value}' is not a valid partial ISO date.`, 'Use YYYY, YYYY-MM or YYYY-MM-DD.', field, value));
      return;
    }
    const asDate = new Date(value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value);
    if (asDate > oneYearAhead) {
      out.push(err('I20', file, `'${value}' is more than one year in the future.`, 'Check the date.', field, value));
    }
  }
  for (const { file, entity } of ctx.entityFiles) {
    checkDate(file, 'since', entity.since);
    checkDate(file, 'until', entity.until);
    if (entity.since && entity.until && entity.since > entity.until) {
      out.push(err('I20', file, `since ('${entity.since}') is after until ('${entity.until}').`, 'since must be <= until.', 'since'));
    }
    entity.relations.forEach((r, i) => {
      checkDate(file, `relations[${i}].since`, r.since);
      checkDate(file, `relations[${i}].until`, r.until);
      if (r.since && r.until && r.since > r.until) {
        out.push(err('I20', file, `relations[${i}].since is after until.`, 'since must be <= until.', `relations[${i}].since`));
      }
    });
  }
  return out;
}

function resolveIdField(ctx: RunContext, file: string, entity: Entity, field: string, ids: string[] | undefined, requiredType: string): InvariantMessage[] {
  if (!ids) return [];
  const out: InvariantMessage[] = [];
  const byId = new Map(ctx.entityFiles.map((e) => [e.id, e.entity]));
  ids.forEach((id, i) => {
    const target = byId.get(id);
    if (!target) {
      out.push(err('I21', file, `${field}[${i}] '${id}' does not resolve to any entity.`, `Create it, or remove this reference.`, `${field}[${i}]`, id));
    } else if (target.type !== requiredType) {
      out.push(err('I21', file, `${field}[${i}] '${id}' must be a '${requiredType}' entity; it is '${target.type}'.`, `Point at a '${requiredType}' entity.`, `${field}[${i}]`, id));
    }
  });
  void entity;
  return out;
}

export function ruleI21(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    if (entity.type === 'repository') out.push(...resolveIdField(ctx, file, entity, 'persistentIdScheme', entity.persistentIdScheme, 'identifier'));
    if (entity.type === 'aggregator') out.push(...resolveIdField(ctx, file, entity, 'harvestProtocols', entity.harvestProtocols, 'standard'));
    if (entity.type === 'publishing-platform') out.push(...resolveIdField(ctx, file, entity, 'markupStandard', entity.markupStandard, 'standard'));
  }
  return out;
}

export function ruleI22(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    if (entity.governance !== 'commercial') continue;
    const hasOwnedBy = entity.relations.some((r) => r.predicate === 'owned-by');
    if (!hasOwnedBy && !entity.note) {
      out.push(
        err(
          'I22',
          file,
          `governance: commercial requires an outgoing 'owned-by' edge, or a note explaining why none is recorded.`,
          "Add a relation with predicate 'owned-by' pointing at the parent company, or add a 'note' field.",
          'relations',
        ),
      );
    }
  }
  return out;
}

export function ruleI23(): InvariantMessage[] {
  // Enforced at the schema level: EntityBase has no `layer` field, so an
  // authored `layer:` key is simply not a recognised property and the loader
  // strips/rejects it upstream. Kept as a named rule for parity with the spec
  // numbering and so a future loose-parsing change has somewhere to check.
  return [];
}

export function ruleI24(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const ids = new Set(ctx.entityFiles.map((e) => e.id));
  for (const { file, view } of ctx.viewFiles) {
    if (view.query.kind === 'explicit') {
      view.query.entities.forEach((id, i) => {
        if (!ids.has(id)) {
          out.push(err('I24', file, `query.entities[${i}] '${id}' does not resolve to any entity.`, 'Fix the id or remove it.', `query.entities[${i}]`, id));
        }
      });
    }
    if (view.query.kind === 'predicate' && !ctx.predicatesVocab.has(view.query.predicate)) {
      out.push(err('I24', file, `query.predicate '${view.query.predicate}' is not a known predicate.`, 'Use one of the predicates in A.2.', 'query.predicate'));
    }
  }
  return out;
}

function resolveViewEntities(ctx: RunContext, view: View): EntityId[] {
  const entities = [...ctx.index.entities.values()];
  const query = view.query;
  // Narrowing `query.kind` doesn't propagate into the closures below if we
  // keep reading `view.query` inside them — hence hoisting to this local.
  if (query.kind === 'explicit') return query.entities;
  if (query.kind === 'predicate') {
    const predicate = query.predicate;
    return ctx.index.edges.filter((e) => e.predicate === predicate).map((e) => e.to);
  }
  const where = query.where;
  return entities.filter((e) => where.some((clause) => Object.entries(clause).every(([k, v]) => matchesClause(e, k, v)))).map((e) => e.id);
}

function matchesClause(entity: Entity, key: string, value: string | string[]): boolean {
  const actual = (entity as unknown as Record<string, unknown>)[key];
  const values = Array.isArray(value) ? value : [value];
  if (Array.isArray(actual)) return values.some((v) => actual.includes(v));
  return values.includes(actual as string);
}

export function ruleI25(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, view } of ctx.viewFiles) {
    const resolved = resolveViewEntities(ctx, view);
    if (resolved.length === 0) {
      out.push(err('I25', file, `view '${view.id}' resolves to zero entities.`, 'Broaden the query, or remove this view.', 'query'));
    }
  }
  return out;
}

export function ruleI26(ctx: RunContext, now: Date): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const eighteenMonthsMs = 18 * 30.44 * 24 * 60 * 60 * 1000;
  for (const { file, entity } of ctx.entityFiles) {
    const reviewed = new Date(entity.lastReviewed);
    if (now.getTime() - reviewed.getTime() > eighteenMonthsMs) {
      out.push(warn('I26', file, `lastReviewed (${entity.lastReviewed}) is more than 18 months old.`, 'Re-verify the entity and bump lastReviewed.', 'lastReviewed'));
    }
  }
  return out;
}

export function ruleI27(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { id, file, entity } of ctx.entityFiles) {
    if (entity.type !== 'identifier') continue;
    // Every id in ctx.entityFiles was used to build ctx.index, so it always
    // has an (possibly empty) incoming list.
    const hasIssuer = ctx.index.incoming.get(id)!.some((e) => e.predicate === 'issues');
    if (!hasIssuer) {
      out.push(warn('I27', file, `identifier '${id}' has no inbound 'issues' edge.`, "Add an 'issues' relation from its registration agency.", 'relations'));
    }
  }
  return out;
}

export function ruleI28(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    const byPredicate = new Map<PredicateId, number>();
    for (const r of entity.relations as Relation[]) {
      byPredicate.set(r.predicate as PredicateId, (byPredicate.get(r.predicate as PredicateId) ?? 0) + 1);
    }
    for (const [predicate, count] of byPredicate) {
      const def = ctx.predicatesVocab.get(predicate);
      if (def?.maxOutDegree && count > def.maxOutDegree) {
        out.push(
          warn(
            'I28',
            file,
            `${count} '${predicate}' relations exceed maxOutDegree (${def.maxOutDegree}).`,
            'Diagrams will collapse this into a cluster node; the accessible table still lists all of them.',
            'relations',
          ),
        );
      }
    }
  }
  if (ctx.index.components.length > 1) {
    out.push(
      warn(
        'I28',
        'src/content/entities/',
        `Graph has ${ctx.index.components.length} weakly connected components.`,
        ctx.index.components.map((c, i) => `component ${i + 1} (${c.length}): ${c.slice(0, 5).join(', ')}${c.length > 5 ? '...' : ''}`).join('\n'),
      ),
    );
  }
  return out;
}

export function ruleI29(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const defaultProseIds = new Set(ctx.proseFiles.filter((p) => p.locale === ctx.defaultLocale).map((p) => p.id));
  for (const { id, file } of ctx.entityFiles) {
    if (!defaultProseIds.has(id)) {
      out.push(
        err(
          'I29',
          file,
          `no prose file for the default locale ('${ctx.defaultLocale}').`,
          `Create src/content/i18n/${ctx.defaultLocale}/${id}.yaml with a valid summary.`,
        ),
      );
    }
  }
  const defaultViewProseIds = new Set(ctx.viewProseFiles.filter((p) => p.locale === ctx.defaultLocale).map((p) => p.id));
  for (const { id, file } of ctx.viewFiles) {
    if (!defaultViewProseIds.has(id)) {
      out.push(
        err('I29', file, `no prose file for the default locale ('${ctx.defaultLocale}') for view '${id}'.`, `Create src/content/i18n/${ctx.defaultLocale}/views/${id}.yaml.`),
      );
    }
  }
  return out;
}

export function ruleI30(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const entityIds = new Set(ctx.entityFiles.map((e) => e.id));
  const nonDefaultLocales = ctx.locales.filter((l) => l !== ctx.defaultLocale);

  for (const locale of nonDefaultLocales) {
    const present = new Set(ctx.proseFiles.filter((p) => p.locale === locale).map((p) => p.id));
    const missing = [...entityIds].filter((id) => !present.has(id));
    if (missing.length > 0 && ctx.requireFullI18n) {
      // Strict mode (config.ts REQUIRE_FULL_I18N): one ERROR per entity, on the
      // entity's own file, so each gap is individually addressable.
      const fileOf = new Map(ctx.entityFiles.map((e) => [e.id, e.file]));
      for (const id of missing.sort()) {
        out.push(
          err(
            'I30',
            fileOf.get(id) ?? 'src/content/entities/',
            `no '${locale}' prose file (REQUIRE_FULL_I18N is on: every locale must be complete).`,
            `Create src/content/i18n/${locale}/${id}.yaml with a valid summary and body, or unset REQUIRE_FULL_I18N (src/lib/invariants/config.ts) to downgrade this to a WARN.`,
          ),
        );
      }
    } else if (missing.length > 0) {
      out.push(
        warn(
          'I30',
          'src/content/i18n/',
          `${locale}: ${missing.length} of ${entityIds.size} entities untranslated.`,
          `Missing: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`,
        ),
      );
    }
  }

  const byId = new Map(ctx.entityFiles.map((e) => [e.id, e.entity]));
  for (const { file, id, prose } of ctx.proseFiles) {
    const entity = byId.get(id);
    if (!entity || !prose.relationNotes) continue;
    for (const key of Object.keys(prose.relationNotes)) {
      const [predicate, target] = key.split('@');
      const matches = entity.relations.some((r) => r.predicate === predicate && r.target === target);
      if (!matches) {
        out.push(
          err(
            'I30',
            file,
            `relationNotes key '${key}' does not resolve to a relation authored in ${id}'s facts file.`,
            'Fix the key to "<predicate>@<target>" of a relation that exists, or remove it.',
            `relationNotes["${key}"]`,
          ),
        );
      }
    }
  }

  // shortName: a map label, so it must exist in every locale or in none, and
  // never be longer than the name it abbreviates.
  const withShort = new Map<EntityId, Set<LocaleCode>>();
  for (const { file, id, locale, prose } of ctx.proseFiles) {
    if (!prose.shortName) continue;
    if (!withShort.has(id)) withShort.set(id, new Set());
    withShort.get(id)!.add(locale);
    const fullName = prose.name ?? byId.get(id)?.name ?? id;
    if (prose.shortName.length > fullName.length) {
      out.push(err('I30', file, `shortName '${prose.shortName}' is longer than the name '${fullName}'.`, 'Use a shorter label, or drop shortName.', 'shortName'));
    }
  }
  for (const [id, have] of withShort) {
    for (const locale of ctx.locales) {
      if (have.has(locale)) continue;
      // A locale with no prose file at all is the untranslated case above, not this one.
      const file = ctx.proseFiles.find((p) => p.id === id && p.locale === locale)?.file;
      if (!file) continue;
      out.push(err('I30', file, `shortName is set in ${[...have].join(', ')} but missing in '${locale}'.`, 'Add shortName in every locale, or remove it from all of them.', 'shortName'));
    }
  }
  return out;
}

export function ruleI31(ctx: RunContext, entityBodies: Map<EntityId, string>): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { id, file } of ctx.entityFiles) {
    const body = entityBodies.get(id) ?? '';
    if (body.trim().length > 0) {
      out.push(err('I31', file, 'entity facts file has a non-empty Markdown body.', 'Move prose to src/content/i18n/<locale>/<id>.yaml; the facts file body must be empty.', 'body'));
    }
  }
  return out;
}

// Predicates for which "who?" is the memo's central governance question
// (M§1) — I32 nudges every edge of these toward a checkable primary source,
// I33 nudges every entity of the relevant types toward having at least one.
const GOVERNANCE_PREDICATES: ReadonlySet<PredicateId> = new Set(['owned-by', 'governed-by', 'operated-by', 'developed-by', 'funded-by']);

export function ruleI32(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    entity.relations.forEach((r, i) => {
      if (!GOVERNANCE_PREDICATES.has(r.predicate as PredicateId)) return;
      if (r.verified) return;
      out.push(
        warn(
          'I32',
          file,
          `relations[${i}] ('${r.predicate}' -> '${r.target}') has no 'verified' provenance stamp.`,
          `Add verified: { date: "YYYY-MM-DD", url: "https://..." } once this edge has been checked against a primary source.`,
          `relations[${i}].verified`,
        ),
      );
    });
  }
  return out;
}

// Every type in the domain of these predicates should show at least one of
// them, since "who runs/builds/governs this" is close to always answerable
// for infrastructure of these kinds — an empty set is far more likely a gap
// than a genuine fact (§A of the content-quality review).
const COMPLETENESS_FLOOR: { types: readonly string[]; anyOf: readonly PredicateId[] }[] = [
  { types: ['repository', 'index', 'aggregator', 'publishing-platform'], anyOf: ['operated-by', 'developed-by', 'governed-by'] },
  { types: ['standard'], anyOf: ['developed-by', 'governed-by'] },
];

export function ruleI33(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  for (const { file, entity } of ctx.entityFiles) {
    for (const floor of COMPLETENESS_FLOOR) {
      if (!floor.types.includes(entity.type)) continue;
      const has = entity.relations.some((r) => floor.anyOf.includes(r.predicate as PredicateId));
      if (!has) {
        out.push(
          warn(
            'I33',
            file,
            `'${entity.id}' (${entity.type}) has none of [${floor.anyOf.join(', ')}] — who runs, builds or governs this?`,
            `Add one of these relations if the fact is known, or an 'isolated'-style note explaining why it genuinely has none.`,
            'relations',
          ),
        );
      }
    }
  }
  return out;
}

/** Every predicate declares a `family` that exists in vocab/predicate-families.yaml. */
export function ruleI35(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const families = ctx.predicateFamiliesVocab;
  if (!families) return out;
  for (const [id, def] of ctx.predicatesVocab) {
    if (!def.family || !families.has(def.family)) {
      out.push(
        err(
          'I35',
          'src/content/vocab/predicates.yaml',
          `Predicate '${id}' has ${def.family ? `unknown family '${def.family}'` : 'no family'}.`,
          `Set family to one of: ${[...families.keys()].join(', ')} (vocab/predicate-families.yaml).`,
          id,
        ),
      );
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Heuristic: a `note` field mentioning another entity's name by string,
 *  with no edge connecting the two, is very often a fact that was written
 *  down in prose but never authored as a relation (§B.3.3 of the content-
 *  quality review — this pattern accounted for several real gaps: Zenodo's
 *  own note naming InvenioRDM/OpenAIRE, ROR's naming Crossref/CDL, etc.).
 *  Deliberately noisy-tolerant (WARN, not ERROR): a mention is a hint to
 *  check, not proof a relation is missing. */
export function ruleI34(ctx: RunContext): InvariantMessage[] {
  const out: InvariantMessage[] = [];
  const nameToId = new Map<string, EntityId>();
  for (const { id, entity } of ctx.entityFiles) {
    if (entity.name.length >= 3) nameToId.set(entity.name, id);
    for (const aka of entity.aka ?? []) {
      if (aka.length >= 3) nameToId.set(aka, id);
    }
  }
  // Every id in ctx.entityFiles was used to build ctx.index, so outgoing.get
  // always returns an array (possibly empty) — never undefined (build-index.ts
  // pre-initialises every id), same guarantee ruleI27 relies on.
  const connected = (a: EntityId, b: EntityId): boolean =>
    ctx.index.outgoing.get(a)!.some((e) => e.to === b) || ctx.index.outgoing.get(b)!.some((e) => e.to === a);

  for (const { id, file, entity } of ctx.entityFiles) {
    const noteTexts: { field: string; text: string }[] = [];
    if (entity.note) noteTexts.push({ field: 'note', text: entity.note });
    entity.relations.forEach((r, i) => {
      if (r.note) noteTexts.push({ field: `relations[${i}].note`, text: r.note });
    });
    entity.sources.forEach((s, i) => {
      if (s.note) noteTexts.push({ field: `sources[${i}].note`, text: s.note });
    });

    const flaggedTargets = new Set<EntityId>();
    for (const { field, text } of noteTexts) {
      for (const [name, targetId] of nameToId) {
        if (targetId === id || flaggedTargets.has(targetId)) continue;
        const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
        if (!re.test(text)) continue;
        if (connected(id, targetId)) continue;
        flaggedTargets.add(targetId);
        out.push(
          warn(
            'I34',
            file,
            `'${field}' mentions '${targetId}' ("${name}") but no relation connects '${id}' and '${targetId}'.`,
            `If this is a real relationship, author it as a relation; otherwise this is a false positive and can be ignored.`,
            field,
          ),
        );
      }
    }
  }
  return out;
}

export interface RuleRunner {
  id: string;
  /** Verbatim from specs.md §5.5's I1-I31 table — the /model page (Phase 6)
   *  renders this list FROM this array so published docs cannot drift from
   *  the enforced rules (specs.md §7's `/model` row). Keep in sync by hand
   *  when a rule's spec wording changes; there is no other copy. */
  level: 'ERROR' | 'WARN' | 'WARN / ERROR';
  description: string;
  run: (ctx: RunContext, extra: { now: Date; entityBodies: Map<EntityId, string> }) => InvariantMessage[];
}

export const RULES: RuleRunner[] = [
  { id: 'I1', level: 'ERROR', description: '`id` matches /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 2–64 chars, equals the filename stem.', run: (ctx) => ruleI1(ctx) },
  { id: 'I2', level: 'ERROR', description: '`id` is unique across all entity types. No type-scoped namespacing.', run: (ctx) => ruleI2(ctx) },
  { id: 'I3', level: 'ERROR', description: 'No dangling references: every relations[].target resolves.', run: (ctx) => ruleI3(ctx) },
  { id: 'I4', level: 'ERROR', description: 'No self-loops.', run: (ctx) => ruleI4(ctx) },
  { id: 'I5', level: 'ERROR', description: 'No duplicate triples (id, predicate, target).', run: (ctx) => ruleI5(ctx) },
  { id: 'I6', level: 'ERROR', description: 'predicate ∈ vocab/predicates.yaml. Closed vocabulary.', run: (ctx) => ruleI6(ctx) },
  { id: 'I7', level: 'ERROR', description: 'Canonical direction only. An inverse-form predicate (owns, issued-by, implemented-by, …) is rejected with a message naming the canonical form and the file it belongs in.', run: (ctx) => ruleI7(ctx) },
  { id: 'I8', level: 'ERROR', description: 'Domain/range: subject.type ∈ predicate.domain, target.type ∈ predicate.range; where sameTypeOnly, also subject.type === target.type.', run: (ctx) => ruleI8(ctx) },
  { id: 'I9', level: 'ERROR', description: 'Symmetric predicates authored once per unordered pair, on the lexicographically smaller id.', run: (ctx) => ruleI9(ctx) },
  { id: 'I10', level: 'ERROR', description: 'Acyclic predicates form a DAG (part-of, supersedes, profile-of, depends-on, owned-by, member-of). Error prints the cycle path.', run: (ctx) => ruleI10(ctx) },
  { id: 'I11', level: 'ERROR', description: "No orphans: in-degree + out-degree ≥ 1 unless isolated: true with an explanatory note.", run: (ctx) => ruleI11(ctx) },
  { id: 'I12', level: 'ERROR', description: 'Every declared EntityType has ≥1 instance and every declared predicate ≥1 edge. Unused vocabulary is removed or populated; an entry flagged `pending: true` is exempt until its first instance (WARN if the flag is then left behind).', run: (ctx) => ruleI12(ctx) },
  { id: 'I13', level: 'ERROR', description: 'Every tags[], disciplines[], status, governance value exists in the corresponding vocab file.', run: (ctx) => ruleI13(ctx) },
  { id: 'I14', level: 'ERROR', description: 'summary (in each locale file) is 40–200 chars, single-line, no Markdown syntax, not identical to name.', run: (ctx) => ruleI14(ctx) },
  { id: 'I15', level: 'ERROR', description: "sources.length ≥ 1; every Source.url is https:; accessed is a valid ISO date not in the future. Relations with confidence !== 'asserted' carry ≥1 source.", run: (ctx, extra) => ruleI15(ctx, extra.now) },
  { id: 'I16', level: 'ERROR', description: 'codebase: open-source requires a licence-bearing sourceUrl or an explanatory note; SPDX identifiers validated against spdx-license-ids.', run: (ctx) => ruleI16(ctx) },
  { id: 'I17', level: 'ERROR', description: 'url and all Source.url are syntactically valid absolute https: URLs. (Reachability checked weekly, non-blocking — §11.)', run: (ctx) => ruleI17(ctx) },
  { id: 'I18', level: 'ERROR', description: 'Populated identifiers.* match their format regexes (§5.1).', run: (ctx) => ruleI18(ctx) },
  { id: 'I19', level: 'ERROR', description: 'owned-by targets an organization with orgKind: company. Ownership by a non-company is governed-by or operated-by, not owned-by.', run: (ctx) => ruleI19(ctx) },
  { id: 'I20', level: 'ERROR', description: 'since ≤ until where both present; valid partial ISO dates; neither >1 year in the future.', run: (ctx, extra) => ruleI20(ctx, extra.now) },
  { id: 'I21', level: 'ERROR', description: 'EntityId-valued subtype fields resolve to an entity of the required type: persistentIdScheme[] → identifier, harvestProtocols[] → standard, markupStandard[] → standard.', run: (ctx) => ruleI21(ctx) },
  { id: 'I22', level: 'ERROR', description: "governance: commercial requires ≥1 outgoing owned-by edge, or a note on the entity explaining why none is recorded. Enforces the memo's central question at authoring time.", run: (ctx) => ruleI22(ctx) },
  { id: 'I23', level: 'ERROR', description: 'layer is never present in an entity file — it is derived (§5.1, C1).', run: () => ruleI23() },
  { id: 'I24', level: 'ERROR', description: "Every View.query (§5.6) resolves against the current graph; kind: 'explicit' entity IDs must exist.", run: (ctx) => ruleI24(ctx) },
  { id: 'I25', level: 'ERROR', description: 'A View.query resolving to zero entities is an error, not an empty page.', run: (ctx) => ruleI25(ctx) },
  { id: 'I26', level: 'WARN', description: 'lastReviewed older than 18 months (also badged in the UI).', run: (ctx, extra) => ruleI26(ctx, extra.now) },
  { id: 'I27', level: 'WARN', description: 'An identifier entity with no inbound issues edge.', run: (ctx) => ruleI27(ctx) },
  { id: 'I28', level: 'WARN', description: 'Any generated diagram exceeds its node/edge budget (§6.4) before overflow collapsing; or the graph has >1 weakly connected component (prints each component\'s size and members).', run: (ctx) => ruleI28(ctx) },
  { id: 'I29', level: 'ERROR', description: 'Every entity and every view has a prose file in the default locale, with a valid summary. A facts file without content/i18n/<default>/<id>.yaml fails the build (§5.7).', run: (ctx) => ruleI29(ctx) },
  { id: 'I30', level: 'WARN / ERROR', description: "WARN per missing non-default-locale prose file, aggregated as one line per locale (e.g. 'en: 12 of 78 entities untranslated') — or, with REQUIRE_FULL_I18N on (src/lib/invariants/config.ts / env), one ERROR per missing file. ERROR if a locale file declares a field outside the translatable set, if a relationNotes key does not resolve to a relation authored in the facts file, or if shortName is longer than the name or set in some locales but not others.", run: (ctx) => ruleI30(ctx) },
  { id: 'I31', level: 'ERROR', description: 'An entity facts file has an empty Markdown body, and carries no summary or description. Prose exists only in content/i18n/** (C10).', run: (ctx, extra) => ruleI31(ctx, extra.entityBodies) },
  { id: 'I32', level: 'WARN', description: "Every edge of a governance predicate (owned-by, governed-by, operated-by, developed-by, funded-by) carries relations[].verified: { date, url } recording the primary source it was checked against.", run: (ctx) => ruleI32(ctx) },
  { id: 'I33', level: 'WARN', description: "Completeness floor: every repository/index/aggregator/publishing-platform has ≥1 of {operated-by, developed-by, governed-by}; every standard has ≥1 of {developed-by, governed-by}.", run: (ctx) => ruleI33(ctx) },
  { id: 'I34', level: 'WARN', description: "Heuristic: an entity's note/relationNote/source-note text mentions another entity by name with no relation connecting the two — a likely fact-recorded-as-prose gap.", run: (ctx) => ruleI34(ctx) },
  { id: 'I35', level: 'ERROR', description: 'Every predicate declares a `family` that exists in vocab/predicate-families.yaml (display grouping, ≤5 families).', run: (ctx) => ruleI35(ctx) },
];

export function runAllInvariants(ctx: RunContext, extra: { now: Date; entityBodies: Map<EntityId, string> }): InvariantMessage[] {
  return RULES.flatMap((rule) => rule.run(ctx, extra));
}
