import { changelogHtml } from '#lib/server/site.ts';

export const load = () => ({ html: changelogHtml() });
