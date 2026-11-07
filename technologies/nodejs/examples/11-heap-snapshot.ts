// Minimal reader for V8 .heapsnapshot files (JSON). The format is flat:
//   snapshot.meta.node_fields   e.g. ["type","name","id","self_size","edge_count","trace_node_id","detachedness"]
//   snapshot.meta.node_types[0] the enum of node types (["hidden","array","string","object",...])
//   nodes                        one integer per field, node after node
//   strings                      the string table that "name" indexes into
interface Snapshot {
  snapshot: { meta: { node_fields: string[]; node_types: [string[], ...unknown[]] } };
  nodes: number[];
  strings: string[];
}

/** Count heap nodes of a given type ('object', 'closure', 'string', ...) grouped by constructor/name. */
export function countNodesByName(json: string, type: string): Map<string, number> {
  const snap = JSON.parse(json) as Snapshot;
  const fields = snap.snapshot.meta.node_fields;
  const types = snap.snapshot.meta.node_types[0];
  const stride = fields.length;
  const typeIdx = fields.indexOf('type');
  const nameIdx = fields.indexOf('name');
  const wanted = types.indexOf(type);
  const counts = new Map<string, number>();
  for (let i = 0; i < snap.nodes.length; i += stride) {
    if (snap.nodes[i + typeIdx] !== wanted) continue;
    const name = snap.strings[snap.nodes[i + nameIdx]!]!;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}
