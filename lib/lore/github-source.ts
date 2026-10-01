import { cache } from "react";

import { LORE_GITHUB, type LoreLocaleDir } from "./config";
import { buildLoreTree, type LoreNode } from "./tree";

type GitHubTreeResponse = {
  tree: Array<{ path: string; type: string }>;
};

const REVALIDATE_SECONDS = 300;

const getRepoPaths = cache(async (): Promise<string[]> => {
  const url = `https://api.github.com/repos/${LORE_GITHUB.owner}/${LORE_GITHUB.repo}/git/trees/${LORE_GITHUB.branch}?recursive=1`;
  const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) {
    throw new Error(`GitHub tree fetch failed (${response.status})`);
  }

  const data = (await response.json()) as GitHubTreeResponse;
  return data.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path);
});

export const getLoreChapterTree = cache(async (localeDir: LoreLocaleDir): Promise<LoreNode[]> => {
  const paths = await getRepoPaths();
  return buildLoreTree(paths, localeDir);
});

export async function getLoreMarkdown(localeDir: LoreLocaleDir, slug: string): Promise<string | null> {
  const path = `${localeDir}/${slug}.md`;
  const url = `https://raw.githubusercontent.com/${LORE_GITHUB.owner}/${LORE_GITHUB.repo}/${LORE_GITHUB.branch}/${path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;

  const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub content fetch failed (${response.status})`);
  }
  return response.text();
}

export function loreGithubEditUrl(localeDir: LoreLocaleDir, slug: string): string {
  const path = `${localeDir}/${slug}.md`;
  return `https://github.com/${LORE_GITHUB.owner}/${LORE_GITHUB.repo}/edit/${LORE_GITHUB.branch}/${path}`;
}
