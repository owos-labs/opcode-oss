"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AppShell } from "@/app/components/app-shell";
import { useCombatList } from "@/app/components/combat-app";
import { CombatSidebar } from "@/app/components/combat-sidebar";
import { Card } from "@/app/components/card";
import { mapSizeLabel } from "@/lib/combat/combat-map-document";
import { useT } from "@/lib/character-sheets/i18n";

export default function CombatPage() {
  const { t } = useT();
  const { ready, maps, listQuery } = useCombatList();

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase();
    if (!q) return maps;
    return maps.filter((map) => map.title.toLocaleLowerCase().includes(q));
  }, [listQuery, maps]);

  return (
    <AppShell sidebar={<CombatSidebar />}>
      <section className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-subtle">
        <header>
          <h1 className="text-2xl font-black">{t("combat.overview.heroLine1")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/60">{t("combat.overview.lead")}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {!ready ? (
            <p className="text-sm text-foreground/50">{t("combat.list.loading")}</p>
          ) : filtered.length === 0 ? (
            <Card padding="md" className="sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-foreground/60">{t("combat.list.emptyHint")}</p>
            </Card>
          ) : (
            filtered.map((map) => (
              <Link key={map.id} href={`/combat/${map.id}`}>
                <Card padding="md" className="h-full transition-colors hover:bg-content2">
                  <p className="font-semibold">{map.title}</p>
                  <p className="mt-1 text-xs text-foreground/50">
                    {mapSizeLabel(map.svg)}
                    {" · "}
                    {map.inCombat ? t("combat.list.inCombat") : t("combat.list.idle")}
                  </p>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
