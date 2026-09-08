// /map's URL query state (specs.md §6.6: "held in URL query state ... so
// every view is linkable"). Pure parse/serialise pair, no DOM access, so the
// round-trip is unit-testable without a browser — the client script just
// calls these against `location.search` / `history.replaceState`.
export interface MapUrlState {
  layers: string[];
  types: string[];
  governances: string[];
  tags: string[];
  selected: string[];
  hops: 1 | 2 | 3;
}

export const EMPTY_MAP_URL_STATE: MapUrlState = {
  layers: [],
  types: [],
  governances: [],
  tags: [],
  selected: [],
  hops: 1,
};

function splitCsv(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

export function parseMapUrlState(search: string): MapUrlState {
  const params = new URLSearchParams(search);
  const hopsRaw = Number(params.get('hops'));
  const hops: 1 | 2 | 3 = hopsRaw === 2 || hopsRaw === 3 ? hopsRaw : 1;
  return {
    layers: splitCsv(params.get('layer')),
    types: splitCsv(params.get('type')),
    governances: splitCsv(params.get('governance')),
    tags: splitCsv(params.get('tag')),
    selected: splitCsv(params.get('sel')),
    hops,
  };
}

export function serializeMapUrlState(state: MapUrlState): string {
  const params = new URLSearchParams();
  if (state.layers.length > 0) params.set('layer', state.layers.join(','));
  if (state.types.length > 0) params.set('type', state.types.join(','));
  if (state.governances.length > 0) params.set('governance', state.governances.join(','));
  if (state.tags.length > 0) params.set('tag', state.tags.join(','));
  if (state.selected.length > 0) params.set('sel', state.selected.join(','));
  if (state.hops !== 1) params.set('hops', String(state.hops));
  const s = params.toString();
  return s ? `?${s}` : '';
}
