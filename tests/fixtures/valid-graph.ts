// A synthetic graph covering all 12 entity types and all 19 original predicates (is-a and related-to are exercised in concept-and-modes.test.ts)
// (specs.md §11 "Fixtures"). Two locales; `en` is deliberately incomplete
// (three entities untranslated) to exercise I30/translationCoverage.
import type { Entity, ProseFile, ViewProseFile } from '../../src/lib/model/types.js';
import type {
	EntityFileEntry,
	ProseFileEntry,
	ViewFileEntry,
	ViewProseFileEntry
} from '../../src/lib/invariants/types.js';
import { loadRealVocab } from './load-real-vocab.js';

const SRC = { url: 'https://example.org/source', accessed: '2026-09-01' };

function file(id: string): string {
	return `src/content/entities/${id}.yaml`;
}

export const entities: Entity[] = [
	{
		id: 'fx-agency',
		type: 'agency',
		name: 'Fixture Agency',
		url: 'https://example.org/fx-agency',
		status: 'active',
		governance: 'nonprofit',
		tags: ['function:registration'],
		relations: [
			{ predicate: 'issues', target: 'fx-identifier' },
			{ predicate: 'member-of', target: 'fx-coalition' }
		],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		registers: ['dataset'],
		feeModel: 'membership'
	},
	{
		id: 'fx-identifier',
		type: 'identifier',
		name: 'Fixture Identifier',
		url: 'https://example.org/fx-identifier',
		status: 'active',
		governance: 'nonprofit',
		tags: ['function:identification'],
		relations: [{ predicate: 'depends-on', target: 'fx-repository-a' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		identifies: 'object'
	},
	{
		id: 'fx-standard',
		type: 'standard',
		name: 'Fixture Standard',
		url: 'https://example.org/fx-standard',
		status: 'active',
		governance: 'nonprofit',
		tags: ['function:registration'],
		relations: [
			{ predicate: 'governed-by', target: 'fx-community' },
			{ predicate: 'supersedes', target: 'fx-standard-old' },
			{ predicate: 'profile-of', target: 'fx-standard-old' }
		],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		standardKind: 'metadata-schema'
	},
	{
		id: 'fx-standard-old',
		type: 'standard',
		name: 'Fixture Standard (old)',
		url: 'https://example.org/fx-standard-old',
		status: 'superseded',
		governance: 'nonprofit',
		tags: ['function:registration'],
		relations: [],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		standardKind: 'metadata-schema'
	},
	{
		id: 'fx-repository-a',
		type: 'repository',
		name: 'Fixture Repository A',
		url: 'https://example.org/fx-repository-a',
		status: 'active',
		governance: 'academic',
		tags: ['function:deposit'],
		relations: [
			{ predicate: 'implements', target: 'fx-standard' },
			{ predicate: 'interoperates-with', target: 'fx-repository-b' },
			{ predicate: 'certified-by', target: 'fx-community' }
		],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		repositoryKind: 'institutional-instance'
	},
	{
		id: 'fx-repository-b',
		type: 'repository',
		name: 'Fixture Repository B',
		url: 'https://example.org/fx-repository-b',
		status: 'active',
		governance: 'academic',
		tags: ['function:deposit'],
		relations: [{ predicate: 'part-of', target: 'fx-repository-a' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		repositoryKind: 'institutional-instance'
	},
	{
		id: 'fx-cris',
		type: 'cris',
		name: 'Fixture CRIS',
		url: 'https://example.org/fx-cris',
		status: 'active',
		governance: 'academic',
		tags: ['function:registration'],
		relations: [{ predicate: 'complies-with', target: 'fx-policy' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		crisKind: 'open-source'
	},
	{
		id: 'fx-index',
		type: 'index',
		name: 'Fixture Index',
		url: 'https://example.org/fx-index',
		status: 'active',
		governance: 'commercial',
		outputLicence: 'partly-open',
		codebase: 'proprietary',
		tags: ['function:indexing'],
		relations: [
			{ predicate: 'owned-by', target: 'fx-organization' },
			{ predicate: 'indexes', target: 'fx-repository-a' }
		],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		indexKind: 'registry',
		selectivity: 'inclusive',
		inclusionCriteria: 'opaque',
		bulkDownload: 'none'
	},
	{
		id: 'fx-aggregator',
		type: 'aggregator',
		name: 'Fixture Aggregator',
		url: 'https://example.org/fx-aggregator',
		status: 'active',
		governance: 'intergovernmental',
		tags: ['function:aggregation'],
		relations: [{ predicate: 'operated-by', target: 'fx-organization' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		aggregatorKind: 'harvesting-network'
	},
	{
		id: 'fx-publishing-platform',
		type: 'publishing-platform',
		name: 'Fixture Publishing Platform',
		url: 'https://example.org/fx-publishing-platform',
		status: 'active',
		governance: 'nonprofit',
		tags: ['function:publishing'],
		relations: [{ predicate: 'developed-by', target: 'fx-organization' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		platformKind: 'journal-programme',
		fullTextHosted: true,
		admissionCriteria: 'published'
	},
	{
		id: 'fx-organization',
		type: 'organization',
		name: 'Fixture Organization',
		url: 'https://example.org/fx-organization',
		status: 'active',
		governance: 'commercial',
		tags: ['theme:vertical-integration'],
		note: 'Top of the fixture ownership chain; no further parent modelled.',
		relations: [],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		orgKind: 'company'
	},
	{
		id: 'fx-community',
		type: 'community',
		name: 'Fixture Community',
		url: 'https://example.org/fx-community',
		status: 'active',
		governance: 'community',
		tags: ['function:certification'],
		relations: [],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		communityKind: 'standards-body'
	},
	{
		id: 'fx-coalition',
		type: 'coalition',
		name: 'Fixture Coalition',
		url: 'https://example.org/fx-coalition',
		status: 'active',
		governance: 'community',
		tags: ['theme:exit-cost'],
		relations: [{ predicate: 'funded-by', target: 'fx-organization' }],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		coalitionKind: 'network'
	},
	{
		id: 'fx-policy',
		type: 'policy',
		name: 'Fixture Policy',
		url: 'https://example.org/fx-policy',
		status: 'active',
		governance: 'public-agency',
		tags: ['theme:coverage-bias'],
		relations: [
			{ predicate: 'endorsed-by', target: 'fx-coalition' },
			{ predicate: 'mandates', target: 'fx-standard' },
			{ predicate: 'applies-to', target: 'fx-cris' }
		],
		sources: [SRC],
		lastReviewed: '2026-09-01',
		policyKind: 'guideline',
		jurisdiction: ['global'],
		bindingness: 'advisory'
	}
];

export const entityFiles: EntityFileEntry[] = entities.map((entity) => ({
	id: entity.id,
	file: file(entity.id),
	entity
}));

export const entityProseFields = new Map<string, string[]>(entities.map((e) => [e.id, []]));

function prose(summary: string): ProseFile {
	return { summary, body: `Body prose for ${summary.slice(0, 20)}.` };
}

const esSummaries: Record<string, string> = {
	'fx-agency':
		'Agencia ficticia usada solo para ejercitar el esquema de validación en las pruebas unitarias.',
	'fx-identifier':
		'Identificador ficticio usado solo para ejercitar el esquema de validación en las pruebas.',
	'fx-standard':
		'Estándar ficticio usado únicamente para ejercitar el esquema de validación en las pruebas.',
	'fx-standard-old':
		'Versión anterior ficticia del estándar, usada para ejercitar el predicado supersedes.',
	'fx-repository-a':
		'Repositorio ficticio A, usado para ejercitar relaciones simétricas y de contención.',
	'fx-repository-b':
		'Repositorio ficticio B, usado para ejercitar relaciones simétricas y de contención.',
	'fx-cris':
		'CRIS ficticio usado solo para ejercitar el esquema de validación en las pruebas unitarias.',
	'fx-index':
		'Índice ficticio usado para ejercitar owned-by y la excepción por gobernanza comercial.',
	'fx-aggregator':
		'Agregador ficticio usado solo para ejercitar el esquema de validación en las pruebas.',
	'fx-publishing-platform':
		'Plataforma editorial ficticia usada para ejercitar developed-by en las pruebas.',
	'fx-organization':
		'Organización ficticia, receptora de varias relaciones de propiedad y operación de prueba.',
	'fx-community':
		'Comunidad ficticia usada solo para ejercitar el esquema de validación en las pruebas.',
	'fx-coalition':
		'Coalición ficticia usada solo para ejercitar el esquema de validación en las pruebas.',
	'fx-policy':
		'Política ficticia usada para ejercitar mandates, applies-to y endorsed-by en las pruebas.'
};

export const proseFiles: ProseFileEntry[] = [];
for (const [id, summary] of Object.entries(esSummaries)) {
	proseFiles.push({
		id,
		locale: 'es',
		file: `src/content/i18n/es/${id}.yaml`,
		prose: prose(summary)
	});
}
// `en` deliberately incomplete: three entities left untranslated.
const untranslatedInEnglish = new Set(['fx-standard-old', 'fx-community', 'fx-coalition']);
for (const [id, summary] of Object.entries(esSummaries)) {
	if (untranslatedInEnglish.has(id)) continue;
	proseFiles.push({
		id,
		locale: 'en',
		file: `src/content/i18n/en/${id}.yaml`,
		prose: prose(`English fixture summary for ${summary.length} chars of Spanish source text.`)
	});
}

export const viewFiles: ViewFileEntry[] = [
	{
		id: 'fx-view-entities',
		file: 'src/content/views/fx-view-entities.yaml',
		view: {
			id: 'fx-view-entities',
			query: { kind: 'entities', where: [{ governance: 'commercial' }] },
			sources: [SRC],
			lastReviewed: '2026-09-01'
		}
	},
	{
		id: 'fx-view-predicate',
		file: 'src/content/views/fx-view-predicate.yaml',
		view: {
			id: 'fx-view-predicate',
			query: { kind: 'predicate', predicate: 'owned-by', groupBy: 'target' },
			sources: [SRC],
			lastReviewed: '2026-09-01'
		}
	},
	{
		id: 'fx-view-explicit',
		file: 'src/content/views/fx-view-explicit.yaml',
		view: {
			id: 'fx-view-explicit',
			query: { kind: 'explicit', entities: ['fx-agency', 'fx-coalition'] },
			sources: [SRC],
			lastReviewed: '2026-09-01'
		}
	}
];

function viewProse(title: string): ViewProseFile {
	return { title, question: `What does ${title} answer?`, body: `Body for ${title}.` };
}

export const viewProseFiles: ViewProseFileEntry[] = viewFiles.map((v) => ({
	id: v.id,
	locale: 'es',
	file: `src/content/i18n/es/views/${v.id}.yaml`,
	prose: viewProse(v.id)
}));

export function buildFixtureInput() {
	const vocab = loadRealVocab();
	// The synthetic graph has no concept entities (those tests build their own),
	// so the real vocab's `concept`/`is-a`/`related-to` entries are marked pending
	// here; the real content populates them, which is what I12 enforces there.
	const typeEntry = vocab.entityTypesVocab.get('concept');
	if (typeEntry) typeEntry.pending = true;
	for (const id of ['is-a', 'related-to'] as const) {
		const def = vocab.predicatesVocab.get(id);
		if (def) def.pending = true;
	}
	return {
		entityFiles,
		entityProseFields,
		proseFiles,
		viewFiles,
		viewProseFiles,
		...vocab,
		locales: ['es', 'en'] as const,
		defaultLocale: 'es' as const,
		now: new Date('2026-09-03T00:00:00Z')
	};
}
