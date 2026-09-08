// Entity id <-> Mermaid node id mapping (specs.md §6.5). Injective and
// reversible because EntityId is constrained to lowercase alnum segments
// joined by hyphens only (types.ts) — underscore never appears in a real id,
// so substituting it for '-' is lossless.
import type { EntityId } from '../model/types.js';

export function toNodeId(id: EntityId): string {
  return `n_${id.replace(/-/g, '_')}`;
}

export function fromNodeId(nodeId: string): EntityId {
  if (!nodeId.startsWith('n_')) {
    throw new Error(`not a mermaid node id: '${nodeId}' (expected an 'n_' prefix)`);
  }
  return nodeId.slice(2).replace(/_/g, '-');
}

/** Mermaid label text must not contain unescaped double quotes. */
export function quoteLabel(text: string): string {
  return `"${text.replace(/"/g, '#quot;')}"`;
}
