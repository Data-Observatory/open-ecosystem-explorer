import * as m from '#lib/paraglide/messages.js';

const GOVERNANCE: Record<string, () => string> = {
	commercial: m.governance_commercial,
	nonprofit: m.governance_nonprofit,
	community: m.governance_community,
	intergovernmental: m.governance_intergovernmental,
	'public-agency': m.governance_public_agency,
	academic: m.governance_academic,
	unknown: m.governance_unknown,
	'not-applicable': m.governance_not_applicable
};

/** Localised label for a `governance` enum value; unknown values fall back to the raw value. */
export function governanceLabel(value: string): string {
	return GOVERNANCE[value]?.() ?? value;
}
