"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { Card, Notice } from "@/app/components/ui";
import { useT, type Locale } from "@/lib/character-sheets/i18n";
import { sheetListLabel, type OpcodeLocalSheet, type SheetMode } from "@/lib/character-sheets/model";

function relativeTime(iso: string, locale: Locale) {
  const deltaSec = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "zh" ? "zh-CN" : locale, { numeric: "auto" });
  const abs = Math.abs(deltaSec);
  if (abs < 60) return rtf.format(Math.round(-deltaSec), "second");
  if (abs < 3600) return rtf.format(Math.round(-deltaSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(-deltaSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(-deltaSec / 86400), "day");
  return rtf.format(Math.round(-deltaSec / 86400 / 30), "month");
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function matches(sheet: OpcodeLocalSheet, query: string, mode: "all" | SheetMode) {
  if (mode !== "all" && sheet.mode !== mode) return false;
  return sheetListLabel(sheet).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export default function CharacterSheetIndexPage() {
  const { t, locale } = useT();
  const { ready, loadError, retryLoad, sheets, listQuery, listMode } = useSheetApp();
  const visible = useMemo(
    () => sheets.filter((sheet) => matches(sheet, listQuery, listMode)),
    [listMode, listQuery, sheets],
  );

  if (!ready) {
    return (
      <section className="flex h-full items-center justify-center p-6 text-sm text-foreground/60">
        {t("characterSheets.list.loading")}
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="flex h-full items-center justify-center p-6">
        <Notice
          title={t("characterSheets.list.failedTitle")}
          description={t("characterSheets.list.errorDescription")}
          action={
            <button
              type="button"
              className="min-h-11 rounded-lg border border-error bg-content3 px-4 text-sm font-semibold text-error"
              onClick={() => void retryLoad()}
            >
              {t("characterSheets.list.retry")}
            </button>
          }
        />
      </section>
    );
  }

  const emptyLibrary = sheets.length === 0;
  const noResults = !emptyLibrary && visible.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-4 scrollbar-subtle">
      <div className="mb-4">
        <h1 className="text-3xl font-black">{t("list.title")}</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {emptyLibrary
            ? t("characterSheets.list.emptyDescription")
            : noResults
              ? t("characterSheets.list.searchEmptyHint")
              : t("list.count", { count: visible.length })}
        </p>
      </div>
      {emptyLibrary ? (
        <Notice
          tone="muted"
          title={t("characterSheets.list.emptyTitle")}
          description={t("characterSheets.list.emptyDescription")}
        />
      ) : noResults ? (
        <Notice
          tone="muted"
          title={t("characterSheets.list.noSearchResults")}
          description={t("characterSheets.list.searchEmptyHint")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((sheet) => {
            const label = sheetListLabel(sheet);
            return (
              <li key={sheet.id}>
                <Link href={`/character-sheet/${sheet.id}/basics`} className="block h-full">
                  <Card className="flex h-full items-center gap-3 p-4 transition-colors duration-150 hover:bg-content2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border1 bg-content2 font-black">
                      {initials(label)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-black">{label}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-sm text-foreground/60">
                        {sheet.info.base.handle ? (
                          <span className="truncate">{sheet.info.base.handle}</span>
                        ) : null}
                        <span className="shrink-0 rounded-full border border-border1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                          {t(`mode.${sheet.mode}`)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-xs">
                          {relativeTime(sheet.updated_at, locale)}
                        </span>
                      </span>
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
