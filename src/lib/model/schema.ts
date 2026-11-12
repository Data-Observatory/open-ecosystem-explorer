// Zod mirror of types.ts (specs.md §5). ONE definition, imported by both
// scripts/validate.ts and src/content.config.ts — never redefined twice.
import { z } from 'zod';
import { PREDICATE_IDS, PROMINENCE_LEVELS, PREDICATE_FAMILY_IDS, type PredicateId, type Prominence, type PredicateFamilyId } from './types.js';

const isoDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'must be YYYY, YYYY-MM or YYYY-MM-DD');
const fullIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const httpsUrl = z.string().url().startsWith('https://', 'must be an https:// URL');
const entityId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be lowercase kebab-case, 2-64 chars')
  .min(2)
  .max(64);

export const zSource = z.object({
  url: httpsUrl,
  title: z.string().optional(),
  accessed: fullIsoDate,
  note: z.string().optional(),
});

export const zPredicateId = z.enum(PREDICATE_IDS as [PredicateId, ...PredicateId[]]);

export const zProminence = z.enum(PROMINENCE_LEVELS as [Prominence, ...Prominence[]]);

export const zConfidence = z.enum(['asserted', 'reported', 'inferred']);

// Deliberately loose (not zPredicateId): I6/I7 in invariants own predicate
// validation so an unknown or inverse-form predicate gets a rich, actionable
// message instead of a raw Zod enum rejection (§8.4b).
export const zRelationVerification = z.object({
  date: fullIsoDate,
  url: httpsUrl,
});

export const zRelation = z.object({
  predicate: z.string().min(1),
  target: entityId,
  note: z.string().max(140).optional(),
  since: isoDate.optional(),
  until: isoDate.optional(),
  confidence: zConfidence.optional(),
  sources: z.array(zSource).optional(),
  verified: zRelationVerification.optional(),
});

export const zExternalIds = z
  .object({
    ror: z.string().regex(/^0[a-z0-9]{6}\d{2}$/, 'invalid ROR id').optional(),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/, 'invalid DOI').optional(),
    wikidata: z.string().regex(/^Q\d+$/, 'invalid Wikidata QID').optional(),
    re3data: z.string().regex(/^r3d\d+$/, 'invalid re3data id').optional(),
    fairsharing: z.string().optional(),
    openaire: z.string().optional(),
    spdx: z.string().optional(),
    isni: z.string().regex(/^\d{4} \d{4} \d{4} \d{3}[\dX]$/, 'invalid ISNI').optional(),
  })
  .strict();

export const zStatus = z.enum(['active', 'deprecated', 'superseded', 'planned', 'unknown']);
export const zGovernance = z.enum([
  'commercial',
  'nonprofit',
  'community',
  'intergovernmental',
  'public-agency',
  'academic',
  'unknown',
  'not-applicable',
]);
export const zOutputLicence = z.enum(['open', 'partly-open', 'closed', 'not-applicable']);
export const zCodebase = z.enum(['open-source', 'proprietary', 'mixed', 'not-applicable']);

const entityBaseShape = {
  id: entityId,
  name: z.string().min(2).max(80),
  aka: z.array(z.string()).max(8).optional(),
  url: httpsUrl,
  identifiers: zExternalIds.optional(),
  status: zStatus,
  governance: zGovernance,
  outputLicence: zOutputLicence.optional(),
  codebase: zCodebase.optional(),
  since: isoDate.optional(),
  until: isoDate.optional(),
  prominence: zProminence.optional(),
  tags: z.array(z.string()).min(1),
  disciplines: z.array(z.string()).optional(),
  geography: z.array(z.string()).optional(),
  relations: z.array(zRelation),
  sources: z.array(zSource).min(1),
  lastReviewed: fullIsoDate,
  isolated: z.literal(true).optional(),
  note: z.string().optional(),
};

const zIdentifierEntity = z.object({
  ...entityBaseShape,
  type: z.literal('identifier'),
  identifies: z.enum(['object', 'person', 'organization', 'activity', 'sample', 'bibliographic']),
  isoStandard: z.string().optional(),
  resolverUrl: httpsUrl.optional(),
});

const zAgencyEntity = z.object({
  ...entityBaseShape,
  type: z.literal('agency'),
  registers: z.array(z.enum(['publication', 'dataset', 'software', 'report', 'platform', 'sample', 'person'])).min(1),
  feeModel: z.enum(['membership', 'per-object', 'free', 'mixed', 'unknown']),
  consortiumModel: z.boolean().optional(),
  waiverProgramme: z.string().optional(),
});

const zIndexEntity = z.object({
  ...entityBaseShape,
  type: z.literal('index'),
  indexKind: z.enum(['bibliographic', 'citation', 'registry', 'directory']),
  selectivity: z.enum(['editorial-board', 'algorithmic', 'inclusive']),
  inclusionCriteria: z.enum(['published', 'partially-published', 'opaque']),
  bulkDownload: z.enum(['full', 'partial', 'none']),
  coverageObjects: z.array(z.string()).optional(),
  coverageLanguages: z.array(z.string()).optional(),
  knownGaps: z.string().max(200).optional(),
});

const zCrisEntity = z.object({
  ...entityBaseShape,
  type: z.literal('cris'),
  crisKind: z.enum(['commercial', 'open-source', 'national']),
});

const zRepositoryEntity = z.object({
  ...entityBaseShape,
  type: z.literal('repository'),
  repositoryKind: z.enum(['software-platform', 'hosted-service', 'institutional-instance']),
  certifications: z.array(z.enum(['coretrustseal', 'wds', 'nestor-seal', 'iso-16363', 'none'])).optional(),
  persistentIdScheme: z.array(entityId).optional(),
  accessModel: z.enum(['open', 'restricted', 'mixed', 'embargoed']).optional(),
});

const zAggregatorEntity = z.object({
  ...entityBaseShape,
  type: z.literal('aggregator'),
  aggregatorKind: z.enum(['harvesting-network', 'linking-service', 'federation']),
  harvestProtocols: z.array(entityId).optional(),
  memberCountries: z.array(z.string()).optional(),
  objectScope: z.array(z.enum(['article', 'thesis', 'dataset', 'journal'])).optional(),
  recordCount: z.number().nonnegative().optional(),
});

const zPublishingPlatformEntity = z.object({
  ...entityBaseShape,
  type: z.literal('publishing-platform'),
  platformKind: z.enum(['journal-programme', 'preprint-server', 'books-programme']),
  fullTextHosted: z.boolean(),
  admissionCriteria: z.enum(['published', 'partially-published', 'opaque']),
  markupStandard: z.array(entityId).optional(),
  nationalCollections: z.array(z.string()).optional(),
  titleCount: z.number().nonnegative().optional(),
});

const zStandardEntity = z.object({
  ...entityBaseShape,
  type: z.literal('standard'),
  standardKind: z.enum([
    'principles',
    'metadata-schema',
    'protocol',
    'certification-criteria',
    'framework',
    'governance-criteria',
    'serialisation',
  ]),
  specVersion: z.string().optional(),
  specUrl: httpsUrl.optional(),
  machineReadable: z.boolean().optional(),
  requiresOpenness: z.boolean().optional(),
});

const zCommunityEntity = z.object({
  ...entityBaseShape,
  type: z.literal('community'),
  communityKind: z.enum(['standards-body', 'technical-community', 'certification-body', 'confederation']),
  openMembership: z.boolean().optional(),
  nationalChapters: z.array(z.string()).optional(),
});

const zCoalitionEntity = z.object({
  ...entityBaseShape,
  type: z.literal('coalition'),
  coalitionKind: z.enum(['declaration', 'reform-movement', 'funding-initiative', 'network']),
  signatoryCount: z.number().nonnegative().optional(),
  workingGroups: z.array(z.string()).optional(),
});

const zPolicyEntity = z.object({
  ...entityBaseShape,
  type: z.literal('policy'),
  policyKind: z.enum(['law', 'mandate', 'guideline', 'funder-requirement', 'strategy', 'recommendation']),
  jurisdiction: z.array(z.string()).min(1),
  bindingness: z.enum(['binding', 'conditional', 'advisory']),
  effectiveDate: isoDate.optional(),
});

const zOrganizationEntity = z.object({
  ...entityBaseShape,
  type: z.literal('organization'),
  orgKind: z.enum([
    'company',
    'nonprofit',
    'foundation',
    'university',
    'research-institute',
    'government-agency',
    'intergovernmental',
    'library',
  ]),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, 'must be ISO 3166-1 alpha-2')
    .optional(),
});

const zConceptEntity = z.object({
  ...entityBaseShape,
  type: z.literal('concept'),
});

export const zEntity = z.discriminatedUnion('type', [
  zIdentifierEntity,
  zAgencyEntity,
  zIndexEntity,
  zCrisEntity,
  zRepositoryEntity,
  zAggregatorEntity,
  zPublishingPlatformEntity,
  zStandardEntity,
  zCommunityEntity,
  zCoalitionEntity,
  zPolicyEntity,
  zOrganizationEntity,
  zConceptEntity,
]);

export type ZEntity = z.infer<typeof zEntity>;

// --- i18n prose files (§5.7) -------------------------------------------------

export const zProseFile = z.object({
  summary: z.string().min(40).max(200),
  name: z.string().min(2).max(80).optional(),
  aka: z.array(z.string()).max(8).optional(),
  relationNotes: z.record(z.string(), z.string().max(280)).optional(),
  // Optional 'In Chile' callout (<=30 words, ~240 chars): the only place a
  // Chile-specific fact about a global concept may live. Per-locale like every prose field.
  localNote: z.string().min(20).max(260).optional(),
  body: z.string(),
});

export const zViewProseFile = z.object({
  title: z.string().min(2).max(120),
  question: z.string().max(200),
  body: z.string(),
});

// --- Views (§5.6) ------------------------------------------------------------

export const zViewQuery = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('entities'),
    where: z.array(z.record(z.string(), z.union([z.string(), z.array(z.string())]))).min(1),
  }),
  z.object({
    kind: z.literal('predicate'),
    predicate: zPredicateId,
    groupBy: z.enum(['target', 'source']).optional(),
  }),
  z.object({
    kind: z.literal('explicit'),
    entities: z.array(entityId).min(1),
  }),
]);

export const zView = z.object({
  id: z.string(),
  query: zViewQuery,
  render: z.enum(['diagram', 'table', 'both']),
  sources: z.array(zSource),
  lastReviewed: fullIsoDate,
});

export type ZView = z.infer<typeof zView>;

// --- Vocab files (A.3) -------------------------------------------------------

const zLocaleMap = z.record(z.string(), z.string());

export const zEntityTypeVocabEntry = z.object({
  layer: z.enum(['identifier', 'agency', 'index', 'institutional-system', 'regional', 'cross-cutting', 'concept']),
  label: zLocaleMap,
  definition: zLocaleMap.optional(),
  pending: z.boolean().optional(),
});
export const zEntityTypesVocab = z.record(z.string(), zEntityTypeVocabEntry);

export const zPredicateVocabEntry = z.object({
  family: z.enum(PREDICATE_FAMILY_IDS as [PredicateFamilyId, ...PredicateFamilyId[]]),
  pending: z.boolean().optional(),
  label: zLocaleMap,
  inverseLabel: zLocaleMap,
  domain: z.array(z.string()).min(1),
  range: z.array(z.string()).min(1),
  symmetric: z.boolean(),
  acyclic: z.boolean(),
  sameTypeOnly: z.boolean(),
  crossTypePairs: z.array(z.tuple([z.string(), z.string()])).optional(),
  maxOutDegree: z.number().positive().optional(),
  style: z.object({
    color: z.string(),
    line: z.enum(['solid', 'dashed', 'thick']),
    arrow: z.enum(['open', 'closed']),
  }),
});
export const zPredicatesVocab = z.record(z.string(), zPredicateVocabEntry);

export const zTagVocabEntry = z.object({
  label: zLocaleMap,
  definition: zLocaleMap.optional(),
});
export const zTagsVocab = z.record(z.string(), zTagVocabEntry);
export const zPredicateFamiliesVocab = z.record(z.string(), zTagVocabEntry);

export const zDisciplinesVocab = z.record(z.string(), z.object({ label: zLocaleMap }));
export const zStatusesVocab = z.record(z.string(), z.object({ label: zLocaleMap }));
