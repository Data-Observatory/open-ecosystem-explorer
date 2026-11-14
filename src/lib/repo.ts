/** The public repository: where people propose additions, changes and removals as issues. */
export const REPO_URL = 'https://github.com/Data-Observatory/open-ecosystem-explorer';

/** The page that lists the issue forms (`.github/ISSUE_TEMPLATE/`). */
export const NEW_ISSUE_CHOOSER_URL = `${REPO_URL}/issues/new/choose`;

/** The address for people without a GitHub account; a maintainer opens the issue for them. */
export const CONTACT_EMAIL = 'contacto@dataobservatory.net';

type EntryForm = 'description' | 'connection';

// Form file, title prefix and the id of the form field that names the entry.
const FORMS: Record<EntryForm, { template: string; prefix: string; field: string }> = {
	description: { template: 'description.yml', prefix: '[Description]', field: 'entity' },
	connection: { template: 'connection.yml', prefix: '[Connection]', field: 'entity_a' }
};

/**
 * A form with the entry already filled in. Only the entry id and its name go in the address,
 * and only when the person follows the link.
 */
export function entryIssueUrl(form: EntryForm, entityId: string, entityName: string): string {
	const { template, prefix, field } = FORMS[form];
	const query = new URLSearchParams({ template, title: `${prefix} ${entityName}` });
	query.set(field, entityId);
	return `${REPO_URL}/issues/new?${query.toString()}`;
}
