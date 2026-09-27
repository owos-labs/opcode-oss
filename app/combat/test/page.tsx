"use client";

import { AppShell } from "@/app/components/app-shell";
import { CombatBenchWorkbench } from "@/app/components/combat-bench-workbench";
import { CombatSidebar } from "@/app/components/combat-sidebar";
import { useT } from "@/lib/character-sheets/i18n";

export default function CombatTestPage() {
  const { t } = useT();

  return (
    <AppShell sidebar={<CombatSidebar />}>
      <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-2 sm:p-4">
        <header className="shrink-0">
          <h1 className="text-2xl font-black sm:text-3xl">{t("combat.test.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-foreground/60">{t("combat.bench.lead")}</p>
        </header>
        <CombatBenchWorkbench />
      </section>
    </AppShell>
  );
}
