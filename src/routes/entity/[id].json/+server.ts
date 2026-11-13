import { error } from '@sveltejs/kit';
import { entityJson } from '$lib/server/feeds';
import { entityIds } from '$lib/server/site';
import type { EntryGenerator } from './$types';

// Per-entity record including derived inverse relations, locale-free.
export const prerender = true;

export const entries: EntryGenerator = async () => (await entityIds()).map((id) => ({ id }));

export const GET = async ({ params }) => {
	const body = await entityJson(params.id);
	if (!body) error(404, 'Not found');
	return new Response(body, { headers: { 'Content-Type': 'application/json' } });
};
