export const LORE_GITHUB = {
  owner: "owos-labs",
  repo: "Opcode-D10",
  branch: "main",
} as const;

export type LoreLocaleDir = "cn" | "en";

export function loreLocaleDir(locale: string): LoreLocaleDir {
  return locale === "zh" ? "cn" : "en";
}

export function loreGithubRepoUrl(): string {
  return `https://github.com/${LORE_GITHUB.owner}/${LORE_GITHUB.repo}`;
}
