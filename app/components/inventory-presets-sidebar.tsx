"use client";

import { Button } from "@heroui/react";
import { Modal } from "@heroui/react/modal";
import { ChevronDown, ChevronRight, PackagePlus, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";

import {
  ITEM_PRESET_CATEGORIES,
  ITEM_PRESET_DRAG_TYPE,
  groupItemPresets,
  ammoGroupsStartOpen,
  type ItemPreset,
  type ItemPresetCategory,
  type ItemPresetCategoryCounts,
} from "@/lib/character-sheets/item-presets.types";
import { Card } from "@/app/components/card";
import { ModalShortcutFooter } from "@/app/components/ui";
import { useT } from "@/lib/character-sheets/i18n";
import { resolveLocaleText } from "@/lib/character-sheets/locale-text";

const CATEGORY_KEYS: Record<ItemPresetCategory, string> = {
  items: "inventory.presets.category.items",
  melee: "inventory.presets.category.melee",
  ranged: "inventory.presets.category.ranged",
  attachments: "inventory.presets.category.attachments",
  ammo: "inventory.presets.category.ammo",
  magazines: "inventory.presets.category.magazines",
  throwable: "inventory.presets.category.throwable",
  armor: "inventory.presets.category.armor",
};

type PresetResponse = { items: ItemPreset[]; counts?: ItemPresetCategoryCounts };

const EMPTY_COUNTS = Object.fromEntries(ITEM_PRESET_CATEGORIES.map((value) => [value, 0])) as ItemPresetCategoryCounts;

export function InventoryPresetsSidebar({ onAdd }: { onAdd: (preset: ItemPreset) => void }) {
  const { locale, t } = useT();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ItemPresetCategory | null>(null);
  const [items, setItems] = useState<ItemPreset[]>([]);
  const [counts, setCounts] = useState<ItemPresetCategoryCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ItemPreset | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setLoading(true);
    });
    fetch(`/items?kwd=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<PresetResponse> : Promise.reject(new Error("preset request failed")))
      .then((payload) => {
        setItems(payload.items);
        setCounts(payload.counts || deriveCounts(payload.items));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setItems([]);
          setCounts(EMPTY_COUNTS);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const categoryRows = useMemo(
    () => ITEM_PRESET_CATEGORIES.map((value) => ({ value, label: t(CATEGORY_KEYS[value]), count: counts[value] })),
    [counts, t],
  );
  const categoryItems = category ? items.filter((item) => item.category === category) : [];

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(ITEM_PRESET_DRAG_TYPE);
    if (!raw) return;
    try {
      onAdd(JSON.parse(raw) as ItemPreset);
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  if (!open) {
    return (
      <Card as="aside" tone="secondary" radius="md" padding="sm" className="w-11 shrink-0 items-center !gap-0 !p-1">
        <Button variant="ghost" aria-label={t("inventory.presets.open")} className="size-9 min-w-9 p-0" onPress={() => setOpen(true)}>
          <PanelRightOpen className="size-4" />
        </Button>
      </Card>
    );
  }

  return (
    <Card
      as="aside"
      tone="secondary"
      radius="md"
      padding="none"
      className="min-h-0 w-full shrink-0 lg:w-72"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 border-b border-border2 p-3">
        <PackagePlus className="size-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{t("inventory.presets.title")}</h2>
          <p className="text-[11px] text-foreground/55">{t("inventory.presets.hint")}</p>
        </div>
        <Button variant="ghost" aria-label={t("inventory.presets.close")} className="size-9 min-w-9 p-0" onPress={() => setOpen(false)}>
          <PanelRightClose className="size-4" />
        </Button>
      </div>
      <label className="relative m-3 mb-2">
        <span className="sr-only">{t("inventory.search")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("inventory.search")}
          className="h-10 w-full rounded-lg border border-border1 bg-content3 pl-9 pr-3 text-sm shadow1 outline-none focus:border-primary focus:shadow-primary"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex flex-col gap-1">
          {categoryRows.map((row) => {
            const active = category === row.value;
            return (
              <div key={row.value}>
                <button
                  type="button"
                  className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-black ${active ? "bg-content3" : "hover:bg-content3/70"}`}
                  onClick={() => setCategory(active ? null : row.value)}
                >
                  {active ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  <span className="flex-1">{row.label} ({row.count})</span>
                </button>
                {active ? (
                  <div className="ml-5 border-l border-border2 pl-2">
                    {loading ? <p className="px-2 py-3 text-xs text-foreground/55">{t("inventory.presets.loading")}</p> : null}
                    {!loading && !categoryItems.length ? <p className="px-2 py-3 text-xs text-foreground/55">{t("inventory.presets.empty")}</p> : null}
                    {!loading ? groupItemPresets(row.value, categoryItems).map((group) => {
                      const rounds = group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          className="flex min-h-10 w-full items-center rounded-md px-2 text-left text-xs font-semibold hover:bg-content3"
                          onClick={() => setSelected(item)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(ITEM_PRESET_DRAG_TYPE, JSON.stringify(item));
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          <span className="truncate">{item.data.name}</span>
                        </button>
                      ));
                      if (!group.label) return <div key={row.value}>{rounds}</div>;
                      const searching = ammoGroupsStartOpen(query);
                      return (
                        <details key={`${group.label}:${searching ? "search" : "browse"}`} className="group/caliber" open={searching ? true : undefined}>
                          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-left text-xs font-black text-foreground/70 hover:bg-content3/70 [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="size-3.5 group-open/caliber:hidden" />
                            <ChevronDown className="hidden size-3.5 group-open/caliber:block" />
                            <span className="flex-1">{group.label} ({group.items.length})</span>
                          </summary>
                          <div className="ml-4 border-l border-border2 pl-1">{rounds}</div>
                        </details>
                      );
                    }) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <Modal isOpen={selected !== null} onOpenChange={(next) => { if (!next) setSelected(null); }}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={selected?.data.name || t("inventory.presets.title")} className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">{selected ? t(CATEGORY_KEYS[selected.category]) : ""}</p>
                <h2 className="mt-1 text-xl font-black">{selected?.data.name}</h2>
              </div>
              <p className="text-sm leading-6 text-foreground/75">
                {selected ? resolveLocaleText(selected.data.desc, locale) || t("inventory.presets.descriptionEmpty") : t("inventory.presets.descriptionEmpty")}
              </p>
              <Card as="pre" tone="secondary" radius="md" padding="sm" spotlight={false} className="max-h-48 overflow-auto text-xs text-foreground/70">{selected ? JSON.stringify(selected.data, null, 2) : ""}</Card>
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => setSelected(null)}
                confirmLabel={t("inventory.presets.add")}
                confirmVariant="primary"
                onConfirm={() => {
                  if (selected) onAdd(selected);
                  setSelected(null);
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Card>
  );
}

function deriveCounts(items: ItemPreset[]): ItemPresetCategoryCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const item of items) counts[item.category] += 1;
  return counts;
}
