"use client";

import Link from "next/link";

import { AppShell } from "@/app/components/app-shell";
import { useCombatEditorMeta } from "@/app/components/combat-app";
import { CombatMapEditor } from "@/app/components/combat-map-editor";
import { CombatSidebar } from "@/app/components/combat-sidebar";
import { useT } from "@/lib/character-sheets/i18n";

export default function CombatEditorPage() {
  const { t } = useT();
  const { mapMissing, mapLoading } = useCombatEditorMeta();

  if (mapMissing) {
    return (
      <AppShell sidebar={<CombatSidebar />}>
        <section className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-foreground/60">{t("combat.editor.notFound")}</p>
          <Link href="/combat" className="text-sm font-semibold text-primary">
            {t("combat.editor.back")}
          </Link>
        </section>
      </AppShell>
    );
  }

  if (mapLoading) {
    return (
      <AppShell sidebar={<CombatSidebar />}>
        <section className="flex flex-1 items-center justify-center p-8 text-sm text-foreground/50">
          {t("combat.list.loading")}
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell plainMain sidebar={<CombatSidebar />}>
      <div className="relative h-full min-h-0 overflow-hidden">
        <CombatMapEditor />
      </div>
    </AppShell>
  );
}
