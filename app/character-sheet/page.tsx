"use client";

import { BrandMark } from "@/app/components/brand-logo";
import { useSheetApp } from "@/app/components/sheet-app";
import { Notice } from "@/app/components/ui";
import { useT } from "@/lib/character-sheets/i18n";

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
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <BrandMark lines={[t("characterSheets.list.heroLine1"), t("characterSheets.list.heroLine2")]} />
      </div>
    </section>
  );
}
