/**
 * State of the map explorer. One instance per mounted explorer.
 *
 * The URL query is the source of truth (see url.ts). Every action builds the next URL state,
 * applies it at once (so the canvas reacts immediately) and navigates to it; `sync` runs after
 * every navigation, including Back/Forward, and applies whatever the URL says. Everything drawn
 * is derived from that state through the pure `buildScene`.
 */
import { goto } from '$app/navigation';
import { zoomAt } from './geometry';
import { groupSentences, sentencesOf, type MapIndex } from './graph';
import { buildScene, type Scene } from './scene';
import { clampStep } from './story';
import type { Camera, MapNode, MapStory, Point, Viewport } from './types';
import { EMPTY_URL_STATE, nextTrail, parseMapUrl, serializeMapUrl, type MapUrlState } from './url';

const STORAGE_KEY = 'ose:map-mode';
const ZOOM = { min: 0.25, max: 2.5 };

/** Width of the card overlay plus its margins, kept free on the right of the canvas. */
const CARD_INSET = 392;

export interface MapMessages {
	selected: (name: string, n: number) => string;
	cleared: () => string;
}

export class MapStore {
	readonly #messages: MapMessages;

	url = $state.raw<MapUrlState>(EMPTY_URL_STATE);
	expanded = $state(false);
	trail = $state.raw<string[]>([]);
	size = $state.raw({ w: 1104, h: 600 });
	/** Height of the story caption bar overlaying the canvas (desktop). */
	captionHeight = $state(150);
	focusAt = $state.raw<Point>({ x: 0, y: 0 });
	userCam = $state.raw<Camera | null>(null);
	hotPair = $state<string | null>(null);
	hotNode = $state<string | null>(null);
	paletteOpen = $state(false);
	announcement = $state('');
	/** Set once the first URL sync has run in the browser. */
	ready = $state(false);
	/** True when the next scene change must not animate (resize, pan, zoom, first paint). */
	instant = true;

	constructor(
		readonly index: MapIndex,
		readonly locale: string,
		/** Pathname of the page the explorer lives on (`/es/`). */
		readonly path: string,
		messages: MapMessages
	) {
		this.#messages = messages;
	}

	readonly compact = $derived(this.size.w < 640);

	readonly story: MapStory | null = $derived.by(
		() => this.index.graph.stories.find((story) => story.id === this.url.story) ?? null
	);

	readonly selected: MapNode | null = $derived.by(
		() => (this.url.selected ? this.index.byId.get(this.url.selected) : undefined) ?? null
	);

	/** The card is open: a node is selected and no story is playing. */
	readonly cardOpen = $derived(this.selected !== null && this.story === null);

	readonly sentences = $derived.by(() =>
		this.selected ? sentencesOf(this.index, this.selected.id, this.locale) : []
	);

	readonly vp: Viewport = $derived({
		w: this.size.w,
		h: this.size.h,
		inset: this.compact
			? { top: 0, right: 0, bottom: 0, left: 0 }
			: {
					top: this.url.expert || this.cardOpen ? 56 : 20,
					right: this.cardOpen && this.size.w >= 760 ? CARD_INSET : 0,
					bottom: this.story ? this.captionHeight + 24 : 32,
					left: 0
				}
	});

	readonly scene: Scene = $derived.by(() =>
		buildScene({
			index: this.index,
			vp: this.vp,
			compact: this.compact,
			locale: this.locale,
			expert: this.url.expert,
			selected: this.url.selected,
			expanded: this.expanded,
			focusAt: this.focusAt,
			story: this.story ? { story: this.story, step: this.url.step } : null,
			type: this.url.type,
			family: this.url.family,
			userCam: this.userCam
		})
	);

	/** Sentences of the selected node whose other end is on the canvas, grouped for the card. */
	readonly groups = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local to this derivation
		const onCanvas = new Set(this.scene.nodes.map((node) => node.id));
		const visible =
			this.scene.kind === 'focus'
				? this.sentences.filter((sentence) => onCanvas.has(sentence.other.id))
				: this.sentences;
		return groupSentences(this.index, visible);
	});

	// -------------------------------------------------------------------------------------------
	// URL <-> state

	/** Reads the query string after a navigation (and on mount). */
	sync(search: string): void {
		const parsed = parseMapUrl(search);
		const first = !this.ready;
		if (first) this.instant = true;
		if (!parsed.expert && this.#remembered() === 'experto') {
			this.#go({ ...parsed, expert: true }, true);
		} else {
			this.#apply(parsed);
		}
		this.ready = true;
	}

	#normalise(next: MapUrlState): MapUrlState {
		const story = this.index.graph.stories.find((s) => s.id === next.story);
		const selected = !story && next.selected && this.index.byId.has(next.selected);
		return {
			...next,
			story: story ? story.id : null,
			step: story ? clampStep(story, next.step) : 0,
			selected: selected ? next.selected : null,
			type: this.index.graph.types.some((t) => t.id === next.type) ? next.type : '',
			family: this.index.graph.families.some((f) => f.id === next.family) ? next.family : ''
		};
	}

	#apply(raw: MapUrlState): MapUrlState {
		const next = this.#normalise(raw);
		const prev = this.url;
		if (serializeMapUrl(prev) === serializeMapUrl(next)) return next;

		const scene = this.scene;
		const pickedNew = next.selected !== prev.selected || next.story !== prev.story;
		if (next.selected && !next.story && pickedNew) {
			// The selected node stays where the reader found it; its ring grows around that spot.
			const here = scene.nodes.find((node) => node.id === next.selected);
			this.focusAt = here ? { x: here.x, y: here.y } : scene.origin;
		}
		if (!next.story) this.trail = nextTrail(this.trail, next.selected);
		if (pickedNew) {
			this.expanded = false;
			this.hotPair = null;
			this.hotNode = null;
		}
		if (next.expert) {
			const filtersChanged = next.type !== prev.type || next.family !== prev.family;
			const node = next.selected ? this.index.byId.get(next.selected) : undefined;
			// A selection brings its node to the centre, close enough to read its neighbourhood.
			if (node && (pickedNew || !prev.expert))
				this.userCam = { x: node.x, y: node.y, k: Math.max(0.9, scene.cam.k) };
			else if (!prev.expert || filtersChanged) this.userCam = null;
		} else {
			this.userCam = null;
		}
		if (pickedNew && !next.story) {
			const node = next.selected ? this.index.byId.get(next.selected) : undefined;
			this.announcement = node
				? this.#messages.selected(node.name, this.index.neighbours.get(node.id)?.length ?? 0)
				: this.#messages.cleared();
		}
		this.url = next;
		return next;
	}

	#go(next: MapUrlState, replace = false): void {
		const applied = this.#apply(next);
		const target = this.path + serializeMapUrl(applied);
		if (typeof window === 'undefined') return;
		if (target === window.location.pathname + window.location.search) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- `path` already includes the base path
		void goto(target, { replaceState: replace, noScroll: true, keepFocus: true });
	}

	/** Query string for the same view in the other locale's URL (used by links). */
	get query(): string {
		return serializeMapUrl(this.url);
	}

	#remembered(): string | null {
		try {
			return window.localStorage.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	#remember(mode: 'experto' | 'inicial'): void {
		try {
			window.localStorage.setItem(STORAGE_KEY, mode);
		} catch {
			// Storage blocked (private mode, policy): the URL still carries the mode.
		}
	}

	// -------------------------------------------------------------------------------------------
	// Actions

	select(id: string | null): void {
		if (id !== null && !this.index.byId.has(id)) return;
		this.#go({ ...this.url, story: null, step: 0, selected: id });
	}

	/** Esc and the card's back button: the previous node on the trail, else the starting view. */
	back(): void {
		if (this.story) this.exitStory(false);
		else if (this.selected) this.select(this.trail.at(-2) ?? null);
	}

	toggleExpanded(): void {
		this.expanded = !this.expanded;
	}

	playStory(id: string): void {
		this.#go({ ...this.url, selected: null, story: id, step: 0 });
	}

	/** Moves `delta` steps in the story being played; steps replace the history entry. */
	step(delta: number): void {
		if (!this.story) return;
		const step = clampStep(this.story, this.url.step + delta);
		if (step !== this.url.step) this.#go({ ...this.url, step }, true);
	}

	/** Leaves the story; `keepFocus` selects the node the story was on ("keep exploring"). */
	exitStory(keepFocus: boolean): void {
		const focus = this.story?.steps[this.url.step]?.focus ?? null;
		this.#go({ ...this.url, story: null, step: 0, selected: keepFocus ? focus : null });
	}

	setExpert(on: boolean): void {
		this.#remember(on ? 'experto' : 'inicial');
		this.#go({ ...this.url, expert: on, view: 'map', type: '', family: '' }, true);
	}

	setFilter(filter: { type?: string; family?: string }): void {
		this.#go({ ...this.url, ...filter }, true);
	}

	setView(view: 'map' | 'list'): void {
		this.#go({ ...this.url, view }, true);
	}

	resize(w: number, h: number): void {
		if (w <= 0 || h <= 0 || (w === this.size.w && h === this.size.h)) return;
		this.instant = true;
		this.size = { w, h };
	}

	// Expert mode camera. The other scenes frame themselves.
	get canPan(): boolean {
		return this.scene.kind === 'expert';
	}

	pan(dx: number, dy: number): void {
		if (!this.canPan) return;
		const cam = this.scene.cam;
		this.instant = true;
		this.userCam = { x: cam.x - dx / cam.k, y: cam.y - dy / cam.k, k: cam.k };
	}

	zoom(factor: number, at?: Point, smooth = false): void {
		if (!this.canPan) return;
		const vp = this.vp;
		this.instant = !smooth;
		this.userCam = zoomAt(this.scene.cam, factor, at ?? { x: vp.w / 2, y: vp.h / 2 }, vp, ZOOM);
	}

	fit(): void {
		this.userCam = null;
	}
}
