"use client";

import { useT } from "@/lib/character-sheets/i18n";
import type { LoreTocItem } from "@/lib/lore/toc";

export function LoreToc({ items }: { items: LoreTocItem[] }) {
  const { t } = useT();
  if (items.length === 0) return null;

  return (
    <aside className="max-xl:hidden min-h-0 w-72 shrink-0 overflow-y-auto px-4 py-5 scrollbar-subtle">
      <nav aria-label={t("lore.toc")}>
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-foreground/45">{t("lore.toc")}</p>
        <ul className="flex flex-col gap-1 border-l border-border1 pl-3">
          {items.map((item) => (
            <li key={item.url} style={{ paddingLeft: `${Math.max(0, item.depth - 2) * 0.65}rem` }}>
              <a
                href={item.url}
                className="block py-0.5 text-sm font-semibold leading-snug text-foreground/55 transition-colors hover:text-primary"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
