"use client";

import { ChevronDown, FileText, Layers, Puzzle, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { loreGroupLabel } from "@/lib/lore/group-label";
import { loreNavIconKind, type LoreNavIconKind } from "@/lib/lore/nav-icon";
import { filterLoreTree } from "@/lib/lore/search";
import { loreHref, loreNodeActive, type LoreNode } from "@/lib/lore/tree";
import { useT } from "@/lib/character-sheets/i18n";

const LORE_NAV_ICONS: Record<LoreNavIconKind, LucideIcon> = {
  chapter: FileText,
  group: Layers,
  extension: Puzzle,
};

function navClass(active: boolean) {
  return `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
    active ? "bg-content3 text-foreground shadow1" : "text-foreground/60 hover:bg-content2 hover:text-foreground"
  }`;
}

function LoreNavIcon({ kind }: { kind: LoreNavIconKind }) {
  const Icon = LORE_NAV_ICONS[kind];
  return <Icon className="size-4 shrink-0 text-foreground/45" aria-hidden />;
}

function LoreNavItem({
  node,
  pathname,
  forceOpen,
}: {
  node: LoreNode;
  pathname: string;
  forceOpen: boolean;
}) {
  const { t } = useT();

  if (node.type === "page") {
    const href = loreHref(node.slug);
    const active = loreNodeActive(node, pathname);
    return (
      <Link href={href} className={navClass(active)}>
        <LoreNavIcon kind={loreNavIconKind(node)} />
        <span className="min-w-0 truncate">{node.title}</span>
      </Link>
    );
  }

  const open = forceOpen || loreNodeActive(node, pathname);

  return (
    <details open={open || undefined} className="group rounded-lg">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-black transition-colors duration-150 hover:bg-content2 [&::-webkit-details-marker]:hidden ${
          open ? "text-foreground" : "text-foreground/70"
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <LoreNavIcon kind={loreNavIconKind(node)} />
          <span className="truncate">{loreGroupLabel(node.slug, t)}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-0.5 pb-1 pl-2 pt-0.5">
        {node.children.map((child) => (
          <LoreNavItem key={child.slug} node={child} pathname={pathname} forceOpen={forceOpen} />
        ))}
      </div>
    </details>
  );
}

export function LoreSidebar({ tree }: { tree: LoreNode[] }) {
  const pathname = usePathname();
  const { t } = useT();
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const filteredTree = useMemo(
    () => filterLoreTree(tree, query, (slug) => loreGroupLabel(slug, t)),
    [tree, query, t],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">{t("lore.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("lore.search")}
            className="h-10 w-full rounded-lg border border-border1 bg-content3 pl-9 pr-3 text-sm shadow1 outline-none focus:border-primary focus:shadow-primary"
          />
        </label>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3 scrollbar-subtle">
        {searching && filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-foreground/60">{t("lore.searchEmpty")}</p>
        ) : (
          filteredTree.map((node) => (
            <LoreNavItem key={node.slug} node={node} pathname={pathname} forceOpen={searching} />
          ))
        )}
      </nav>
    </div>
  );
}
