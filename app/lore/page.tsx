"use client";

import { AppShell } from "@/app/components/app-shell";
import { useT } from "@/lib/character-sheets/i18n";

export default function LorePage() {
  const { t } = useT();
  return (
    <AppShell sidebar={<div className="p-4 text-sm text-foreground/60">{t("nav.coming")}</div>}>
      <section className="flex h-full min-h-full items-center justify-center overflow-y-auto">
        <div className="text-center">
          <h1 className="text-3xl font-black">{t("nav.lore")}</h1>
          <p className="mt-2 text-sm text-foreground/60">{t("nav.coming")}</p>
        </div>
      </section>
    </AppShell>
  );
}
