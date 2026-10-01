"use client";

import { createMarkdownRenderer } from "fumadocs-core/content/md";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import remarkGfm from "remark-gfm";

const { Markdown } = createMarkdownRenderer({ remarkPlugins: [remarkGfm, remarkHeading] });

export function LoreMarkdown({ source }: { source: string }) {
  return (
    <div className="lore-prose">
      <Markdown>{source}</Markdown>
    </div>
  );
}
