import { getTagsVocab } from '../../content/vocab-index.js';
import { ENTITY_TYPES, PREDICATE_IDS } from '../model/types.js';
import type { LegacyVocab } from '../legacy-routes.js';

export async function legacyVocab(): Promise<LegacyVocab> {
	return {
		entityTypes: ENTITY_TYPES,
		tags: [...(await getTagsVocab()).keys()].sort(),
		predicates: PREDICATE_IDS
	};
}
