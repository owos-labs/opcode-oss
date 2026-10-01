"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/app/components/app-shell";
import { LoreSidebar } from "@/app/components/lore-sidebar";
import { loreLocaleDir, type LoreLocaleDir } from "@/lib/lore/config";
import type { LoreNode } from "@/lib/lore/tree";
import { useT } from "@/lib/character-sheets/i18n";

export function LoreShell({
  trees,
  children,
}: {
  trees: Record<LoreLocaleDir, LoreNode[]>;
  children: ReactNode;
}) {
  const { locale } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const loreDir = loreLocaleDir(locale);
  const tree = trees[loreDir];

  useEffect(() => {
    if (!pathname.startsWith("/lore")) return;
    router.refresh();
  }, [locale, pathname, router]);

  return (
    <AppShell plainMain sidebar={<LoreSidebar tree={tree} />}>
      {children}
    </AppShell>
  );
}
