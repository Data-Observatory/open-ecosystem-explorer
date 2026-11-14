// Graph-dependent checks for stories (pure; scripts/validate.ts runs them
// after the Zod parse, against the same GraphIndex as the I-series).
//
//   ST1 ERROR  id equals the filename stem; ids are unique.
//   ST2 ERROR  every focus / reveal / edge endpoint is an existing entity.
//   ST3 ERROR  every highlighted edge exists in the graph (a symmetric
//              predicate may be written in either direction).
//   ST4 ERROR  steps stay connected: from step 2 on, the focus is already
//              shown or one edge away from something shown; every revealed
//              entity is shown or one edge away from the focus or something
//              shown; a highlighted edge joins two shown entities.
//   ST5 ERROR  each step caption is at most STORY_STEP_MAX_WORDS words, per locale.
//   ST6 ERROR  `theme`, when present, is a known map theme.
import type { EntityId, GraphIndex } from '../model/types.js';
import type { InvariantMessage } from '../invariants/types.js';
import { isMapThemeId, MAP_THEMES } from '../map/anchors.js';
import { STORY_STEP_MAX_WORDS, type StoryEdgeRef, type StoryFileEntry } from './schema.js';

function err(
	ruleId: string,
	file: string,
	message: string,
	hint: string,
	field?: string
): InvariantMessage {
	return { level: 'ERROR', ruleId, file, field, message, hint };
}

export function countWords(text: string): number {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Undirected adjacency over every canonical edge. */
function neighbours(index: GraphIndex, id: EntityId): Set<EntityId> {
	const out = new Set<EntityId>();
	for (const e of index.outgoing.get(id) ?? []) out.add(e.to);
	for (const e of index.incoming.get(id) ?? []) out.add(e.from);
	return out;
}

export function edgeExists(index: GraphIndex, ref: StoryEdgeRef): boolean {
	const symmetric = index.predicates.get(ref.predicate)?.symmetric ?? false;
	return index.edges.some(
		(e) =>
			e.predicate === ref.predicate &&
			((e.from === ref.source && e.to === ref.target) ||
				(symmetric && e.from === ref.target && e.to === ref.source))
	);
}

function edgeLabel(ref: StoryEdgeRef): string {
	return `${ref.source} -${ref.predicate}-> ${ref.target}`;
}

export function checkStories(
	entries: readonly StoryFileEntry[],
	index: GraphIndex
): InvariantMessage[] {
	const out: InvariantMessage[] = [];
	const seenIds = new Map<string, string>();

	for (const { id, file, story } of entries) {
		// ST1
		if (story.id !== id) {
			out.push(
				err(
					'ST1',
					file,
					`story id '${story.id}' does not match the filename '${id}'.`,
					`Rename the file to ${story.id}.yaml or set id: ${id}.`,
					'id'
				)
			);
		}
		const firstFile = seenIds.get(story.id);
		if (firstFile) {
			out.push(
				err(
					'ST1',
					file,
					`story id '${story.id}' is already used by ${firstFile}.`,
					'Story ids must be unique.',
					'id'
				)
			);
		} else {
			seenIds.set(story.id, file);
		}

		// ST6
		if (story.theme !== undefined && !isMapThemeId(story.theme)) {
			out.push(
				err(
					'ST6',
					file,
					`unknown theme '${story.theme}'.`,
					`Use one of: ${MAP_THEMES.map((t) => t.id).join(', ')}.`,
					'theme'
				)
			);
		}

		const shown = new Set<EntityId>();
		story.steps.forEach((step, i) => {
			const at = `steps[${i}]`;
			const exists = (ref: EntityId, field: string): boolean => {
				if (index.entities.has(ref)) return true;
				out.push(
					err(
						'ST2',
						file,
						`'${ref}' is not an entity.`,
						'Use the id of an existing file in src/content/entities/.',
						field
					)
				);
				return false;
			};

			// ST5
			for (const [locale, text] of Object.entries(step.text)) {
				const words = countWords(text);
				if (words > STORY_STEP_MAX_WORDS) {
					out.push(
						err(
							'ST5',
							file,
							`${locale} caption has ${words} words (max ${STORY_STEP_MAX_WORDS}).`,
							'Shorten it to one plain sentence.',
							`${at}.text.${locale}`
						)
					);
				}
			}

			// ST2 + ST4 (focus)
			if (exists(step.focus, `${at}.focus`) && i > 0 && !shown.has(step.focus)) {
				const near = neighbours(index, step.focus);
				if (![...shown].some((s) => near.has(s))) {
					out.push(
						err(
							'ST4',
							file,
							`focus '${step.focus}' is not shown yet and has no edge to anything shown so far.`,
							'Reveal a connecting entity in an earlier step, or reorder the steps.',
							`${at}.focus`
						)
					);
				}
			}
			shown.add(step.focus);

			// ST2 + ST4 (reveal)
			step.reveal.forEach((r, j) => {
				if (!exists(r, `${at}.reveal[${j}]`) || shown.has(r)) {
					shown.add(r);
					return;
				}
				const near = neighbours(index, r);
				if (![...shown].some((s) => near.has(s))) {
					out.push(
						err(
							'ST4',
							file,
							`revealed '${r}' has no edge to the focus or to anything shown so far.`,
							'Reveal only entities one edge away from what is on screen.',
							`${at}.reveal[${j}]`
						)
					);
				}
				shown.add(r);
			});

			// ST2 + ST3 + ST4 (edges)
			(step.edges ?? []).forEach((ref, j) => {
				const field = `${at}.edges[${j}]`;
				const sourceOk = exists(ref.source, `${field}.source`);
				const targetOk = exists(ref.target, `${field}.target`);
				if (!sourceOk || !targetOk) return;
				if (!edgeExists(index, ref)) {
					out.push(
						err(
							'ST3',
							file,
							`edge ${edgeLabel(ref)} is not in the graph.`,
							'Highlight only edges authored in src/content/entities/ (canonical direction).',
							field
						)
					);
					return;
				}
				if (!shown.has(ref.source) || !shown.has(ref.target)) {
					out.push(
						err(
							'ST4',
							file,
							`edge ${edgeLabel(ref)} joins an entity that is not shown at this step.`,
							"Add the missing endpoint to this step's reveal list.",
							field
						)
					);
				}
			});
		});
	}
	return out;
}
