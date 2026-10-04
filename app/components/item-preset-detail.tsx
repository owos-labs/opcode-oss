"use client";

import { useMemo, useState } from "react";

import { Card } from "@/app/components/card";
import {
  listItemPresetDetailRows,
  listItemPresetModifications,
  type ItemPresetDetailRow,
} from "@/lib/character-sheets/item-preset-detail";
import type { ItemPreset } from "@/lib/character-sheets/item-presets.types";
import type { Locale } from "@/lib/character-sheets/i18n";

type DetailView = "details" | "raw";

function resolveRowLabel(row: ItemPresetDetailRow, t: (key: string) => string): string {
  if (row.labelKey === "characterSheets.inventory.weapon.mode") {
    return row.value.split(", ").map((key) => t(key)).join(", ");
  }
  if (row.value.startsWith("characterSheets.")) return t(row.value);
  return row.value;
}

function ViewToggle({
  active,
  onChange,
  detailsLabel,
  rawLabel,
}: {
  active: DetailView;
  onChange: (view: DetailView) => void;
  detailsLabel: string;
  rawLabel: string;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border1 bg-content2 p-1">
      {(["details", "raw"] as const).map((view) => {
        const pressed = active === view;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={pressed}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-black transition-colors ${
              pressed ? "bg-content3 text-foreground shadow1" : "text-foreground/60 hover:text-foreground"
            }`}
            onClick={() => onChange(view)}
          >
            {view === "details" ? detailsLabel : rawLabel}
          </button>
        );
      })}
    </div>
  );
}

export function ItemPresetDetail({
  preset,
  locale,
  t,
}: {
  preset: ItemPreset;
  locale: Locale;
  t: (key: string) => string;
}) {
  const [view, setView] = useState<DetailView>("details");
  const [modIndex, setModIndex] = useState(0);
  const rows = useMemo(
    () => listItemPresetDetailRows(preset.category, preset.data, locale),
    [preset, locale],
  );
  const modifications = useMemo(
    () => listItemPresetModifications(preset.data, locale),
    [preset, locale],
  );
  const activeMod = modifications[modIndex] ?? null;

  return (
    <div className="flex flex-col gap-2">
      <ViewToggle
        active={view}
        onChange={setView}
        detailsLabel={t("inventory.presets.detailView")}
        rawLabel={t("inventory.presets.rawView")}
      />
      {view === "raw" ? (
        <Card as="pre" tone="secondary" radius="md" padding="sm" spotlight={false} className="max-h-48 overflow-auto text-xs text-foreground/70">
          {JSON.stringify(preset.data, null, 2)}
        </Card>
      ) : (
        <Card tone="secondary" radius="md" padding="sm" spotlight={false} className="max-h-48 overflow-auto">
          {rows.length ? (
            <dl className="grid grid-cols-[minmax(5rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">
              {rows.map((row) => (
                <div key={`${row.labelKey}:${row.value}`} className="contents">
                  <dt className="font-bold text-foreground/55">{t(row.labelKey)}</dt>
                  <dd className="font-semibold text-foreground/85">{resolveRowLabel(row, t)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-foreground/55">{t("inventory.presets.detailEmpty")}</p>
          )}
          {modifications.length ? (
            <div className="mt-3 border-t border-border2 pt-3">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-foreground/50">
                {t("characterSheets.inventory.modifications.title")}
              </p>
              {modifications.length > 1 ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {modifications.map((mod, index) => {
                    const pressed = modIndex === index;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        aria-pressed={pressed}
                        className={`rounded-md px-2 py-1 text-[11px] font-black transition-colors ${
                          pressed ? "bg-content3 text-foreground shadow1" : "text-foreground/60 hover:bg-content3/70 hover:text-foreground"
                        }`}
                        onClick={() => setModIndex(index)}
                      >
                        {mod.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {activeMod ? (
                <div className="text-xs text-foreground/75">
                  <p className="font-black text-foreground">{activeMod.name}</p>
                  <p className="mt-1 text-foreground/60">
                    {t(`characterSheets.inventory.modifications.slots.${activeMod.slot}`)}
                  </p>
                  {activeMod.description ? (
                    <p className="mt-2 leading-5">{activeMod.description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
