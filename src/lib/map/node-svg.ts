// Class-box SVG generator for map2's `classbox` node style (Opus evaluation
// report §A9/§B5 Option 2 — "more information in the widget… like a real
// concept map", grounded in template_example.html's UML class-box vocabulary,
// ported to a mechanism Cytoscape.js can actually render: a build-time SVG
// data URI set as a node's `background-image`, rather than HTML-in-node
// (which breaks `cy.png()` export and causes pan/zoom jank at any real node
// count — see the report's §B5 Option 3 writeup). Pure and deterministic
// (rule A1) — same input always produces byte-identical output, so this is
// snapshot-testable exactly like the Mermaid generators.
export interface ClassBoxField {
  label: string;
  value: string;
}
export interface ClassBoxInput {
  name: string;
  stereotype: string; // e.g. "Índice · Bibliográfico" — the localized type/subtype line
  fill: string; // type colour, used as the title-bar fill
  fields: ClassBoxField[]; // 0-4 rows, caller decides what's relevant per type
}

/** Exported so layout code (and its tests) can reason about a class box's
 *  real on-screen footprint instead of duplicating this literal.
 *
 *  (2026-09-08: briefly tripled these, then reverted — the user's "triple
 *  the box text" ask was about the grey Tier/Cluster band labels in
 *  `MapExplorerV2.astro`, not these Cards. Back to original sizing.) */
export const CLASS_BOX_WIDTH = 176;
const WIDTH = CLASS_BOX_WIDTH;
const TITLE_HEIGHT = 26;
const STEREOTYPE_HEIGHT = 18;
const ROW_HEIGHT = 16;
const PADDING_X = 8;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Truncate to a max character length with an ellipsis — SVG text has no
 *  native wrap/ellipsis, and a class box row is a fixed single line. */
function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function classBoxHeight(fieldCount: number): number {
  return TITLE_HEIGHT + STEREOTYPE_HEIGHT + fieldCount * ROW_HEIGHT + 4;
}

/** Deterministic ER/UML-style class-box SVG: a coloured title bar with the
 *  entity name, a stereotype line (type · subtype), then one row per field. */
export function renderClassBoxSvg(input: ClassBoxInput): string {
  const fields = input.fields.slice(0, 4);
  const height = classBoxHeight(fields.length);
  const rows = fields
    .map((f, i) => {
      const y = TITLE_HEIGHT + STEREOTYPE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT - 4;
      const rowFill = i % 2 === 0 ? '#ffffff' : '#f6f8fa';
      return [
        `<rect x="0" y="${TITLE_HEIGHT + STEREOTYPE_HEIGHT + i * ROW_HEIGHT}" width="${WIDTH}" height="${ROW_HEIGHT}" fill="${rowFill}" />`,
        `<text x="${PADDING_X}" y="${y}" font-size="9" font-family="sans-serif" fill="#57606a">${escapeXml(truncate(f.label, 14))}</text>`,
        `<text x="${WIDTH - PADDING_X}" y="${y}" font-size="9" font-family="sans-serif" fill="#1f2328" text-anchor="end">${escapeXml(truncate(f.value, 16))}</text>`,
      ].join('');
    })
    .join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" fill="#ffffff" stroke="#1f2328" stroke-width="1" rx="3" />`,
    `<rect x="0" y="0" width="${WIDTH}" height="${TITLE_HEIGHT}" fill="${input.fill}" rx="3" />`,
    `<rect x="0" y="${TITLE_HEIGHT - 3}" width="${WIDTH}" height="3" fill="${input.fill}" />`,
    `<text x="${PADDING_X}" y="${TITLE_HEIGHT / 2 + 4}" font-size="12" font-weight="700" font-family="sans-serif" fill="#ffffff">${escapeXml(truncate(input.name, 20))}</text>`,
    `<text x="${PADDING_X}" y="${TITLE_HEIGHT + STEREOTYPE_HEIGHT - 5}" font-size="9" font-style="italic" font-family="sans-serif" fill="#57606a">${escapeXml(`«${truncate(input.stereotype, 26)}»`)}</text>`,
    `<line x1="0" y1="${TITLE_HEIGHT + STEREOTYPE_HEIGHT}" x2="${WIDTH}" y2="${TITLE_HEIGHT + STEREOTYPE_HEIGHT}" stroke="#d0d7de" stroke-width="1" />`,
    rows,
    `</svg>`,
  ].join('');
}

/** Browser-safe base64 data URI (btoa on a UTF-8-safe escape, since SVG text
 *  may contain non-Latin1 characters from entity names/summaries). */
export function classBoxDataUri(input: ClassBoxInput): string {
  const svg = renderClassBoxSvg(input);
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}
