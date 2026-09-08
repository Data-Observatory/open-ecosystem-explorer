// Pure content-model types (specs.md §5.1-5.6). No Astro/DOM/fs imports (rule A1).

import type { LocaleCode } from '../../i18n/locales.js';

/** Unique across ALL types. /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 2..64 chars, == filename stem. */
export type EntityId = string;

/** The 19 predicates of Appendix A.2. */
export type PredicateId =
  | 'issues'
  | 'implements'
  | 'complies-with'
  | 'depends-on'
  | 'interoperates-with'
  | 'owned-by'
  | 'governed-by'
  | 'operated-by'
  | 'developed-by'
  | 'funded-by'
  | 'member-of'
  | 'part-of'
  | 'supersedes'
  | 'profile-of'
  | 'indexes'
  | 'certified-by'
  | 'endorsed-by'
  | 'mandates'
  | 'applies-to';

export const PREDICATE_IDS: readonly PredicateId[] = [
  'issues',
  'implements',
  'complies-with',
  'depends-on',
  'interoperates-with',
  'owned-by',
  'governed-by',
  'operated-by',
  'developed-by',
  'funded-by',
  'member-of',
  'part-of',
  'supersedes',
  'profile-of',
  'indexes',
  'certified-by',
  'endorsed-by',
  'mandates',
  'applies-to',
];

/** Acyclic predicates per A.2 (also enforced from predicates.yaml at runtime, this is the static mirror). */
export const ACYCLIC_PREDICATES: ReadonlySet<PredicateId> = new Set([
  'owned-by',
  'member-of',
  'part-of',
  'supersedes',
  'profile-of',
]);

/** Symmetric predicates per A.2. */
export const SYMMETRIC_PREDICATES: ReadonlySet<PredicateId> = new Set(['interoperates-with']);

/**
 * M§2-M§6. Derived from `type`, never authored. `regional` is the memo's own
 * "capa regional": supra-institutional infrastructure operating across
 * institutions and countries — a scope, not a geographic tag (that is
 * `geography[]`).
 */
export type Layer = 'identifier' | 'agency' | 'index' | 'institutional-system' | 'regional';

export type CrossCuttingLayer = 'cross-cutting';

/** Definitions, subtype fields and examples per type: Appendix A.1. */
export type EntityType =
  | 'identifier'
  | 'agency'
  | 'index'
  | 'cris'
  | 'repository'
  | 'aggregator'
  | 'publishing-platform'
  | 'standard'
  | 'community'
  | 'coalition'
  | 'policy'
  | 'organization';

export const ENTITY_TYPES: readonly EntityType[] = [
  'identifier',
  'agency',
  'index',
  'cris',
  'repository',
  'aggregator',
  'publishing-platform',
  'standard',
  'community',
  'coalition',
  'policy',
  'organization',
];

/** Types that carry a derived `layer` (§5.1); the other five are cross-cutting. */
export const LAYERED_TYPES: ReadonlySet<EntityType> = new Set([
  'identifier',
  'agency',
  'index',
  'cris',
  'repository',
  'aggregator',
  'publishing-platform',
]);

export type Status = 'active' | 'deprecated' | 'superseded' | 'planned' | 'unknown';

export type Confidence = 'asserted' | 'reported' | 'inferred';

/** The memo's second question — "quien lo gobierna" [M§1]. Required on every entity. */
export type Governance =
  | 'commercial'
  | 'nonprofit'
  | 'community'
  | 'intergovernmental'
  | 'public-agency'
  | 'academic'
  | 'unknown';

/**
 * Separate from `governance`, which is what makes M§5's central distinction
 * ("contenido abierto no es lo mismo que infraestructura abierta") queryable.
 */
export type OutputLicence = 'open' | 'partly-open' | 'closed' | 'not-applicable';

export type Codebase = 'open-source' | 'proprietary' | 'mixed' | 'not-applicable';

export interface Source {
  url: string;
  title?: string;
  accessed: string; // ISO date
  note?: string;
}

/** Relation-level provenance (I32): distinct from `Relation.sources`, which
 *  gates on `confidence !== 'asserted'` (I15) — `verified` records that a
 *  specific edge was checked against a specific primary source on a
 *  specific date, independent of confidence, so a content audit can be
 *  scoped and tracked ("how many governance edges are unverified?") rather
 *  than re-derived from scratch each time. */
export interface RelationVerification {
  date: string; // YYYY-MM-DD
  url: string; // the primary source checked
}

export interface Relation {
  predicate: PredicateId; // canonical direction only (I7)
  target: EntityId; // must resolve (I3)
  note?: string; // <=140 chars — edge tooltip / table cell; translatable (§5.7)
  since?: string;
  until?: string; // YYYY | YYYY-MM | YYYY-MM-DD; `until` renders dashed + grey
  confidence?: Confidence; // default 'asserted'; otherwise >=1 source required (I15)
  sources?: Source[];
  verified?: RelationVerification; // WARN-gated by I32 on governance predicates
}

/** All optional; all format-validated against per-field regexes (I18). */
export interface ExternalIds {
  ror?: string;
  doi?: string;
  wikidata?: string;
  re3data?: string;
  fairsharing?: string;
  openaire?: string;
  spdx?: string;
  isni?: string;
}

/** THE FACTS FILE. Locale-independent in its entirety — see §5.7 and C10. */
export interface EntityBase {
  id: EntityId; // == filename stem
  type: EntityType; // layer is derived from this, never authored
  name: string; // 2..80 chars, official name; per-locale override allowed (§5.7)
  aka?: string[]; // aliases/acronyms, <=8, indexed for search
  url: string; // canonical https homepage
  identifiers?: ExternalIds;
  status: Status;
  governance: Governance; // governance REQUIRED — M§1
  outputLicence?: OutputLicence;
  codebase?: Codebase;
  since?: string;
  until?: string;
  tags: string[]; // >=1, from vocab/tags.yaml
  disciplines?: string[];
  geography?: string[]; // FORD; ISO 3166-1 alpha-2 / eu / latam / global
  relations: Relation[]; // outgoing, canonical direction only
  sources: Source[]; // >=1 (I15)
  lastReviewed: string; // YYYY-MM-DD
  isolated?: true; // explicit opt-out of the no-orphans rule (I11)
  note?: string; // used by I22 (governance:commercial with no owned-by) and I11 (isolated explanation)
}

export type IdentifiesKind = 'object' | 'person' | 'organization' | 'activity' | 'sample' | 'bibliographic';

export interface IdentifierEntity extends EntityBase {
  type: 'identifier';
  identifies: IdentifiesKind;
  isoStandard?: string;
  resolverUrl?: string;
}

export type RegistersKind = 'publication' | 'dataset' | 'software' | 'report' | 'platform' | 'sample' | 'person';
export type FeeModel = 'membership' | 'per-object' | 'free' | 'mixed' | 'unknown';

export interface AgencyEntity extends EntityBase {
  type: 'agency';
  registers: RegistersKind[];
  feeModel: FeeModel;
  consortiumModel?: boolean;
  waiverProgramme?: string;
}

export type IndexKind = 'bibliographic' | 'citation' | 'registry' | 'directory';
export type Selectivity = 'editorial-board' | 'algorithmic' | 'inclusive';
export type InclusionCriteria = 'published' | 'partially-published' | 'opaque';
export type BulkDownload = 'full' | 'partial' | 'none';

export interface IndexEntity extends EntityBase {
  type: 'index';
  indexKind: IndexKind;
  selectivity: Selectivity;
  inclusionCriteria: InclusionCriteria;
  bulkDownload: BulkDownload;
  coverageObjects?: string[];
  coverageLanguages?: string[];
  knownGaps?: string;
}

export type CrisKind = 'commercial' | 'open-source' | 'national';

export interface CrisEntity extends EntityBase {
  type: 'cris';
  crisKind: CrisKind;
}

export type RepositoryKind = 'software-platform' | 'hosted-service' | 'institutional-instance';
export type Certification = 'coretrustseal' | 'wds' | 'nestor-seal' | 'iso-16363' | 'none';
export type AccessModel = 'open' | 'restricted' | 'mixed' | 'embargoed';

export interface RepositoryEntity extends EntityBase {
  type: 'repository';
  repositoryKind: RepositoryKind;
  certifications?: Certification[];
  persistentIdScheme?: EntityId[]; // resolves to `identifier` entities (I21)
  accessModel?: AccessModel;
}

export type AggregatorKind = 'harvesting-network' | 'linking-service' | 'federation';
export type ObjectScope = 'article' | 'thesis' | 'dataset' | 'journal';

export interface AggregatorEntity extends EntityBase {
  type: 'aggregator';
  aggregatorKind: AggregatorKind;
  harvestProtocols?: EntityId[]; // resolves to `standard` entities (I21)
  memberCountries?: string[];
  objectScope?: ObjectScope[];
  recordCount?: number; // requires a dated source
}

export type PlatformKind = 'journal-programme' | 'preprint-server' | 'books-programme';

export interface PublishingPlatformEntity extends EntityBase {
  type: 'publishing-platform';
  platformKind: PlatformKind;
  fullTextHosted: boolean;
  admissionCriteria: InclusionCriteria;
  markupStandard?: EntityId[]; // resolves to `standard` entities (I21)
  nationalCollections?: string[];
  titleCount?: number; // requires a dated source
}

export type StandardKind =
  | 'principles'
  | 'metadata-schema'
  | 'protocol'
  | 'certification-criteria'
  | 'framework'
  | 'governance-criteria'
  | 'serialisation';

export interface StandardEntity extends EntityBase {
  type: 'standard';
  standardKind: StandardKind;
  specVersion?: string;
  specUrl?: string;
  machineReadable?: boolean;
  requiresOpenness?: boolean; // false for FAIR — the memo's central political point
}

export type CommunityKind = 'standards-body' | 'technical-community' | 'certification-body' | 'confederation';

export interface CommunityEntity extends EntityBase {
  type: 'community';
  communityKind: CommunityKind;
  openMembership?: boolean;
  nationalChapters?: string[];
}

export type CoalitionKind = 'declaration' | 'reform-movement' | 'funding-initiative' | 'network';

export interface CoalitionEntity extends EntityBase {
  type: 'coalition';
  coalitionKind: CoalitionKind;
  signatoryCount?: number;
  workingGroups?: string[];
}

export type PolicyKind = 'law' | 'mandate' | 'guideline' | 'funder-requirement' | 'strategy' | 'recommendation';
export type Bindingness = 'binding' | 'conditional' | 'advisory';

export interface PolicyEntity extends EntityBase {
  type: 'policy';
  policyKind: PolicyKind;
  jurisdiction: string[];
  bindingness: Bindingness;
  effectiveDate?: string;
}

export type OrgKind =
  | 'company'
  | 'nonprofit'
  | 'foundation'
  | 'university'
  | 'research-institute'
  | 'government-agency'
  | 'intergovernmental'
  | 'library';

export interface OrganizationEntity extends EntityBase {
  type: 'organization';
  orgKind: OrgKind;
  country?: string; // ISO 3166-1 alpha-2
}

export type Entity =
  | IdentifierEntity
  | AgencyEntity
  | IndexEntity
  | CrisEntity
  | RepositoryEntity
  | AggregatorEntity
  | PublishingPlatformEntity
  | StandardEntity
  | CommunityEntity
  | CoalitionEntity
  | PolicyEntity
  | OrganizationEntity;

// --- Predicate metadata (§5.3, A.2) -----------------------------------------

export type LocaleMap = Partial<Record<LocaleCode, string>>;

export interface PredicateDef {
  id: PredicateId;
  label: LocaleMap; // active voice, drawn on the edge
  inverseLabel: LocaleMap; // passive, shown on the target's page
  domain: EntityType[];
  range: EntityType[];
  symmetric: boolean;
  acyclic: boolean;
  sameTypeOnly: boolean;
  // Constrained escape hatch from sameTypeOnly: unordered (order-insensitive)
  // cross-type pairs allowed in addition to same-type pairs, when
  // sameTypeOnly is true. Kept narrow and explicit per pair — not a general
  // range override — so I8 still catches genuine typos.
  crossTypePairs?: [EntityType, EntityType][];
  maxOutDegree?: number; // soft cap; exceeded => diagram collapses to a cluster node
  style: { color: string; line: 'solid' | 'dashed' | 'thick'; arrow: 'open' | 'closed' };
}

// --- The derived index (§5.4) ------------------------------------------------

export interface GraphEdge {
  from: EntityId;
  to: EntityId;
  predicate: PredicateId;
  note?: string;
  since?: string;
  until?: string;
  confidence: Confidence;
  sources: Source[];
  derived: boolean; // true only on the synthesised inverse view
}

export interface EntityStats {
  entityCount: number;
  edgeCount: number;
  maxDegree: number;
  generatedAt: string;
  byType: Record<EntityType, number>;
  byLayer: Record<Layer | CrossCuttingLayer, number>;
  byPredicate: Record<PredicateId, number>;
  orphans: readonly EntityId[];
  translationCoverage: Record<LocaleCode, { present: number; missing: readonly EntityId[] }>;
}

export interface ResolvedProse {
  summary: string;
  name?: string;
  aka?: string[];
  relationNotes?: Record<string, string>;
  body: string;
}

export interface GraphIndex {
  entities: ReadonlyMap<EntityId, Entity>;
  byType: ReadonlyMap<EntityType, readonly EntityId[]>;
  byLayer: ReadonlyMap<Layer | CrossCuttingLayer, readonly EntityId[]>;
  edges: readonly GraphEdge[];
  outgoing: ReadonlyMap<EntityId, readonly GraphEdge[]>;
  incoming: ReadonlyMap<EntityId, readonly GraphEdge[]>;
  degree: ReadonlyMap<EntityId, { in: number; out: number }>;
  predicates: ReadonlyMap<PredicateId, PredicateDef>;
  components: readonly (readonly EntityId[])[];
  prose: ReadonlyMap<LocaleCode, ReadonlyMap<EntityId, ResolvedProse>>;
  stats: EntityStats;
}

// --- Views: the memo's five fault lines as saved queries (§5.6) -------------

export type ViewQuery =
  | { kind: 'entities'; where: Record<string, string | string[]>[] }
  | { kind: 'predicate'; predicate: PredicateId; groupBy?: 'target' | 'source' }
  | { kind: 'explicit'; entities: EntityId[] };

export interface View {
  id: string;
  query: ViewQuery;
  render: 'diagram' | 'table' | 'both';
  sources: Source[];
  lastReviewed: string;
}

// --- i18n prose files (§5.7) -------------------------------------------------

export interface ProseFile {
  summary: string; // 40-200 chars (I14)
  name?: string;
  aka?: string[];
  relationNotes?: Record<string, string>; // "<predicate>@<target>" -> note (I30)
  body: string; // Markdown body
}

export interface ViewProseFile {
  title: string;
  question: string; // <=200 chars
  body: string;
}
