"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/app/components/app-shell";
import { SheetAppProvider } from "@/app/components/sheet-app";
import { SheetSidebar } from "@/app/components/sidebars";
import { characterSheetId } from "@/lib/motion";

export default function CharacterSheetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <SheetAppProvider sheetId={characterSheetId(pathname)}>
      <AppShell sidebar={<SheetSidebar />}>{children}</AppShell>
    </SheetAppProvider>
  );
}
