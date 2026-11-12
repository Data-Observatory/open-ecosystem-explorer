// Client half of src/components/MapExplorer.astro (`/{loc}/map3`). Reads the
// JSON payload the component renders into #m3-data and drives one Cytoscape
// canvas with `preset` positions (no layout runs in the browser).
import cytoscape from 'cytoscape';
import { NODE_FAMILY_STYLE, EDGE_FAMILY_STYLE, MAP_CANVAS_BG, rankNeighbours, type NodeFamily } from '../lib/map/anchors.js';
import { scoreSearchEntry } from '../lib/map/search-score.js';
import type { PredicateFamilyId } from '../lib/model/types.js';

interface N {
  id: string;
  name: string;
  aka: string[];
  type: string;
  typeLabel: string;
  family: NodeFamily;
  anchor: boolean;
  core: boolean;
  degree: number;
  summary: string;
  wp: string | null;
  x: number;
  y: number;
}
interface E {
  s: string;
  t: string;
  p: string;
  f: PredicateFamilyId;
}
interface Step {
  id: string;
  expanded: boolean;
}

const SHOWN_NEIGHBOURS = 6;
const MODE_KEY = 'ose.map3.mode';
const root = document.getElementById('m3')!;
const data = JSON.parse(document.getElementById('m3-data')!.textContent!) as {
  nodes: N[];
  edges: E[];
  predicates: Record<string, string>;
  t: Record<string, string>;
  entityBase: string;
  locale: string;
};
const { t } = data;
const byId = new Map(data.nodes.map((n) => [n.id, n]));
const adj = new Map<string, E[]>(data.nodes.map((n) => [n.id, []]));
for (const e of data.edges) {
  adj.get(e.s)?.push(e);
  adj.get(e.t)?.push(e);
}
const other = (e: E, id: string) => (e.s === id ? e.t : e.s);
const neighbourIds = (id: string) => rankNeighbours([...new Set((adj.get(id) ?? []).map((e) => other(e, id)))].map((n) => byId.get(n)!)).map((n) => n.id);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

const darkMq = matchMedia('(prefers-color-scheme: dark)');
const motionMq = matchMedia('(prefers-reduced-motion: reduce)');
let booting = true;
const dur = () => (booting || motionMq.matches ? 0 : 260);

// ---------- state ----------
const params = new URLSearchParams(location.search);
let mode: 'default' | 'expert' = params.get('modo') === 'experto' ? 'expert' : 'default';
if (!params.has('modo')) {
  try {
    if (localStorage.getItem(MODE_KEY) === 'expert') mode = 'expert';
  } catch {
    /* storage blocked: default mode */
  }
}
let trail: Step[] = [];
let cursor = -1; // keyboard cursor into `cursorList()`
let typeFilter = '';
let familyFilter = '';

// ---------- canvas ----------
function palette() {
  const dark = darkMq.matches;
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    dark,
    bg: dark ? MAP_CANVAS_BG.dark : MAP_CANVAS_BG.light,
    ink: v('--m3-ink'),
    muted: v('--m3-muted'),
    line: v('--m3-line'),
    accent: v('--m3-accent'),
  };
}

function stylesheet(): cytoscape.StylesheetJson {
  const p = palette();
  const fam = (f: NodeFamily) => (p.dark ? NODE_FAMILY_STYLE[f].dark : NODE_FAMILY_STYLE[f].light);
  const efam = (f: PredicateFamilyId) => (p.dark ? EDGE_FAMILY_STYLE[f].dark : EDGE_FAMILY_STYLE[f].light);
  const fade = { 'transition-property': 'opacity', 'transition-duration': motionMq.matches ? 0 : 250 };
  return [
    {
      selector: 'node',
      style: {
        width: 11,
        height: 11,
        shape: (el: cytoscape.NodeSingular) => NODE_FAMILY_STYLE[el.data('family') as NodeFamily].shape,
        'background-color': (el: cytoscape.NodeSingular) => fam(el.data('family')),
        'border-width': 2,
        'border-color': p.bg,
        label: '',
        'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        'font-size': 12,
        color: p.ink,
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-outline-color': p.bg,
        'text-outline-width': 3,
        'text-max-width': '140px',
        'text-wrap': 'wrap',
        'overlay-opacity': 0,
        'underlay-color': p.accent,
        'underlay-opacity': 0,
        'underlay-padding': 7,
        'underlay-shape': 'ellipse',
        ...fade,
      } as cytoscape.Css.Node,
    },
    { selector: 'node.anchor', style: { width: 17, height: 17, 'font-size': 14, 'font-weight': 600 } },
    { selector: 'node.lbl', style: { label: 'data(name)' } },
    { selector: 'node.hover, node.cursor', style: { 'underlay-opacity': 0.18, label: 'data(name)' } },
    { selector: 'node.sel', style: { width: 18, height: 18, 'underlay-opacity': 0.22, label: 'data(name)', 'font-weight': 700, 'z-index': 10 } },
    { selector: 'node.faded', style: { opacity: 0.1 } },
    { selector: '.gone', style: { display: 'none' } },
    {
      selector: 'edge',
      style: { width: 1, 'line-color': p.line, 'curve-style': 'straight', opacity: 0.9, 'overlay-opacity': 0, ...fade } as cytoscape.Css.Edge,
    },
    {
      selector: 'edge.hl, edge.hover',
      style: {
        width: 1.6,
        'line-color': (el: cytoscape.EdgeSingular) => efam(el.data('f')),
        'line-style': (el: cytoscape.EdgeSingular) => EDGE_FAMILY_STYLE[el.data('f') as PredicateFamilyId].line,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': (el: cytoscape.EdgeSingular) => efam(el.data('f')),
        'arrow-scale': 0.7,
        label: 'data(label)',
        'font-size': 10,
        color: p.muted,
        'text-rotation': 'autorotate',
        'text-background-color': p.bg,
        'text-background-opacity': 1,
        'text-background-padding': '2px',
        'z-index': 5,
      } as cytoscape.Css.Edge,
    },
    { selector: 'edge.faded', style: { opacity: 0.07 } },
  ];
}

// The build-time layout is landscape; on a portrait screen (phones) use it
// transposed so the default view fills the height instead of shrinking.
const portrait = $('m3-cy').clientHeight > $('m3-cy').clientWidth * 1.15;
const cy = cytoscape({
  container: $('m3-cy'),
  elements: [
    ...data.nodes.map((n) => ({ group: 'nodes' as const, data: { id: n.id, name: n.name, family: n.family }, position: portrait ? { x: n.y, y: n.x } : { x: n.x, y: n.y }, classes: n.anchor ? 'anchor' : '' })),
    ...data.edges.map((e, i) => ({ group: 'edges' as const, data: { id: `e${i}`, source: e.s, target: e.t, f: e.f, label: data.predicates[e.p] ?? e.p } })),
  ],
  layout: { name: 'preset' },
  style: stylesheet(),
  minZoom: 0.15,
  maxZoom: 3,
  boxSelectionEnabled: false,
  autoungrabify: true,
  autounselectify: true,
});
const restyle = () => {
  cy.style(stylesheet());
  lastK = 0;
  applyLabels();
};
darkMq.addEventListener('change', restyle);
motionMq.addEventListener('change', restyle);

// ---------- derived view ----------
const current = () => trail.at(-1);
let shown = new Set<string>();

function visibleIds(): Set<string> {
  if (mode === 'expert') {
    return new Set(data.nodes.filter((n) => !typeFilter || n.type === typeFilter || n.id === current()?.id).map((n) => n.id));
  }
  const vis = new Set(data.nodes.filter((n) => n.anchor).map((n) => n.id));
  for (const s of trail) vis.add(s.id);
  const cur = current();
  if (cur) for (const id of shownNeighbours(cur)) vis.add(id);
  return vis;
}

function shownNeighbours(step: Step): string[] {
  const all = neighbourIds(step.id);
  return step.expanded || mode === 'expert' ? all : all.slice(0, SHOWN_NEIGHBOURS);
}

function render(focusCamera = true) {
  const vis = visibleIds();
  const cur = current();
  const prevVisible = shown;
  shown = vis;
  const near = new Set(cur ? [cur.id, ...neighbourIds(cur.id)] : []);
  cy.batch(() => {
    cy.nodes().forEach((n) => {
      const id = n.id();
      n.toggleClass('gone', !vis.has(id));
      n.toggleClass('sel', id === cur?.id);
      n.toggleClass('faded', !!cur && !near.has(id));
    });
    cy.edges().forEach((e) => {
      const ed = data.edges[Number(e.id().slice(1))]!;
      const on = vis.has(ed.s) && vis.has(ed.t) && (!familyFilter || ed.f === familyFilter);
      const incident = !!cur && (ed.s === cur.id || ed.t === cur.id);
      e.toggleClass('gone', !on);
      e.toggleClass('hl', incident);
      e.toggleClass('faded', !!cur && !incident);
    });
  });
  renderCard();
  applyLabels();
  if (focusCamera) frame(cy.nodes().filter((n) => vis.has(n.id()) && (!cur || near.has(n.id()))));
  // Newly revealed neighbours grow out of the selected node.
  if (cur && dur() > 0) {
    const origin = cy.getElementById(cur.id).position();
    cy.nodes()
      .filter((n) => vis.has(n.id()) && !prevVisible.has(n.id()) && prevVisible.size > 0)
      .forEach((n) => {
        const target = { ...n.position() };
        n.position({ ...origin });
        n.animate({ position: target }, { duration: dur(), easing: 'ease-out-cubic' });
      });
  }
  placeBadge();
  if (root.dataset.view === 'list') renderList();
}

/**
 * Labels by zoom: anchors and the selection always, hubs at mid zoom,
 * everything up close. Text, strokes and (more gently) marks are counter-
 * scaled so they keep a readable on-screen size whatever the zoom.
 */
let lastK = 0;
function applyLabels() {
  const cur = current();
  const near = new Set(cur ? [cur.id, ...neighbourIds(cur.id)] : []);
  const z = cy.zoom();
  const k = 1 / Math.min(Math.max(z, mode === 'expert' ? 0.5 : 0.4), 1.25);
  cy.batch(() =>
    cy.nodes().forEach((n) => {
      const node = byId.get(n.id())!;
      n.toggleClass('lbl', mode === 'default' || node.anchor || near.has(node.id) || z >= 1.1 || (z >= 0.6 && node.degree >= 4));
    }),
  );
  if (Math.abs(k - lastK) < 0.02) return;
  lastK = k;
  const m = k ** 0.75;
  cy.style()
    .selector('node').style({ width: 10 * m, height: 10 * m, 'font-size': 12.5 * k, 'text-margin-y': 5 * k, 'text-outline-width': 2.5 * k, 'text-max-width': `${150 * k}px`, 'underlay-padding': 7 * m })
    .selector('node.anchor').style({ width: 15 * m, height: 15 * m, 'font-size': 14 * k })
    .selector('node.sel').style({ width: 18 * m, height: 18 * m, 'font-size': 16 * k, 'underlay-padding': 9 * m })
    .selector('edge').style({ width: 1 * k })
    .selector('edge.hl, edge.hover').style({ width: 1.6 * k, 'font-size': 10.5 * k, 'text-background-padding': `${2 * k}px` })
    .update();
}

/** Fit `eles` into the part of the canvas the card does not cover. */
function frame(eles: cytoscape.NodeCollection) {
  if (eles.empty()) return;
  const w = cy.width();
  const h = cy.height();
  const card = $('m3-card');
  let [x0, y0, x1, y1] = [0, 56, w, h - 36]; // below the search bar, above the hint
  if (!card.hidden) {
    const r = card.getBoundingClientRect();
    const c = $('m3-cy').getBoundingClientRect();
    if (r.width < w * 0.9) x1 = r.left - c.left;
    else y1 = r.top - c.top;
  }
  const pad = Math.min(90, (x1 - x0) / 5);
  // From model positions, not cy's boundingBox(): nodes un-hidden in this
  // same frame have no rendered bounds yet.
  const xs = eles.map((n) => n.position('x'));
  const ys = eles.map((n) => n.position('y'));
  const bb = { x1: Math.min(...xs), y1: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const zoom = Math.max(0.2, Math.min(mode === 'default' ? 1.4 : 1.8, (x1 - x0 - 2 * pad) / Math.max(bb.w, 1), (y1 - y0 - 2 * pad) / Math.max(bb.h, 1)));
  const pan = { x: (x0 + x1) / 2 - zoom * (bb.x1 + bb.w / 2), y: (y0 + y1) / 2 - zoom * (bb.y1 + bb.h / 2) };
  cy.stop();
  if (dur() === 0) cy.viewport({ zoom, pan });
  else cy.animate({ zoom, pan }, { duration: dur() + 120, easing: 'ease-out-cubic' });
}

// ---------- card ----------
function renderCard() {
  const card = $('m3-card');
  const cur = current();
  if (!cur) {
    card.hidden = true;
    return;
  }
  const n = byId.get(cur.id)!;
  card.hidden = false;
  $('m3-card-title').textContent = n.name;
  $('m3-card-type').textContent = n.typeLabel;
  card.style.setProperty('--m3-dot', `var(--m3-fam-${n.family})`);
  $('m3-card-summary').textContent = n.summary;
  const rels = $('m3-card-rels');
  rels.replaceChildren();
  const order = neighbourIds(n.id);
  const edges = [...(adj.get(n.id) ?? [])].sort((a, b) => order.indexOf(other(a, n.id)) - order.indexOf(other(b, n.id))).slice(0, 5);
  for (const e of edges) {
    const li = document.createElement('li');
    const part = (id: string) => {
      if (id === n.id) {
        const b = document.createElement('b');
        b.textContent = n.name;
        return b;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = byId.get(id)!.name;
      btn.addEventListener('click', () => go(id));
      return btn;
    };
    li.append(part(e.s), ` ${data.predicates[e.p] ?? e.p} `, part(e.t));
    rels.append(li);
  }
  const entry = $<HTMLAnchorElement>('m3-card-entry');
  entry.href = `${data.entityBase}${n.id}/`;
  const wp = $<HTMLAnchorElement>('m3-card-wp');
  wp.hidden = !n.wp;
  if (n.wp) wp.href = n.wp;
}

function hiddenCount(): number {
  const cur = current();
  if (!cur || mode === 'expert') return 0;
  return neighbourIds(cur.id).length - shownNeighbours(cur).length;
}

function placeBadge() {
  const badge = $('m3-badge');
  const k = hiddenCount();
  const cur = current();
  badge.hidden = k === 0 || root.dataset.view === 'list';
  if (badge.hidden || !cur) return;
  const p = cy.getElementById(cur.id).renderedPosition();
  badge.textContent = `+${k}`;
  badge.setAttribute('aria-label', fill(t.moreLabel!, { n: k }));
  badge.style.left = `${p.x + 24}px`;
  badge.style.top = `${p.y - 20}px`;
}

// ---------- navigation ----------
function syncUrl() {
  const q = new URLSearchParams(location.search);
  const cur = current();
  if (cur) q.set('n', cur.id);
  else q.delete('n');
  if (mode === 'expert') q.set('modo', 'experto');
  else q.delete('modo');
  const s = q.toString();
  window.history.replaceState(null, '', `${location.pathname}${s ? `?${s}` : ''}`);
}

function announce(text: string) {
  $('m3-live').textContent = text;
}

function go(id: string) {
  if (!byId.has(id) || current()?.id === id) return;
  const i = trail.findIndex((s) => s.id === id);
  trail = i >= 0 ? trail.slice(0, i + 1) : [...trail, { id, expanded: false }];
  cursor = -1;
  root.dataset.touched = '';
  if (root.dataset.view === 'list') setView('map');
  render();
  syncUrl();
  announce(fill(t.selected!, { name: byId.get(id)!.name, n: neighbourIds(id).length }));
}

function back() {
  if (!trail.length) return;
  trail = trail.slice(0, -1);
  cursor = -1;
  render();
  syncUrl();
  const cur = current();
  announce(cur ? fill(t.selected!, { name: byId.get(cur.id)!.name, n: neighbourIds(cur.id).length }) : t.cleared!);
}

function expand() {
  const cur = current();
  if (!cur || hiddenCount() === 0) return;
  cur.expanded = true;
  render();
}

function setMode(next: 'default' | 'expert') {
  mode = next;
  root.dataset.mode = next;
  $('m3-expert').setAttribute('aria-checked', String(next === 'expert'));
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    /* storage blocked: URL still carries the mode */
  }
  if (next === 'default') {
    typeFilter = familyFilter = '';
    $<HTMLSelectElement>('m3-type').value = '';
    $<HTMLSelectElement>('m3-family').value = '';
    setView('map');
  }
  render();
  syncUrl();
}

function setView(view: 'map' | 'list') {
  root.dataset.view = view;
  $('m3-view-map').setAttribute('aria-pressed', String(view === 'map'));
  $('m3-view-list').setAttribute('aria-pressed', String(view === 'list'));
  $('m3-list').hidden = view !== 'list';
  if (view === 'list') {
    $('m3-card').hidden = true;
    renderList();
  } else renderCard();
  placeBadge();
}

function renderList() {
  const vis = visibleIds();
  const rows = data.nodes.filter((n) => vis.has(n.id)).sort((a, b) => a.name.localeCompare(b.name, data.locale));
  $('m3-count').textContent = fill(t.count!, { n: rows.length, total: data.nodes.length });
  $('m3-rows').replaceChildren(
    ...rows.map((n) => {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = n.name;
      btn.addEventListener('click', () => go(n.id));
      name.append(btn);
      const type = document.createElement('td');
      type.textContent = n.typeLabel;
      const deg = document.createElement('td');
      deg.textContent = String(neighbourIds(n.id).length);
      tr.append(name, type, deg);
      return tr;
    }),
  );
}

// ---------- keyboard cursor ----------
function cursorList(): string[] {
  const cur = current();
  if (cur) return shownNeighbours(cur).filter((id) => shown.has(id));
  // Reading order: top to bottom, then left to right.
  const at = (id: string) => (cy.getElementById(id) as cytoscape.NodeSingular).position();
  return [...shown].sort((a, b) => at(a).y - at(b).y || at(a).x - at(b).x);
}

function moveCursor(step: number) {
  const list = cursorList();
  if (!list.length) return;
  cursor = (cursor + step + list.length) % list.length;
  cy.nodes('.cursor').removeClass('cursor');
  const id = list[cursor]!;
  cy.getElementById(id).addClass('cursor');
  announce(`${byId.get(id)!.name}, ${byId.get(id)!.typeLabel}`);
}

// ---------- search ----------
const q = $<HTMLInputElement>('m3-q');
const results = $<HTMLUListElement>('m3-results');
let hits: N[] = [];
let active = -1;

function renderResults() {
  const needle = q.value.trim();
  hits = needle
    ? data.nodes
        .map((n) => ({ n, s: scoreSearchEntry({ name: n.name, aka: n.aka, summary: n.summary }, needle) }))
        .filter((r) => r.s >= 0)
        .sort((a, b) => b.s - a.s || Number(b.n.anchor) - Number(a.n.anchor) || b.n.degree - a.n.degree)
        .slice(0, 8)
        .map((r) => r.n)
    : [];
  active = hits.length ? 0 : -1;
  results.replaceChildren(
    ...(needle && !hits.length ? [Object.assign(document.createElement('li'), { textContent: t.noResults, role: 'option', ariaDisabled: 'true' })] : []),
    ...hits.map((n, i) => {
      const li = document.createElement('li');
      li.id = `m3-hit-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === active));
      const small = document.createElement('small');
      small.textContent = n.typeLabel;
      li.append(n.name, small);
      li.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        pick(n.id);
      });
      return li;
    }),
  );
  results.hidden = !needle;
  q.setAttribute('aria-expanded', String(!results.hidden));
  if (active >= 0) q.setAttribute('aria-activedescendant', `m3-hit-${active}`);
  else q.removeAttribute('aria-activedescendant');
}

function pick(id: string) {
  q.value = '';
  renderResults();
  go(id);
  $('m3-cy').focus({ preventScroll: true });
}

q.addEventListener('input', renderResults);
q.addEventListener('blur', () => setTimeout(() => ((results.hidden = true), q.setAttribute('aria-expanded', 'false')), 120));
q.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!hits.length) return;
    active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
    results.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    q.setAttribute('aria-activedescendant', `m3-hit-${active}`);
  } else if (ev.key === 'Enter' && hits[active]) {
    ev.preventDefault();
    pick(hits[active]!.id);
  } else if (ev.key === 'Escape') {
    q.value = '';
    renderResults();
    $('m3-cy').focus();
  }
});

// ---------- events ----------
cy.on('tap', 'node', (ev) => go(ev.target.id()));
cy.on('tap', (ev) => {
  if (ev.target === cy && trail.length) {
    trail = [];
    render();
    syncUrl();
  }
});
cy.on('mouseover', 'node', (ev) => {
  ev.target.addClass('hover');
  $('m3-cy').style.cursor = 'pointer';
});
cy.on('mouseout', 'node', (ev) => {
  ev.target.removeClass('hover');
  $('m3-cy').style.cursor = '';
});
cy.on('mouseover', 'edge', (ev) => ev.target.addClass('hover'));
cy.on('mouseout', 'edge', (ev) => ev.target.removeClass('hover'));
let raf = 0;
cy.on('viewport', () => {
  placeBadge();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(applyLabels);
});

$('m3-badge').addEventListener('click', expand);
$('m3-close').addEventListener('click', () => {
  trail = [];
  render();
  syncUrl();
});
$('m3-expert').addEventListener('click', () => setMode(mode === 'expert' ? 'default' : 'expert'));
$('m3-view-map').addEventListener('click', () => setView('map'));
$('m3-view-list').addEventListener('click', () => setView('list'));
$<HTMLSelectElement>('m3-type').addEventListener('change', (ev) => {
  typeFilter = (ev.target as HTMLSelectElement).value;
  render();
});
$<HTMLSelectElement>('m3-family').addEventListener('change', (ev) => {
  familyFilter = (ev.target as HTMLSelectElement).value;
  render(false);
});

document.addEventListener('keydown', (ev) => {
  const target = ev.target as HTMLElement;
  const typing = target.matches('input, select, textarea');
  if (ev.key === '/' && !typing) {
    ev.preventDefault();
    q.focus();
    return;
  }
  if (typing || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const onMap = target === document.body || target.id === 'm3-cy' || root.contains(target);
  if (!onMap) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    back();
    $('m3-cy').focus({ preventScroll: true });
  } else if (target.id === 'm3-cy' && ev.key.startsWith('Arrow')) {
    ev.preventDefault();
    moveCursor(ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1);
  } else if (target.id === 'm3-cy' && ev.key === 'Enter') {
    ev.preventDefault();
    const id = cursorList()[cursor];
    if (cursor >= 0 && id) go(id);
    else expand();
  } else if (target.id === 'm3-cy' && ev.key === '+') {
    expand();
  }
});

new ResizeObserver(() => {
  cy.resize();
  placeBadge();
}).observe($('m3-cy'));

// ---------- boot ----------
root.dataset.mode = mode;
$('m3-expert').setAttribute('aria-checked', String(mode === 'expert'));
const start = params.get('n');
if (start && byId.has(start)) {
  trail = [{ id: start, expanded: false }];
  root.dataset.touched = '';
}
render();
booting = false;
(window as unknown as { __cyMap3: cytoscape.Core }).__cyMap3 = cy; // e2e hook
root.dataset.ready = '';
