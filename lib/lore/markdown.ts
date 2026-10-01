export type LoreFrontmatter = Record<string, string>;

export function parseMarkdownFrontmatter(source: string): { frontmatter: LoreFrontmatter; content: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, content: source };

  const frontmatter: LoreFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (!key) continue;
    frontmatter[key] = raw.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
  }

  return { frontmatter, content: source.slice(match[0].length).replace(/^\s+/, "") };
}

export function stripMarkdownFrontmatter(source: string): string {
  return parseMarkdownFrontmatter(source).content;
}

const META_LABEL_KEYS: Record<string, string> = {
  by: "lore.meta.by",
  last_updated: "lore.meta.lastUpdated",
};

export function loreMetaLabelKey(key: string): string {
  return META_LABEL_KEYS[key] ?? key;
}
