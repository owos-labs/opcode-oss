"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/character-sheets/i18n";

const LINKS = [
  { href: "/combat", key: "combat.nav.overview" as const },
  { href: "/combat/test", key: "combat.nav.test" as const },
] as const;

function linkClass(active: boolean) {
  return `block rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
  }`;
}

export function CombatSidebar() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {t("nav.combat")}
      </p>
      <nav className="flex flex-col gap-1">
        {LINKS.map((item) => {
          const active =
            item.href === "/combat"
              ? pathname === "/combat"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={linkClass(active)}>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
