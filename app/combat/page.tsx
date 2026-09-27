"use client";

import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import { CombatSidebar } from "@/app/components/combat-sidebar";
import { useT } from "@/lib/character-sheets/i18n";

export default function CombatPage() {
  const { t } = useT();
  return (
    <AppShell sidebar={<CombatSidebar />}>
      <section className="flex h-full min-h-full items-center justify-center overflow-y-auto p-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-black">{t("nav.combat")}</h1>
          <p className="mt-2 text-sm text-foreground/60">{t("combat.overview.lead")}</p>
          <Link
            href="/combat/test"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-background"
          >
            {t("combat.nav.test")}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
