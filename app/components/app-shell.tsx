"use client";

import { Button } from "@heroui/react";
import { Dropdown } from "@heroui/react/dropdown";
import { BookOpen, ChevronDown, Swords, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLogo } from "@/app/components/brand-logo";
import { Card } from "@/app/components/card";
import { ThemeSwitch } from "@/app/theme-switch";
import { LOCALES, useT, type Locale } from "@/lib/character-sheets/i18n";
import { loreGithubRepoUrl } from "@/lib/lore/config";
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
  plainMain = false,
}: {
  sidebar: ReactNode;
  children: ReactNode;
  plainMain?: boolean;
}) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useT();
  const sidebarKey = sidebarMotionKey(pathname);

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <header className="oc-fade flex shrink-0 items-center justify-between">
          <Card as="nav" radius="full" padding="sm" className="h-[3.25rem] flex-row items-center gap-1 !pl-4 !pr-2 !py-2 shadow2">
            <Link href="/character-sheet" className="flex shrink-0 items-center py-1" aria-label="Opcode">
              <BrandLogo height={32} />
            </Link>
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
          </Card>
          <Card radius="full" padding="sm" className="h-[3.25rem] flex-row items-center gap-1 shadow2">
            <Link
              href={loreGithubRepoUrl()}
              target="_blank"
              rel="noreferrer"
              aria-label={t("nav.github")}
              className="flex size-10 items-center justify-center rounded-full text-foreground/70 transition-colors duration-150 hover:text-foreground focus-visible:shadow-primary"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </Link>
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
          </Card>
        </header>

        <div className="flex min-h-0 flex-1 gap-4 max-lg:flex-col">
          <Card
            as="aside"
            tone="shell"
            radius="lg"
            padding="none"
            className="min-h-0 w-full shrink-0 overflow-hidden max-lg:max-h-[38vh] lg:h-full lg:w-72"
          >
            <div key={sidebarKey} className="oc-fade flex min-h-0 flex-1 flex-col overflow-hidden">
              {sidebar}
            </div>
          </Card>
          {plainMain ? (
            <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div key={pathname} className="oc-fade flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            </main>
          ) : (
            <Card
              as="main"
              tone="shell"
              radius="lg"
              padding="none"
              className="min-h-0 min-w-0 flex-1 overflow-hidden"
            >
              <div key={pathname} className="oc-fade flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}