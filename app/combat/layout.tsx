"use client";

import type { ReactNode } from "react";

import { SheetAppProvider } from "@/app/components/sheet-app";

/** Same OPFS sheet list as /character-sheet (import, refresh, autosave). */
export default function CombatLayout({ children }: { children: ReactNode }) {
  return <SheetAppProvider>{children}</SheetAppProvider>;
}
