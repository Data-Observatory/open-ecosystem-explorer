// Per-type subtype field lookup (specs.md §5.2). Each type-specific subtype
// field (repositoryKind, indexKind, ...) is populated correctly in content
// but was invisible to every consumer (map/taxonomy/type pages) prior to
// this module — the Zenodo (hosted-service) vs Dataverse (software-platform)
// distinction exists in the data, this is what surfaces it. `identifier` and
// `agency` carry no dedicated Kind field (§5.2) and are intentionally absent
// here — those two types render without a subtype level, same as before.
import type { Entity, EntityType } from './types.js';

export const SUBTYPE_FIELD: Partial<Record<EntityType, string>> = {
	index: 'indexKind',
	cris: 'crisKind',
	repository: 'repositoryKind',
	aggregator: 'aggregatorKind',
	'publishing-platform': 'platformKind',
	standard: 'standardKind',
	community: 'communityKind',
	coalition: 'coalitionKind',
	policy: 'policyKind',
	organization: 'orgKind'
};

/** Raw subtype enum value (e.g. `'hosted-service'`), or undefined when the
 *  entity's type carries no subtype field. */
export function subtypeOf(entity: Entity): string | undefined {
	const field = SUBTYPE_FIELD[entity.type];
	if (!field) return undefined;
	return (entity as unknown as Record<string, unknown>)[field] as string | undefined;
}

/** `'hosted-service'` -> `'Hosted service'`. No localisation — subtype enum
 *  values have no translation vocab yet (§A.3 covers types/predicates/tags/
 *  disciplines/statuses only); revisit if that gap needs closing. */
export function humanizeSubtype(value: string): string {
	const spaced = value.replace(/-/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
