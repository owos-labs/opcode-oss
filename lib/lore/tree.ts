export type LorePageNode = {
  type: "page";
  slug: string;
  title: string;
};

export type LoreFolderNode = {
  type: "folder";
  slug: string;
  title: string;
  children: LoreNode[];
};

export type LoreNode = LorePageNode | LoreFolderNode;

export function loreTitleFromFilename(filename: string): string {
  return filename.replace(/\.md$/i, "");
}

export function buildLoreTree(repoPaths: string[], localeDir: string): LoreNode[] {
  const prefix = `${localeDir}/`;
  const pages = repoPaths
    .filter(
      (path) =>
        path.startsWith(prefix) &&
        path.endsWith(".md") &&
        path !== `${localeDir}/README.md` &&
        !path.endsWith("/README.md"),
    )
    .map((path) => path.slice(prefix.length))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  const root: LoreNode[] = [];

  for (const relativePath of pages) {
    const segments = loreTitleFromFilename(relativePath).split("/");
    let level = root;
    let slugPrefix = "";

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      slugPrefix = slugPrefix ? `${slugPrefix}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        level.push({ type: "page", slug: slugPrefix, title: segment });
        continue;
      }

      let folder = level.find(
        (node): node is LoreFolderNode => node.type === "folder" && node.slug === slugPrefix,
      );
      if (!folder) {
        folder = { type: "folder", slug: slugPrefix, title: segment, children: [] };
        level.push(folder);
      }
      level = folder.children;
    }
  }

  return root;
}

export function firstLoreSlug(tree: LoreNode[]): string | null {
  for (const node of tree) {
    if (node.type === "page") return node.slug;
    const nested = firstLoreSlug(node.children);
    if (nested) return nested;
  }
  return null;
}

export function loreHref(slug: string): string {
  return `/lore/${slug.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

export function loreSlugFromParams(slug: string[] | undefined): string | null {
  if (!slug?.length) return null;
  return slug.map((part) => decodeURIComponent(part)).join("/");
}

export function loreNodeActive(node: LoreNode, pathname: string): boolean {
  if (node.type === "page") {
    const href = loreHref(node.slug);
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return node.children.some((child) => loreNodeActive(child, pathname));
}
