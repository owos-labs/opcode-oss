"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/app/components/brand-logo";
import { useSheetApp } from "@/app/components/sheet-app";
import { Notice } from "@/app/components/ui";
import { useT } from "@/lib/character-sheets/i18n";
import { loreGithubRepoUrl } from "@/lib/lore/config";

const heroLinkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border border-border1 bg-content3 px-4 text-sm font-semibold shadow1 transition-colors duration-150 hover:bg-content2";

export default function CharacterSheetIndexPage() {
  const { t } = useT();
  const { ready, loadError, retryLoad } = useSheetApp();

  if (!ready) {
    return (
      <section className="flex h-full items-center justify-center p-6 text-sm text-foreground/60">
        {t("characterSheets.list.loading")}
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="flex h-full items-center justify-center p-6">
        <Notice
          title={t("characterSheets.list.failedTitle")}
          description={t("characterSheets.list.errorDescription")}
          action={
            <button
              type="button"
              className="min-h-11 rounded-lg border border-error bg-content3 px-4 text-sm font-semibold text-error"
              onClick={() => void retryLoad()}
            >
              {t("characterSheets.list.retry")}
            </button>
          }
        />
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-4 scrollbar-subtle">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        <BrandMark lines={[t("characterSheets.list.heroLine1"), t("characterSheets.list.heroLine2")]} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={loreGithubRepoUrl()} target="_blank" rel="noreferrer" className={heroLinkClass}>
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {t("characterSheets.list.github")}
          </Link>
          <Link href="/lore" className={heroLinkClass}>
            <BookOpen className="size-4" />
            {t("characterSheets.list.openRules")}
          </Link>
        </div>
      </div>
    </section>
  );
}
