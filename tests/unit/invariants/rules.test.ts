import { describe, expect, it } from 'vitest';
import { runValidation } from '../../../src/lib/invariants/run.js';
import { addEntity, findEntity, freshInput, removeEntity, removeProse, withEntity, withProse, withView } from './helpers.js';
import type { Entity, PredicateId } from '../../../src/lib/model/types.js';

function hasError(messages: { ruleId: string; level: string }[], ruleId: string): boolean {
  return messages.some((m) => m.ruleId === ruleId && m.level === 'ERROR');
}
function hasWarn(messages: { ruleId: string; level: string }[], ruleId: string): boolean {
  return messages.some((m) => m.ruleId === ruleId && m.level === 'WARN');
}

describe('baseline fixture', () => {
  it('is clean apart from the one expected warning (I30, the deliberately-incomplete en locale)', () => {
    const result = runValidation(freshInput());
    expect(result.errors).toEqual([]);
    // I32 (no relations[].verified yet) and I33 (a handful of fixture
    // entities intentionally carry no operated-by/developed-by/governed-by)
    // are expected on this baseline fixture — it exercises structural
    // validity, not full governance-provenance completeness.
    expect(result.warnings.map((w) => w.ruleId).sort()).toEqual(['I30', 'I32', 'I32', 'I32', 'I32', 'I32', 'I33', 'I33', 'I33', 'I33']);
  });
});

describe('I1 — id format and filename stem', () => {
  it('rejects an id with invalid characters', () => {
    let input = freshInput();
    input = {
      ...input,
      entityFiles: input.entityFiles.map((e) => (e.id === 'fx-agency' ? { ...e, id: 'Bad_ID', file: 'src/content/entities/Bad_ID.md', entity: { ...e.entity, id: 'Bad_ID' } } : e)),
    };
    const result = runValidation(input);
    expect(hasError(result.messages, 'I1')).toBe(true);
  });

  it('rejects an id that does not match the filename stem', () => {
    let input = freshInput();
    input = {
      ...input,
      entityFiles: input.entityFiles.map((e) => (e.id === 'fx-agency' ? { ...e, file: 'src/content/entities/some-other-name.md' } : e)),
    };
    const result = runValidation(input);
    expect(hasError(result.messages, 'I1')).toBe(true);
  });
});

describe('I2 — unique id across all types', () => {
  it('flags two entity files claiming the same id', () => {
    const input = freshInput();
    const dup: Entity = { ...findEntity(input, 'fx-community').entity, id: 'fx-agency' } as Entity;
    const result = runValidation(addEntity(input, dup, 'src/content/entities/fx-agency-2.md'));
    expect(hasError(result.messages, 'I2')).toBe(true);
  });
});

describe('I3 — dangling references', () => {
  it('flags a relation target that does not resolve', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'issues', target: 'does-not-exist' }] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I3')).toBe(true);
  });
});

describe('I4 — no self-loops', () => {
  it('flags a relation targeting its own entity', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'issues', target: 'fx-agency' }] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I4')).toBe(true);
  });
});

describe('I5 — no duplicate triples', () => {
  it('flags the same (predicate, target) authored twice', () => {
    const input = withEntity(freshInput(), 'fx-agency', {
      relations: [
        { predicate: 'issues', target: 'fx-identifier' },
        { predicate: 'issues', target: 'fx-identifier' },
      ],
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I5')).toBe(true);
  });
});

describe('I6 — closed predicate vocabulary', () => {
  it('flags a predicate that is neither canonical nor a recognisable inverse form', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'completely-made-up' as PredicateId, target: 'fx-identifier' }] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I6')).toBe(true);
    expect(hasError(result.messages, 'I7')).toBe(false);
  });
});

describe('I7 — canonical direction only', () => {
  it('flags an inverse-label predicate and names the canonical form', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'implemented-by' as PredicateId, target: 'fx-identifier' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I7');
    expect(msg).toBeDefined();
    expect(msg!.hint).toContain('implements');
    expect(hasError(result.messages, 'I6')).toBe(false);
  });

  it('recognises the "owns" inverse of owned-by', () => {
    const input = withEntity(freshInput(), 'fx-index', {
      relations: [
        { predicate: 'owns' as PredicateId, target: 'fx-organization' },
        { predicate: 'indexes', target: 'fx-repository-a' },
      ],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I7');
    expect(msg?.hint).toContain('owned-by');
  });

  it('skips a blank inverse-label entry and falls back to the predicate id when label.en is absent', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'issued-by' as PredicateId, target: 'fx-identifier' }] });
    const predicatesVocab = new Map(input.predicatesVocab);
    const issues = predicatesVocab.get('issues')!;
    predicatesVocab.set('issues', { ...issues, label: { es: 'acuña' }, inverseLabel: { es: '', en: 'issued by' } });
    const result = runValidation({ ...input, predicatesVocab });
    const msg = result.messages.find((m) => m.ruleId === 'I7');
    expect(msg).toBeDefined();
    expect(msg!.hint).toContain("write 'issues'");
    expect(msg!.hint).toContain('entity that issues the target');
  });
});

describe('I8 — domain/range', () => {
  it('flags a domain violation and suggests an alternative', () => {
    // 'issues' domain is agency only; fx-repository-a is a repository.
    const input = withEntity(freshInput(), 'fx-repository-a', {
      relations: [
        { predicate: 'issues', target: 'fx-identifier' },
        { predicate: 'certified-by', target: 'fx-community' },
      ],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('Domain'));
    expect(msg).toBeDefined();
  });

  it('flags a range violation', () => {
    // 'issues' range is identifier only; fx-coalition is a coalition.
    const input = withEntity(freshInput(), 'fx-agency', {
      relations: [
        { predicate: 'issues', target: 'fx-coalition' },
        { predicate: 'member-of', target: 'fx-coalition' },
      ],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('Range'));
    expect(msg).toBeDefined();
  });

  it('flags a sameTypeOnly violation', () => {
    // part-of is sameTypeOnly; fx-repository-b (repository) -> fx-community (community).
    const input = withEntity(freshInput(), 'fx-repository-b', { relations: [{ predicate: 'part-of', target: 'fx-community' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('sameTypeOnly'));
    expect(msg).toBeDefined();
  });

  it('does not fire when the target is dangling (I3 already reported)', () => {
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'issues', target: 'ghost' }] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I8')).toBe(false);
  });

  it('offers no suggestion when no predicate satisfies the domain violation pair', () => {
    // 'issues' domain is agency-only; no domain-including-community predicate
    // has 'identifier' in its range (operated-by/developed-by's range was
    // widened to include agency/aggregator, but not community-domain +
    // identifier-range — this pair stays genuinely unsatisfiable).
    const input = withEntity(freshInput(), 'fx-community', {
      relations: [{ predicate: 'issues', target: 'fx-identifier' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('Domain'));
    expect(msg?.hint).toBe('See A.2 for the full predicate table.');
  });

  it('allows a crossTypePairs exception to sameTypeOnly (cris -> index)', () => {
    const input = withEntity(freshInput(), 'fx-cris', { relations: [{ predicate: 'interoperates-with', target: 'fx-index' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('sameTypeOnly'));
    expect(msg).toBeUndefined();
  });

  it('allows the crossTypePairs exception in either type order (index -> cris)', () => {
    const input = withEntity(freshInput(), 'fx-index', { relations: [{ predicate: 'interoperates-with', target: 'fx-cris' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('sameTypeOnly'));
    expect(msg).toBeUndefined();
  });

  it('offers no suggestion when no predicate satisfies the range violation pair', () => {
    // owned-by domain includes repository (ok); range is organization only.
    // No repository-domain predicate has 'index' in its range once
    // interoperates-with is excluded by its own sameTypeOnly rule.
    const input = withEntity(freshInput(), 'fx-repository-a', {
      relations: [{ predicate: 'owned-by', target: 'fx-index' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I8' && m.message.includes('Range'));
    expect(msg?.hint).toBe('See A.2 for the full predicate table.');
  });
});

describe('I9 — symmetric predicates authored once, on the smaller id', () => {
  it('flags authorship on the lexicographically larger id', () => {
    let input = freshInput();
    input = withEntity(input, 'fx-repository-a', { relations: input.entityFiles.find((e) => e.id === 'fx-repository-a')!.entity.relations.filter((r) => r.predicate !== 'interoperates-with') });
    input = withEntity(input, 'fx-repository-b', {
      relations: [
        ...input.entityFiles.find((e) => e.id === 'fx-repository-b')!.entity.relations,
        { predicate: 'interoperates-with', target: 'fx-repository-a' },
      ],
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I9')).toBe(true);
  });

  it('flags the pair being authored from both sides', () => {
    const input = withEntity(freshInput(), 'fx-repository-b', {
      relations: [
        ...freshInput().entityFiles.find((e) => e.id === 'fx-repository-b')!.entity.relations,
        { predicate: 'interoperates-with', target: 'fx-repository-a' },
      ],
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I9')).toBe(true);
  });
});

describe('I10 — acyclic predicates form a DAG', () => {
  it('flags a cycle and prints the path', () => {
    // part-of: fx-repository-b -> fx-repository-a (fixture). Add the reverse to create a cycle.
    const input = withEntity(freshInput(), 'fx-repository-a', {
      relations: [
        ...freshInput().entityFiles.find((e) => e.id === 'fx-repository-a')!.entity.relations,
        { predicate: 'part-of', target: 'fx-repository-b' },
      ],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I10');
    expect(msg).toBeDefined();
    expect(msg!.message).toContain('->');
  });
});

describe('I11 — no orphans', () => {
  it('flags an entity with no relations at all', () => {
    const community = findEntity(freshInput(), 'fx-community').entity;
    const orphan: Entity = { ...community, id: 'fx-orphan', relations: [] };
    const input = addEntity(freshInput(), orphan);
    const result = runValidation(input);
    expect(hasError(result.messages, 'I11')).toBe(true);
  });

  it('accepts an orphan explicitly marked isolated with a note', () => {
    const community = findEntity(freshInput(), 'fx-community').entity;
    const orphan: Entity = { ...community, id: 'fx-isolated-ok', relations: [], isolated: true, note: 'Deliberately unconnected for now.' };
    const input = addEntity(freshInput(), orphan);
    const result = runValidation(input);
    expect(hasError(result.messages, 'I11')).toBe(false);
  });

  it('still flags isolated: true without an explanatory note', () => {
    const community = findEntity(freshInput(), 'fx-community').entity;
    const orphan: Entity = { ...community, id: 'fx-isolated-no-note', relations: [], isolated: true };
    const input = addEntity(freshInput(), orphan);
    const result = runValidation(input);
    expect(hasError(result.messages, 'I11')).toBe(true);
  });
});

describe('I12 — every declared type and predicate is used', () => {
  it('flags a fully-covered graph as clean, and a gap when a type is removed', () => {
    const clean = runValidation(freshInput());
    expect(hasError(clean.messages, 'I12')).toBe(false);

    const input = removeEntity(freshInput(), 'fx-cris');
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I12' && m.field === 'cris');
    expect(msg).toBeDefined();
  });
});

describe('I13 — tags/disciplines/status in the closed vocab', () => {
  it('flags an undeclared tag', () => {
    const input = withEntity(freshInput(), 'fx-agency', { tags: ['not-a-real-tag'] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I13')).toBe(true);
  });

  it('flags an undeclared discipline but accepts a valid one in the same array', () => {
    const input = withEntity(freshInput(), 'fx-agency', { disciplines: ['social-sciences', 'not-a-real-discipline'] });
    const result = runValidation(input);
    const bad = result.messages.find((m) => m.ruleId === 'I13' && m.field === 'disciplines[1]');
    const good = result.messages.find((m) => m.ruleId === 'I13' && m.field === 'disciplines[0]');
    expect(bad).toBeDefined();
    expect(good).toBeUndefined();
  });

  it('flags an undeclared status', () => {
    const input = withEntity(freshInput(), 'fx-agency', { status: 'not-a-real-status' as Entity['status'] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I13' && m.field === 'status');
    expect(msg).toBeDefined();
  });
});

describe('I14 — summary shape', () => {
  it('flags a too-short summary', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { summary: 'Too short.' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I14')).toBe(true);
  });

  it('flags a too-long summary', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { summary: 'x'.repeat(250) });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I14')).toBe(true);
  });

  it('flags a multi-line summary', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { summary: `${'x'.repeat(45)}\nsecond line here` });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I14' && m.message.includes('multiple lines'));
    expect(msg).toBeDefined();
  });

  it('flags Markdown syntax in the summary', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { summary: `**${'x'.repeat(45)}**` });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I14' && m.message.includes('Markdown'));
    expect(msg).toBeDefined();
  });

  it('flags a summary identical to the name', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { summary: 'Fixture Agency', name: 'Fixture Agency' });
    // pad summary to pass the length check while keeping it equal to name after trim — use a 40+ char name instead.
    const longName = 'x'.repeat(45);
    const input2 = withProse(input, 'fx-agency', 'es', { summary: longName, name: longName });
    const result = runValidation(input2);
    const msg = result.messages.find((m) => m.ruleId === 'I14' && m.message.includes('identical'));
    expect(msg).toBeDefined();
  });
});

describe('I15 — sources and relation confidence', () => {
  it('flags zero sources (structurally possible even though Zod normally guarantees >=1)', () => {
    const input = withEntity(freshInput(), 'fx-agency', { sources: [] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I15' && m.field === 'sources');
    expect(msg).toBeDefined();
  });

  it('flags a non-https source url', () => {
    const input = withEntity(freshInput(), 'fx-agency', { sources: [{ url: 'http://example.org/insecure', accessed: '2026-09-01' }] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I15')).toBe(true);
  });

  it('flags a future accessed date', () => {
    const input = withEntity(freshInput(), 'fx-agency', { sources: [{ url: 'https://example.org/x', accessed: '2099-01-01' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I15' && m.field?.includes('accessed'));
    expect(msg).toBeDefined();
  });

  it('flags a non-asserted relation with no sources', () => {
    const input = withEntity(freshInput(), 'fx-agency', {
      relations: [{ predicate: 'issues', target: 'fx-identifier', confidence: 'inferred' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I15' && m.field?.includes('relations'));
    expect(msg).toBeDefined();
  });

  it('accepts a non-asserted relation that does carry a source', () => {
    const input = withEntity(freshInput(), 'fx-agency', {
      relations: [{ predicate: 'issues', target: 'fx-identifier', confidence: 'inferred', sources: [{ url: 'https://example.org/x', accessed: '2026-09-01' }] }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I15' && m.field?.includes('relations'));
    expect(msg).toBeUndefined();
  });
});

describe('I16 — open-source licensing', () => {
  it('flags open-source with neither spdx id nor note', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { codebase: 'open-source', note: undefined });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I16')).toBe(true);
  });

  it('flags an invalid spdx id', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { codebase: 'open-source', identifiers: { spdx: 'NOT-A-REAL-LICENSE' } });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I16' && m.field === 'identifiers.spdx');
    expect(msg).toBeDefined();
  });

  it('accepts open-source with a valid spdx id', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { codebase: 'open-source', identifiers: { spdx: 'MIT' } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I16')).toBe(false);
  });

  it('accepts open-source with an explanatory note instead of spdx', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { codebase: 'open-source', note: 'Licensed under a custom permissive licence, see repo.' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I16')).toBe(false);
  });
});

describe('I17 — url must be https', () => {
  it('flags an http url', () => {
    const input = withEntity(freshInput(), 'fx-agency', { url: 'http://example.org/fx-agency' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I17')).toBe(true);
  });
});

describe('I18 — external identifier formats', () => {
  it('flags a malformed ROR id', () => {
    const input = withEntity(freshInput(), 'fx-agency', { identifiers: { ror: 'not-a-ror' } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I18')).toBe(true);
  });

  it('accepts a well-formed ROR id', () => {
    const input = withEntity(freshInput(), 'fx-agency', { identifiers: { ror: '04wxnsj81' } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I18')).toBe(false);
  });
});

describe('I19 — owned-by targets a company', () => {
  it('flags owned-by targeting a non-organization', () => {
    const input = withEntity(freshInput(), 'fx-index', {
      relations: [
        { predicate: 'owned-by', target: 'fx-community' },
        { predicate: 'indexes', target: 'fx-repository-a' },
      ],
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I19')).toBe(true);
  });

  it('does not fire when the owned-by target is dangling (I3 already reported)', () => {
    const input = withEntity(freshInput(), 'fx-index', {
      relations: [
        { predicate: 'owned-by', target: 'ghost-parent' },
        { predicate: 'indexes', target: 'fx-repository-a' },
      ],
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I19')).toBe(false);
    expect(hasError(result.messages, 'I3')).toBe(true);
  });

  it('flags owned-by targeting an organization that is not orgKind: company', () => {
    let input = freshInput();
    input = withEntity(input, 'fx-organization', { orgKind: 'nonprofit' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I19')).toBe(true);
  });
});

describe('I20 — date validity', () => {
  it('flags a malformed partial date', () => {
    const input = withEntity(freshInput(), 'fx-agency', { since: '09-2026' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I20')).toBe(true);
  });

  it('flags a date more than a year in the future', () => {
    const input = withEntity(freshInput(), 'fx-agency', { since: '2099' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I20' && m.message.includes('future'));
    expect(msg).toBeDefined();
  });

  it('flags since after until on the entity', () => {
    const input = withEntity(freshInput(), 'fx-agency', { since: '2026', until: '2020' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I20' && m.field === 'since');
    expect(msg).toBeDefined();
  });

  it('flags since after until on a relation', () => {
    const input = withEntity(freshInput(), 'fx-agency', {
      relations: [{ predicate: 'issues', target: 'fx-identifier', since: '2026', until: '2020' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I20' && m.field?.includes('relations'));
    expect(msg).toBeDefined();
  });

  it('accepts a well-formed year-only date', () => {
    const input = withEntity(freshInput(), 'fx-agency', { since: '2020' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I20')).toBe(false);
  });

  it('accepts well-formed year-month and full dates', () => {
    const input = withEntity(freshInput(), 'fx-agency', { since: '2020-06', until: '2026-01-15' });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I20')).toBe(false);
  });
});

describe('I21 — typed EntityId fields resolve to the right type', () => {
  it('flags persistentIdScheme pointing at a non-identifier', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { persistentIdScheme: ['fx-community'] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I21' && m.field?.startsWith('persistentIdScheme'));
    expect(msg).toBeDefined();
  });

  it('flags persistentIdScheme pointing at a dangling id', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { persistentIdScheme: ['ghost-id'] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I21' && m.message.includes('does not resolve'));
    expect(msg).toBeDefined();
  });

  it('flags harvestProtocols pointing at a non-standard', () => {
    const input = withEntity(freshInput(), 'fx-aggregator', { harvestProtocols: ['fx-community'] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I21' && m.field?.startsWith('harvestProtocols'));
    expect(msg).toBeDefined();
  });

  it('flags markupStandard pointing at a non-standard', () => {
    const input = withEntity(freshInput(), 'fx-publishing-platform', { markupStandard: ['fx-community'] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I21' && m.field?.startsWith('markupStandard'));
    expect(msg).toBeDefined();
  });

  it('accepts a correctly typed persistentIdScheme', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { persistentIdScheme: ['fx-identifier'] });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I21')).toBe(false);
  });
});

describe('I22 — commercial governance requires owned-by or a note', () => {
  it('flags commercial governance with neither', () => {
    const input = withEntity(freshInput(), 'fx-index', { relations: [{ predicate: 'indexes', target: 'fx-repository-a' }] });
    // fx-index is already governance: commercial with an owned-by edge in the fixture; remove it and its note.
    const result = runValidation(withEntity(input, 'fx-index', { note: undefined }));
    expect(hasError(result.messages, 'I22')).toBe(true);
  });

  it('accepts commercial governance backed by a note (no owned-by edge)', () => {
    const input = withEntity(freshInput(), 'fx-index', {
      relations: [{ predicate: 'indexes', target: 'fx-repository-a' }],
      note: 'Top of chain for this fixture; ownership deliberately not modelled.',
    });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I22')).toBe(false);
  });
});

describe('I24/I25 — view queries resolve, and never to zero entities', () => {
  it('flags an explicit view entity that does not resolve', () => {
    const input = withView(freshInput(), 'fx-view-explicit', { query: { kind: 'explicit', entities: ['ghost'] } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I24')).toBe(true);
  });

  it('flags an unknown predicate in a predicate-kind view', () => {
    const input = withView(freshInput(), 'fx-view-predicate', { query: { kind: 'predicate', predicate: 'not-a-real-predicate' as never } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I24')).toBe(true);
  });

  it('flags an entities-kind query that resolves to nothing', () => {
    const input = withView(freshInput(), 'fx-view-entities', { query: { kind: 'entities', where: [{ type: 'policy', status: 'planned' }] } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I25')).toBe(true);
  });

  it('resolves a predicate-kind query to the expected target set', () => {
    const result = runValidation(freshInput());
    expect(hasError(result.messages, 'I25')).toBe(false);
  });

  it('matches an array-valued entity field (e.g. tags) via array-contains semantics', () => {
    const input = withView(freshInput(), 'fx-view-entities', { query: { kind: 'entities', where: [{ tags: 'function:registration' }] } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I25')).toBe(false);
  });

  it('matches when the query clause itself supplies an array of acceptable values', () => {
    const input = withView(freshInput(), 'fx-view-entities', { query: { kind: 'entities', where: [{ type: ['policy', 'coalition'] }] } });
    const result = runValidation(input);
    expect(hasError(result.messages, 'I25')).toBe(false);
  });
});

describe('I26 — freshness warning', () => {
  it('warns when lastReviewed is more than 18 months old', () => {
    const input = withEntity(freshInput(), 'fx-agency', { lastReviewed: '2020-01-01' });
    const result = runValidation(input);
    expect(hasWarn(result.messages, 'I26')).toBe(true);
  });

  it('does not warn for a recent review', () => {
    const result = runValidation(freshInput());
    expect(hasWarn(result.messages, 'I26')).toBe(false);
  });
});

describe('I27 — identifier with no inbound issues edge', () => {
  it('warns when an identifier has no inbound issues edge', () => {
    // Baseline: fx-agency --issues--> fx-identifier. Strip it so fx-identifier is unissued.
    const input = withEntity(freshInput(), 'fx-agency', { relations: [{ predicate: 'member-of', target: 'fx-coalition' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I27' && m.file.includes('fx-identifier'));
    expect(msg).toBeDefined();
  });

  it('does not warn once an issues edge exists (the baseline fixture)', () => {
    const result = runValidation(freshInput());
    const identifierWarning = result.messages.find((m) => m.ruleId === 'I27' && m.file.includes('fx-identifier'));
    expect(identifierWarning).toBeUndefined();
  });
});

describe('I28 — legibility budget and component count', () => {
  it('warns when a predicate exceeds maxOutDegree', () => {
    const input = withEntity(freshInput(), 'fx-policy', {
      relations: [
        { predicate: 'mandates', target: 'fx-standard' },
        { predicate: 'mandates', target: 'fx-identifier' },
        { predicate: 'mandates', target: 'fx-community' as never },
        { predicate: 'mandates', target: 'fx-coalition' as never },
        { predicate: 'mandates', target: 'fx-cris' as never },
        { predicate: 'mandates', target: 'fx-index' as never },
      ],
    });
    const result = runValidation(input);
    expect(hasWarn(result.messages, 'I28')).toBe(true);
  });

  it('warns when the graph has more than one weakly connected component', () => {
    const community = findEntity(freshInput(), 'fx-community').entity;
    const input = addEntity(freshInput(), { ...community, id: 'fx-isolated-component', relations: [], isolated: true, note: 'separate component' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I28' && m.message.includes('component'));
    expect(msg).toBeDefined();
  });
});

describe('I29 — default-locale prose is required', () => {
  it('flags an entity missing es prose', () => {
    const input = removeProse(freshInput(), 'fx-agency', 'es');
    const result = runValidation(input);
    expect(hasError(result.messages, 'I29')).toBe(true);
  });

  it('flags a view missing es prose', () => {
    const input = { ...freshInput(), viewProseFiles: freshInput().viewProseFiles.filter((p) => p.id !== 'fx-view-entities') };
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I29' && m.message.includes('view'));
    expect(msg).toBeDefined();
  });
});

describe('I30 — non-default-locale translation coverage and relationNotes', () => {
  it('warns with an aggregated per-locale count', () => {
    const result = runValidation(freshInput());
    const msg = result.messages.find((m) => m.ruleId === 'I30' && m.message.startsWith('en:'));
    expect(msg).toBeDefined();
  });

  it('flags a relationNotes key that does not resolve to an authored relation', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { relationNotes: { 'issues@nowhere': 'bad key' } });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I30' && m.level === 'ERROR');
    expect(msg).toBeDefined();
  });

  it('accepts a relationNotes key that does resolve', () => {
    const input = withProse(freshInput(), 'fx-agency', 'es', { relationNotes: { 'issues@fx-identifier': 'ok' } });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I30' && m.level === 'ERROR');
    expect(msg).toBeUndefined();
  });

  it('does not warn about a non-default locale once every entity is translated', () => {
    const input = freshInput();
    const esProse = input.proseFiles.filter((p) => p.locale === 'es');
    for (const p of esProse) {
      if (!input.proseFiles.some((q) => q.locale === 'en' && q.id === p.id)) {
        input.proseFiles.push({ ...p, locale: 'en' as never, file: p.file.replace('/es/', '/en/') });
      }
    }
    const result = runValidation(input);
    expect(result.messages.some((m) => m.ruleId === 'I30' && m.message.startsWith('en:'))).toBe(false);
  });

  it('truncates the missing-entity list past 10 with an ellipsis', () => {
    const input = freshInput();
    input.proseFiles = input.proseFiles.filter((p) => p.locale !== 'en'); // all 14 untranslated in en
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I30' && m.message.startsWith('en:'));
    expect(msg?.hint.endsWith('...')).toBe(true);
  });
});

describe('I31 — facts file body must be empty', () => {
  it('flags a non-empty body', () => {
    const input = freshInput();
    input.entityBodies.set('fx-agency', 'Some prose that should not be here.');
    const result = runValidation(input);
    expect(hasError(result.messages, 'I31')).toBe(true);
  });

  it('accepts an empty body', () => {
    const result = runValidation(freshInput());
    expect(hasError(result.messages, 'I31')).toBe(false);
  });
});

describe('I32 — governance relations should carry a verified provenance stamp', () => {
  it('warns when a governance-predicate edge has no verified field (the baseline fixture)', () => {
    const result = runValidation(freshInput());
    const msg = result.messages.find((m) => m.ruleId === 'I32' && m.file.includes('fx-index'));
    expect(msg).toBeDefined();
    expect(msg?.level).toBe('WARN');
  });

  it('does not warn once verified is present', () => {
    const input = withEntity(freshInput(), 'fx-index', {
      relations: [{ predicate: 'owned-by', target: 'fx-organization', verified: { date: '2026-09-04', url: 'https://example.org/source' } }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I32' && m.file.includes('fx-index'));
    expect(msg).toBeUndefined();
  });

  it('does not warn for non-governance predicates lacking verified', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { relations: [{ predicate: 'implements', target: 'fx-standard' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I32' && m.file.includes('fx-repository-a'));
    expect(msg).toBeUndefined();
  });
});

describe('I33 — completeness floor for who runs/builds/governs infrastructure', () => {
  it('warns when a repository has none of operated-by/developed-by/governed-by (the baseline fixture)', () => {
    const result = runValidation(freshInput());
    const msg = result.messages.find((m) => m.ruleId === 'I33' && m.file.includes('fx-repository-a'));
    expect(msg).toBeDefined();
    expect(msg?.level).toBe('WARN');
  });

  it('does not warn once one of the floor predicates is present', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', { relations: [{ predicate: 'operated-by', target: 'fx-organization' }] });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I33' && m.file.includes('fx-repository-a'));
    expect(msg).toBeUndefined();
  });

  it('applies a narrower floor (developed-by/governed-by only) to standard', () => {
    const result = runValidation(freshInput());
    const msg = result.messages.find((m) => m.ruleId === 'I33' && m.file.includes('fx-standard-old'));
    expect(msg?.message).toContain('developed-by, governed-by');
  });

  it('does not apply the floor to types outside its list (e.g. organization)', () => {
    const result = runValidation(freshInput());
    const msg = result.messages.find((m) => m.ruleId === 'I33' && m.file.includes('fx-organization'));
    expect(msg).toBeUndefined();
  });
});

describe('I34 — a note mentioning another entity by name with no relation between them', () => {
  it('warns when note text names another entity and no edge connects them', () => {
    // fx-repository-a has no direct edge (either direction) to fx-organization
    // in the baseline fixture.
    const input = withEntity(freshInput(), 'fx-repository-a', { note: 'Related in spirit to Fixture Organization, not otherwise modelled.' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.file.includes('fx-repository-a'));
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('fx-organization');
  });

  it('does not warn when a relation already connects the two entities', () => {
    // Baseline fixture already links fx-repository-a <-> fx-repository-b via interoperates-with.
    const input = withEntity(freshInput(), 'fx-repository-a', { note: 'See Fixture Repository B for the interoperable sibling.' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.file.includes('fx-repository-a'));
    expect(msg).toBeUndefined();
  });

  it('does not warn on a note mentioning no other entity by name', () => {
    const result = runValidation(freshInput());
    expect(result.messages.some((m) => m.ruleId === 'I34')).toBe(false);
  });

  it('matches on an aka alias, not just the canonical name; ignores an alias shorter than 3 chars', () => {
    let input = withEntity(freshInput(), 'fx-organization', { aka: ['FixOrg', 'FO'] });
    input = withEntity(input, 'fx-repository-a', { note: 'Sometimes referred to alongside FixOrg, not otherwise modelled.' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.file.includes('fx-repository-a'));
    expect(msg).toBeDefined();
    expect(msg?.message).toContain('fx-organization');
  });

  it('matches a mention inside relations[].note', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', {
      relations: [{ predicate: 'implements', target: 'fx-standard', note: 'Unrelated to Fixture Organization in practice.' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.field === 'relations[0].note');
    expect(msg).toBeDefined();
  });

  it('matches a mention inside sources[].note', () => {
    const input = withEntity(freshInput(), 'fx-repository-a', {
      sources: [{ url: 'https://example.org/fx-repository-a', accessed: '2026-09-01', note: 'Cross-checked against Fixture Organization records.' }],
    });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.field === 'sources[0].note');
    expect(msg).toBeDefined();
  });

  it('ignores an entity name shorter than 3 chars', () => {
    let input = withEntity(freshInput(), 'fx-organization', { name: 'Ab' });
    input = withEntity(input, 'fx-repository-a', { note: 'Nothing to do with Ab here.' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.file.includes('fx-repository-a'));
    expect(msg).toBeUndefined();
  });

  it('does not warn when connected via an edge authored in the other direction', () => {
    // fx-repository-a --implements--> fx-standard is authored on fx-repository-a;
    // a note on fx-standard naming fx-repository-a is still "connected" from
    // fx-standard's side of that same (asymmetric) edge.
    const input = withEntity(freshInput(), 'fx-standard', { note: 'Implemented by Fixture Repository A, among others.' });
    const result = runValidation(input);
    const msg = result.messages.find((m) => m.ruleId === 'I34' && m.file.includes('fx-standard.md'));
    expect(msg).toBeUndefined();
  });
});

describe('I23 — layer is never authored (structural, always empty)', () => {
  it('is a no-op placeholder that never reports anything', () => {
    const result = runValidation(freshInput());
    expect(result.messages.some((m) => m.ruleId === 'I23')).toBe(false);
  });
});
