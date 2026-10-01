"use client";

import Link from "next/link";

import { LoreMarkdown } from "@/app/components/lore-markdown";
import { LoreToc } from "@/app/components/lore-toc";
import { loreGithubRepoUrl } from "@/lib/lore/config";
import { useT } from "@/lib/character-sheets/i18n";
import { loreMetaLabelKey, type LoreFrontmatter } from "@/lib/lore/markdown";
import type { LoreTocItem } from "@/lib/lore/toc";

export function LorePageClient({
  title,
  markdown,
  frontmatter,
  toc,
}: {
  title: string;
  markdown: string;
  frontmatter: LoreFrontmatter;
  toc: LoreTocItem[];
}) {
  const { t } = useT();
  const meta = Object.entries(frontmatter);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border1 px-6 py-4">
        <div className="flex w-full items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-black">{title}</h1>
            {meta.length > 0 ? (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/55">
                {meta.map(([key, value]) => {
                  const labelKey = loreMetaLabelKey(key);
                  const label = labelKey.startsWith("lore.") ? t(labelKey) : labelKey;
                  return (
                    <div key={key} className="flex gap-1">
                      <dt className="font-semibold">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
          </div>
          <Link
            href={loreGithubRepoUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border1 bg-content3 px-4 text-xs font-bold shadow1 transition-colors duration-150 hover:bg-content2"
          >
            <GitHubIcon className="size-4" />
            {t("lore.contribute")}
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 scrollbar-subtle">
          <div className="mx-auto w-full max-w-3xl">
            <LoreMarkdown source={markdown} />
          </div>
        </div>
        <LoreToc items={toc} />
      </div>
    </section>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
