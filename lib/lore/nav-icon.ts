import type { LoreNode } from "./tree";

export type LoreNavIconKind = "chapter" | "group" | "extension";

export function loreNavIconKind(node: LoreNode): LoreNavIconKind {
  if (node.type === "folder") return "group";
  if (node.slug.startsWith("extensions/")) return "extension";
  return "chapter";
}
