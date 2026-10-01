import type { LoreNode } from "./tree";

function loreMatchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function filterLoreTree(
  tree: LoreNode[],
  query: string,
  groupLabel: (slug: string) => string,
): LoreNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  const filter = (nodes: LoreNode[]): LoreNode[] => {
    const out: LoreNode[] = [];

    for (const node of nodes) {
      if (node.type === "page") {
        if (loreMatchesQuery(node.title, q) || loreMatchesQuery(node.slug, q)) {
          out.push(node);
        }
        continue;
      }

      const label = groupLabel(node.slug);
      const children = filter(node.children);
      if (loreMatchesQuery(label, q) || loreMatchesQuery(node.slug, q) || children.length > 0) {
        out.push({ ...node, children });
      }
    }

    return out;
  };

  return filter(tree);
}
