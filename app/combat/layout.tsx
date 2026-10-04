"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CombatAppProvider } from "@/app/components/combat-app";
import { SheetAppProvider } from "@/app/components/sheet-app";
import { combatMapId } from "@/lib/motion";

/** Same OPFS sheet list as /character-sheet (import, refresh, autosave). */
export default function CombatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SheetAppProvider>
      <CombatAppProvider mapId={combatMapId(pathname)}>{children}</CombatAppProvider>
    </SheetAppProvider>
  );
}
