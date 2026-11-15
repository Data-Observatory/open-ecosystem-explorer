/**
 * Accessible name of a map node: it starts with the text drawn on the map (WCAG 2.5.3, Label in
 * Name), so voice-control users can say what they read, then gives the full name and the kind.
 * The drawn label is often a short form ("PID", "Gestión de datos").
 */
export function nodeAccessibleName(node: {
	label: string;
	name: string;
	typeLabel: string;
}): string {
	const drawn = node.label.replace(/\s+/g, ' ').trim();
	const full = `${node.name} (${node.typeLabel})`;
	if (!drawn || node.name.toLowerCase().startsWith(drawn.toLowerCase())) return full;
	return `${drawn}: ${full}`;
}
