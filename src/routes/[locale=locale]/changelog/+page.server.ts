import { changelogHtml } from '$lib/server/site';

export const load = () => ({ html: changelogHtml() });
