/**
 * The explorer's URL query state. The URL is the single source of truth: every state change is
 * a navigation to `serializeMapUrl(...)`, and the store re-reads the query after each one, so
 * Back/Forward, deep links and the language switch all behave the same way.
 *
 *   ?n=<entity>                     selected node
 *   ?historia=<story>&paso=<n>      story being played, 1-based step
 *   ?modo=experto                   expert mode (&vista=lista, &tipo=<type>, &rel=<family>)
 */
export interface MapUrlState {
	selected: string | null;
	story: string | null;
	/** 0-based step index; only meaningful with `story`. */
	step: number;
	expert: boolean;
	view: 'map' | 'list';
	type: string;
	family: string;
}

export const EMPTY_URL_STATE: MapUrlState = {
	selected: null,
	story: null,
	step: 0,
	expert: false,
	view: 'map',
	type: '',
	family: ''
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = (value: string | null): string | null => (value && ID.test(value) ? value : null);

export function parseMapUrl(search: string): MapUrlState {
	const params = new URLSearchParams(search);
	const story = id(params.get('historia'));
	const paso = Number.parseInt(params.get('paso') ?? '1', 10);
	const expert = params.get('modo') === 'experto';
	return {
		// A story owns the canvas: a stray `n` next to `historia` is ignored.
		selected: story ? null : id(params.get('n')),
		story,
		step: story && Number.isFinite(paso) && paso > 1 ? paso - 1 : 0,
		expert,
		view: expert && params.get('vista') === 'lista' ? 'list' : 'map',
		type: expert ? (id(params.get('tipo')) ?? '') : '',
		family: expert ? (id(params.get('rel')) ?? '') : ''
	};
}

/** Canonical query string (fixed parameter order), '' for the starting view. */
export function serializeMapUrl(state: MapUrlState): string {
	const params = new URLSearchParams();
	if (state.story) {
		params.set('historia', state.story);
		params.set('paso', String(state.step + 1));
	} else if (state.selected) {
		params.set('n', state.selected);
	}
	if (state.expert) {
		params.set('modo', 'experto');
		if (state.view === 'list') params.set('vista', 'lista');
		if (state.type) params.set('tipo', state.type);
		if (state.family) params.set('rel', state.family);
	}
	const out = params.toString();
	return out ? `?${out}` : '';
}

/**
 * Breadcrumb trail of visited nodes. Visiting a node already on the trail steps back to it
 * (that is what Back and a crumb click do); a new node is appended and the trail keeps its last
 * `max` entries. `null` (the starting view) clears it.
 */
export function nextTrail(trail: readonly string[], visited: string | null, max = 5): string[] {
	if (!visited) return [];
	const at = trail.indexOf(visited);
	if (at >= 0) return trail.slice(0, at + 1);
	return [...trail, visited].slice(-max);
}
