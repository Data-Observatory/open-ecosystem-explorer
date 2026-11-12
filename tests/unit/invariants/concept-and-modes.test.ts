// The `concept` type + `is-a` predicate, the `prominence` field, predicate
// families and the REQUIRE_FULL_I18N validator mode. All against synthetic
// fixtures (tests/fixtures/valid-graph.ts) — no repo content involved, so
// these hold while the real graph still has zero concepts.
import { describe, expect, it } from 'vitest';
import { runValidation } from '../../../src/lib/invariants/run.js';
import { REQUIRE_FULL_I18N, resolveRequireFullI18n } from '../../../src/lib/invariants/config.js';
import { addEntity as addEntityRaw, freshInput, withEntity } from './helpers.js';
import { zEntity } from '../../../src/lib/model/schema.js';
import { DEFAULT_PROMINENCE, LAYERS, prominenceOf } from '../../../src/lib/model/types.js';
import type { ConceptEntity, Entity, Relation } from '../../../src/lib/model/types.js';
import { buildIndex } from '../../../src/lib/graph/build-index.js';
import { buildLayerStackDiagram, describeLayerStack } from '../../../src/lib/mermaid/layers.js';
import { buildTaxonomyMindmap, describeTaxonomy } from '../../../src/lib/mermaid/taxonomy.js';
import { buildModelErDiagram, describeModel } from '../../../src/lib/mermaid/model.js';
import { buildTypeMapDiagram } from '../../../src/lib/mermaid/type-map.js';
import { classDefLine, shapeForLayer, wrapShape, TYPE_FILL } from '../../../src/lib/mermaid/palette.js';
import type { ValidationInput } from '../../../src/lib/invariants/run.js';

const SRC = { url: 'https://example.org/source', accessed: '2026-09-01' };

// helpers.addEntity defaults to a `.md` file name, which trips I1; use `.yaml` like the real loader.
function addEntity(input: ValidationInput, entity: Entity): ValidationInput {
  return addEntityRaw(input, entity, `src/content/entities/${entity.id}.yaml`);
}

/** Default-locale prose is mandatory (I29); `en` keeps strict mode tests clean. */
function addProse(input: ValidationInput, id: string): void {
  input.proseFiles.push({ id, locale: 'es', file: `src/content/i18n/es/${id}.yaml`, prose: { summary: 'Concepto ficticio usado solo para ejercitar el esquema de validación.', body: 'x' } });
  input.proseFiles.push({ id, locale: 'en', file: `src/content/i18n/en/${id}.yaml`, prose: { summary: 'Fixture concept used only to exercise the validation schema in tests.', body: 'x' } });
}

function concept(id: string, relations: Relation[] = [], extra: Partial<ConceptEntity> = {}): ConceptEntity {
  return {
    id,
    type: 'concept',
    name: `Concept ${id}`,
    url: `https://example.org/${id}`,
    status: 'active',
    governance: 'not-applicable',
    tags: ['function:identification'],
    relations,
    sources: [SRC],
    lastReviewed: '2026-09-01',
    ...extra,
  };
}

// An `fx-pid` concept, an `fx-doi-ish` concept that is-a it, and the existing
// fixture identifier is-a fx-pid: the shape the real data will take.
function withConcepts(): ValidationInput {
  let input = freshInput();
  input = addEntity(input, concept('fx-pid'));
  input = addEntity(input, concept('fx-persistent-doi', [{ predicate: 'is-a', target: 'fx-pid' }]));
  input = withEntity(input, 'fx-identifier', {
    relations: [
      { predicate: 'depends-on', target: 'fx-repository-a' },
      { predicate: 'is-a', target: 'fx-pid' },
    ],
  });
  for (const id of ['fx-pid', 'fx-persistent-doi']) addProse(input, id);
  return input;
}

function errorsFor(input: ValidationInput, ruleId: string) {
  return runValidation(input).errors.filter((m) => m.ruleId === ruleId);
}

describe('concept type + is-a predicate', () => {
  it('baseline: zero concepts and a pending `is-a` raise no I12 error (nor any new error)', () => {
    const result = runValidation(freshInput());
    expect(result.errors).toEqual([]);
    expect(result.messages.filter((m) => m.ruleId === 'I12')).toEqual([]);
  });

  it('accepts valid concepts, concept->concept and entity->concept is-a edges', () => {
    const result = runValidation(withConcepts());
    expect(result.errors).toEqual([]);
  });

  it('warns (I12) once concept/is-a are populated but still flagged pending', () => {
    const result = runValidation(withConcepts());
    const fields = result.warnings.filter((m) => m.ruleId === 'I12').map((m) => m.field).sort();
    expect(fields).toEqual(['concept', 'is-a']);
  });

  it('is-a range violation: target must be a concept', () => {
    const input = withEntity(withConcepts(), 'fx-identifier', { relations: [{ predicate: 'is-a', target: 'fx-repository-a' }] });
    const msgs = errorsFor(input, 'I8');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/Range violation: 'is-a' requires target\.type in \[concept\]/);
  });

  it('domain violation: a concept cannot be the subject of issues / implements', () => {
    const input = withEntity(withConcepts(), 'fx-pid', { relations: [{ predicate: 'issues', target: 'fx-identifier' }] });
    const msgs = errorsFor(input, 'I8');
    expect(msgs.some((m) => /Domain violation: 'issues'/.test(m.message))).toBe(true);
  });

  it('range violation: nothing but is-a/part-of/supersedes may target a concept (e.g. implements)', () => {
    const input = withEntity(withConcepts(), 'fx-repository-a', {
      relations: [{ predicate: 'implements', target: 'fx-pid' }],
    });
    const msgs = errorsFor(input, 'I8');
    expect(msgs.some((m) => /Range violation: 'implements'/.test(m.message))).toBe(true);
  });

  it('part-of is sameTypeOnly: concept part-of concept ok, concept part-of organization rejected', () => {
    const ok = withEntity(withConcepts(), 'fx-persistent-doi', {
      relations: [{ predicate: 'is-a', target: 'fx-pid' }, { predicate: 'part-of', target: 'fx-pid' }],
    });
    expect(errorsFor(ok, 'I8')).toEqual([]);
    const bad = withEntity(withConcepts(), 'fx-persistent-doi', {
      relations: [{ predicate: 'is-a', target: 'fx-pid' }, { predicate: 'part-of', target: 'fx-organization' }],
    });
    expect(errorsFor(bad, 'I8').length).toBeGreaterThan(0);
  });

  it('is-a is acyclic (I10) and rejects self-loops (I4)', () => {
    const cyc = withEntity(withConcepts(), 'fx-pid', { relations: [{ predicate: 'is-a', target: 'fx-persistent-doi' }] });
    expect(errorsFor(cyc, 'I10')).toHaveLength(1);
    const self = withEntity(withConcepts(), 'fx-pid', { relations: [{ predicate: 'is-a', target: 'fx-pid' }] });
    expect(errorsFor(self, 'I4').length).toBeGreaterThan(0);
  });

  it('transitivity is not required: a -is-a-> b -is-a-> c needs no a -is-a-> c', () => {
    let input = withConcepts();
    input = addEntity(input, concept('fx-root', []));
    addProse(input, 'fx-root');
    input = withEntity(input, 'fx-pid', { relations: [{ predicate: 'is-a', target: 'fx-root' }] });
    expect(runValidation(input).errors).toEqual([]);
  });

  it('an authored inverse form (`includes`) is rejected by I7 with the canonical form named', () => {
    const input = withEntity(withConcepts(), 'fx-pid', { relations: [{ predicate: 'includes' as never, target: 'fx-identifier' }] });
    const msgs = errorsFor(input, 'I7');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/INVERSE label of 'is-a'/);
  });

  it('derives layer `concept` from type and counts it in stats', () => {
    const input = withConcepts();
    const entities: Entity[] = input.entityFiles.map((e) => e.entity);
    const index = buildIndex(entities, new Map(), input.predicatesVocab, input.entityTypesVocab);
    expect(index.byLayer.get('concept')).toEqual(['fx-persistent-doi', 'fx-pid']);
    expect(index.stats.byLayer.concept).toBe(2);
    expect(index.stats.byType.concept).toBe(2);
    expect(index.stats.byPredicate['is-a']).toBe(2);
    // every layer key is always present, even when empty
    const empty = buildIndex(freshInput().entityFiles.map((e) => e.entity), new Map(), input.predicatesVocab, input.entityTypesVocab);
    expect(Object.keys(empty.stats.byLayer).sort()).toEqual([...LAYERS].sort());
    expect(empty.stats.byLayer.concept).toBe(0);
  });

  it('a concept needs no owner/operator (I22/I33 do not apply) but still may not be an orphan (I11)', () => {
    const input = addEntity(withConcepts(), concept('fx-lonely'));
    input.proseFiles.push({ id: 'fx-lonely', locale: 'es', file: 'x', prose: { summary: 'Concepto ficticio sin relaciones, usado para ejercitar la regla de huérfanos.', body: '' } });
    const result = runValidation(input);
    expect(result.errors.filter((m) => m.ruleId === 'I11').map((m) => m.file)).toEqual(['src/content/entities/fx-lonely.yaml']);
    expect(result.messages.some((m) => m.ruleId === 'I33' && m.file.includes('fx-pid'))).toBe(false);
  });
});

describe('schema: concept, governance, prominence', () => {
  const base = {
    id: 'open-access',
    type: 'concept',
    name: 'Open access',
    url: 'https://en.wikipedia.org/wiki/Open_access',
    status: 'active',
    governance: 'not-applicable',
    tags: ['function:identification'],
    relations: [],
    sources: [SRC],
    lastReviewed: '2026-09-01',
  };

  it('parses a concept and rejects unknown extra types', () => {
    expect(zEntity.safeParse(base).success).toBe(true);
    expect(zEntity.safeParse({ ...base, type: 'idea' }).success).toBe(false);
  });

  it('accepts core | extended | detail and rejects anything else', () => {
    for (const p of ['core', 'extended', 'detail']) expect(zEntity.safeParse({ ...base, prominence: p }).success).toBe(true);
    expect(zEntity.safeParse({ ...base, prominence: 'huge' }).success).toBe(false);
  });

  it("prominence is optional and defaults to 'extended' via prominenceOf", () => {
    const parsed = zEntity.parse(base);
    expect((parsed as { prominence?: string }).prominence).toBeUndefined();
    expect(prominenceOf(parsed as Entity)).toBe('extended');
    expect(DEFAULT_PROMINENCE).toBe('extended');
    expect(prominenceOf({ prominence: 'core' })).toBe('core');
  });
});

describe('predicate families (I35)', () => {
  it('every predicate declares a known family; at most five families exist', () => {
    const input = freshInput();
    expect(input.predicateFamiliesVocab!.size).toBeLessThanOrEqual(5);
    for (const [id, def] of input.predicatesVocab) expect(input.predicateFamiliesVocab!.has(def.family), id).toBe(true);
    expect(runValidation(input).messages.filter((m) => m.ruleId === 'I35')).toEqual([]);
  });

  it('flags a predicate whose family is missing from the vocab', () => {
    const input = freshInput();
    input.predicatesVocab.set('issues', { ...input.predicatesVocab.get('issues')!, family: 'nope' as never });
    const msgs = runValidation(input).errors.filter((m) => m.ruleId === 'I35');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.field).toBe('issues');
  });
});

describe('REQUIRE_FULL_I18N (strict i18n mode)', () => {
  it('is ON by default (English parity reached, 2026-11)', () => {
    expect(REQUIRE_FULL_I18N).toBe(true);
    expect(resolveRequireFullI18n({})).toBe(true);
  });

  it('env override wins over the constant, both ways', () => {
    for (const on of ['1', 'true', 'TRUE', 'yes', 'on']) expect(resolveRequireFullI18n({ REQUIRE_FULL_I18N: on })).toBe(true);
    for (const off of ['0', 'false', 'no', 'off']) expect(resolveRequireFullI18n({ REQUIRE_FULL_I18N: off })).toBe(false);
    expect(resolveRequireFullI18n({ REQUIRE_FULL_I18N: '' })).toBe(REQUIRE_FULL_I18N);
  });

  it('lenient mode: a missing en description is one aggregated WARN, no ERROR', () => {
    const result = runValidation({ ...freshInput(), requireFullI18n: false });
    expect(result.errors.filter((m) => m.ruleId === 'I30')).toEqual([]);
    const warns = result.warnings.filter((m) => m.ruleId === 'I30');
    expect(warns).toHaveLength(1);
    expect(warns[0]!.message).toMatch(/^en: 3 of 14 entities untranslated/);
  });

  it('omitting the flag is lenient for programmatic callers (scripts/validate.ts passes the resolved policy)', () => {
    const input = freshInput();
    delete (input as Partial<ValidationInput>).requireFullI18n;
    expect(runValidation(input).errors).toEqual([]);
  });

  it('strict mode: each missing en description is its own ERROR on the entity file; no aggregated WARN', () => {
    const result = runValidation({ ...freshInput(), requireFullI18n: true });
    const errs = result.errors.filter((m) => m.ruleId === 'I30');
    expect(errs.map((m) => m.file).sort()).toEqual([
      'src/content/entities/fx-coalition.yaml',
      'src/content/entities/fx-community.yaml',
      'src/content/entities/fx-standard-old.yaml',
    ]);
    expect(errs[0]!.message).toMatch(/no 'en' prose file/);
    expect(result.warnings.some((m) => m.ruleId === 'I30')).toBe(false);
  });

  it('strict mode is clean once every locale is complete', () => {
    const input = freshInput();
    const have = new Set(input.proseFiles.filter((p) => p.locale === 'en').map((p) => p.id));
    for (const e of input.entityFiles) {
      if (have.has(e.id)) continue;
      input.proseFiles.push({ id: e.id, locale: 'en', file: `src/content/i18n/en/${e.id}.yaml`, prose: { summary: 'English fixture summary long enough to satisfy the validator.', body: 'x' } });
    }
    const result = runValidation({ ...input, requireFullI18n: true });
    expect(result.errors).toEqual([]);
    expect(result.messages.some((m) => m.ruleId === 'I30')).toBe(false);
  });
});

describe('diagrams with zero and with some concept entities', () => {
  function indexFor(input: ValidationInput) {
    return buildIndex(input.entityFiles.map((e) => e.entity), new Map(), input.predicatesVocab, input.entityTypesVocab);
  }

  it('palette has a shape and fill for the concept layer/type', () => {
    expect(shapeForLayer('concept')).toBe('rounded');
    expect(wrapShape('rounded', 'n1', '"x"')).toBe('n1("x")');
    expect(TYPE_FILL.concept).toMatch(/^#[0-9a-f]{6}$/i);
    expect(classDefLine('concept')).toContain('classDef concept ');
  });

  it('layer stack, taxonomy, type map and model render without a concept row when there are none', () => {
    const input = freshInput();
    const index = indexFor(input);
    const stack = buildLayerStackDiagram(index, input.entityTypesVocab, 'en');
    expect(stack).not.toMatch(/concept/i);
    expect(describeLayerStack(index, input.entityTypesVocab, 'en').rows.some((r) => r.subjectName === 'Concepts')).toBe(false);
    expect(buildTaxonomyMindmap(index, input.entityTypesVocab, input.tagsVocab, 'es')).not.toMatch(/Conceptos/);
    expect(() => buildTypeMapDiagram(index, input.entityTypesVocab, 'concept', 'es')).not.toThrow();
  });

  it('...and label them correctly (ES and EN) when there are some', () => {
    const input = withConcepts();
    const index = indexFor(input);
    expect(buildLayerStackDiagram(index, input.entityTypesVocab, 'en')).toMatch(/subgraph layer_concept \["Concepts"\]/);
    expect(buildLayerStackDiagram(index, input.entityTypesVocab, 'es')).toMatch(/subgraph layer_concept \["Conceptos"\]/);
    expect(buildLayerStackDiagram(index, input.entityTypesVocab, 'en')).toMatch(/Concept \(2\)/);
    expect(describeLayerStack(index, input.entityTypesVocab, 'es').rows.some((r) => r.subjectName === 'Conceptos')).toBe(true);
    expect(buildTaxonomyMindmap(index, input.entityTypesVocab, input.tagsVocab, 'es')).toMatch(/Conceptos/);
    expect(describeTaxonomy(index, input.entityTypesVocab, input.tagsVocab, 'en').rows.some((r) => r.subjectName === 'Concept')).toBe(true);
    const typeMap = buildTypeMapDiagram(index, input.entityTypesVocab, 'concept', 'en');
    expect(typeMap).toContain('is a');
  });

  it('model ER diagram includes CONCEPT and the is-a edges', () => {
    const input = freshInput();
    const er = buildModelErDiagram(input.predicatesVocab);
    expect(er).toContain('CONCEPT { string id }');
    expect(er).toContain('IDENTIFIER }o--o{ CONCEPT : "is-a"');
    expect(er).toContain('CONCEPT }o--o{ CONCEPT : "part-of"');
    expect(er).not.toContain('CONCEPT }o--o{ ORGANIZATION : "part-of"');
    expect(describeModel(input.predicatesVocab, 'en').description).toMatch(/^13 types, 21 predicates/);
  });
});
