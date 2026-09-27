"use client";

import { Button } from "@heroui/react";
import { Dropdown } from "@heroui/react/dropdown";
import { BookOpen, ChevronDown, Swords, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeSwitch } from "@/app/theme-switch";
import { LOCALES, useT, type Locale } from "@/lib/character-sheets/i18n";
import { sidebarMotionKey } from "@/lib/motion";

const NAV = [
  { href: "/combat", key: "nav.combat", icon: Swords },
  { href: "/character-sheet", key: "nav.sheets", icon: Users },
  { href: "/lore", key: "nav.lore", icon: BookOpen },
] as const;

const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  ja: "日本語",
};

function chip(active: boolean) {
  return `flex h-10 items-center gap-2 rounded-[9999px] px-4 text-sm font-semibold transition-colors duration-150 ${
    active ? "bg-primary text-background" : "text-foreground/70 hover:text-foreground"
  }`;
}

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useT();
  const sidebarKey = sidebarMotionKey(pathname);

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header className="oc-fade flex shrink-0 items-center justify-between">
          <nav className="oc-pill-card">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={chip(active)}>
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{t(item.key)}</span>
                </Link>
              );
            })}
          </nav>
          <div className="oc-pill-card">
            <ThemeSwitch />
            <Dropdown>
              <Button variant="ghost" className="h-10 gap-2 rounded-full px-3 font-semibold" aria-label={t("locale.language")}>
                {LOCALE_LABEL[locale]}
                <ChevronDown className="size-4" />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  aria-label={t("locale.language")}
                  onAction={(key) => {
                    const next = String(key);
                    if ((LOCALES as readonly string[]).includes(next)) setLocale(next as Locale);
                  }}
                >
                  {LOCALES.map((code) => (
                    <Dropdown.Item key={code} id={code} textValue={LOCALE_LABEL[code]}>
                      {LOCALE_LABEL[code]}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-4 max-lg:flex-col">
          <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border1 bg-content1 shadow1 max-lg:max-h-[38vh] lg:h-full lg:w-72">
            <div key={sidebarKey} className="oc-fade flex min-h-0 flex-1 flex-col overflow-hidden">
              {sidebar}
            </div>
          </aside>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border1 bg-content1 shadow1">
            <div key={pathname} className="oc-fade flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}