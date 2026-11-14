/** The public repository: where people propose additions, changes and removals as issues. */
export const REPO_URL = 'https://github.com/Data-Observatory/open-ecosystem-explorer';

/** The page that lists the issue forms (`.github/ISSUE_TEMPLATE/`). */
export const NEW_ISSUE_CHOOSER_URL = `${REPO_URL}/issues/new/choose`;

/**
 * The "change an entry" form, with the entry already filled in. Only the entry id and its name
 * go in the address, and only when the person follows the link.
 */
export function changeEntryIssueUrl(entityId: string, entityName: string): string {
	const query = new URLSearchParams({
		template: 'change-entry.yml',
		title: `[Change] ${entityName}`,
		entity: entityId
	});
	return `${REPO_URL}/issues/new?${query.toString()}`;
}
