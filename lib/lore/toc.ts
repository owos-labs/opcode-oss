import { getTableOfContents } from "fumadocs-core/content/toc";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import type { TOCItemType } from "fumadocs-core/toc";
import remarkGfm from "remark-gfm";

export type LoreTocItem = TOCItemType;

export async function getLoreTableOfContents(markdown: string): Promise<LoreTocItem[]> {
  return getTableOfContents(markdown, [remarkGfm, remarkHeading]);
}
