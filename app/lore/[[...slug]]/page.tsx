import { notFound, redirect } from "next/navigation";

import { LorePageClient } from "@/app/components/lore-page-client";
import { getLoreChapterTree, getLoreMarkdown } from "@/lib/lore/github-source";
import { getServerLoreLocaleDir } from "@/lib/lore/locale";
import { parseMarkdownFrontmatter } from "@/lib/lore/markdown";
import { getLoreTableOfContents } from "@/lib/lore/toc";
import { firstLoreSlug, loreHref, loreSlugFromParams, loreTitleFromFilename } from "@/lib/lore/tree";

type LorePageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function LorePage({ params }: LorePageProps) {
  const localeDir = await getServerLoreLocaleDir();
  const { slug: slugParts } = await params;
  const slug = loreSlugFromParams(slugParts);
  const tree = await getLoreChapterTree(localeDir);

  if (!slug) {
    const first = firstLoreSlug(tree);
    if (!first) notFound();
    redirect(loreHref(first));
  }

  const markdown = await getLoreMarkdown(localeDir, slug);
  if (!markdown) {
    const first = firstLoreSlug(tree);
    if (!first) notFound();
    redirect(loreHref(first));
  }

  const title = loreTitleFromFilename(slug.split("/").at(-1) ?? slug);
  const { frontmatter, content } = parseMarkdownFrontmatter(markdown);
  const toc = await getLoreTableOfContents(content);

  return (
    <LorePageClient title={title} frontmatter={frontmatter} markdown={content} toc={toc} />
  );
}
