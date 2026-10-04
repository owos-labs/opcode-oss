"use client";

import {
  ArrowLeft,
  Brain,
  Clover,
  Dumbbell,
  GripVertical,
  Layers,
  Package,
  Plus,
  Search,
  Shield,
  Sparkles,
  Upload,
  UserRound,
  Zap,
} from "lucide-react";
import { Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import { Dropdown } from "@heroui/react/dropdown";
import { Modal } from "@heroui/react/modal";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, type DragEvent } from "react";

import { Card } from "@/app/components/card";
import { useSheetApp } from "@/app/components/sheet-app";
import { ModalShortcutFooter, Stepper, TextField } from "@/app/components/ui";
import { OPCODE_STAT_KEYS, type OpcodeStatKey } from "@/lib/character-sheets/characterSheet.types";
import { characterSheetSection, characterSidebar } from "@/lib/motion";
import { useT } from "@/lib/character-sheets/i18n";
import { sheetListLabel, type OpcodeLocalSheet, type SheetMode } from "@/lib/character-sheets/model";

const FILTERS: Array<"all" | SheetMode> = ["all", "create", "career"];
const DRAG_SHEET = "application/x-opcode-sheet";

function matches(sheet: OpcodeLocalSheet, query: string, mode: "all" | SheetMode) {
  if (mode !== "all" && sheet.mode !== mode) return false;
  return sheetListLabel(sheet).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

const STAT_ICONS: Record<OpcodeStatKey, LucideIcon> = {
  ref: Zap,
  int: Brain,
  wil: Shield,
  chr: Sparkles,
  bod: Dumbbell,
  luk: Clover,
};

export function ListSidebar() {
  const { t } = useT();
  const router = useRouter();
  const {
    ready,
    sheets,
    createSheet,
    importText,
    importError,
    clearImportError,
    listQuery,
    setListQuery,
    listMode,
    setListMode,
    updateSheetGroup,
    duplicateSheetById,
    removeSheetById,
    groups,
    createGroup,
  } = useSheetApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [dragging, setDragging] = useState(false);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState<{ id: string | null } | null>(null);
  const [groupName, setGroupName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OpcodeLocalSheet | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sheet: OpcodeLocalSheet } | null>(null);
  const groupNames = useMemo(
    () => [...new Set([...groups, ...sheets.map((entry) => entry.group.trim()).filter(Boolean)])],
    [groups, sheets],
  );
  const filtered = useMemo(
    () => sheets.filter((entry) => {
      const group = entry.group.trim();
      const groupMatches = !groupFilter || (groupFilter === "__none__" ? !group : group === groupFilter);
      return matches(entry, listQuery, listMode) && groupMatches;
    }),
    [groupFilter, listMode, listQuery, sheets],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, OpcodeLocalSheet[]>();
    filtered.forEach((entry) => {
      const group = entry.group.trim();
      groups.set(group, [...(groups.get(group) || []), entry]);
    });
    return [...groups.entries()];
  }, [filtered]);

  function openNewGroup(id: string | null, current: string) {
    setGroupName(current);
    setNewGroup({ id });
  }

  function saveNewGroup() {
    if (!newGroup || !groupName.trim()) return;
    createGroup(groupName);
    if (newGroup.id) void updateSheetGroup(newGroup.id, groupName);
    setNewGroup(null);
    setGroupName("");
  }

  function dropOnGroup(event: DragEvent<HTMLElement>, group: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_SHEET);
    setDragOverGroup(null);
    if (!id) return;
    const entry = sheets.find((sheet) => sheet.id === id);
    if (entry && entry.group.trim() !== group) void updateSheetGroup(id, group);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" onClick={() => setContextMenu(null)}>
      <div className="flex flex-col gap-3 px-3 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">{t("list.title")}</h2>
            <p className="text-xs text-foreground/55">{t("list.count", { count: sheets.length })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Dropdown>
              <Button size="sm" variant="primary" aria-label={t("list.new")} title={t("list.newHint")} className="size-9 min-w-9 p-0">
                <Plus className="size-4" />
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  aria-label={t("list.new")}
                  onAction={async (key) => {
                    if (key === "group") openNewGroup(null, "");
                    if (key === "sheet") {
                      const sheet = await createSheet();
                      router.push(`/character-sheet/${sheet.id}/basics`);
                    }
                  }}
                >
                  <Dropdown.Item id="sheet" textValue={t("list.new")}>{t("list.new")}</Dropdown.Item>
                  <Dropdown.Item id="group" textValue={t("list.groupNew")}>{t("list.groupNew")}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
            <button
              type="button"
              aria-label={t("list.import")}
              title={t("list.importHint")}
              className="flex size-9 items-center justify-center rounded-lg border border-border1 bg-content3 shadow1 transition-colors duration-150 hover:bg-content2 focus-visible:shadow-primary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.md,.txt,application/json,text/markdown"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const sheet = await importText(await file.text());
          event.target.value = "";
          if (sheet) router.push(`/character-sheet/${sheet.id}/basics`);
        }}
      />
      <div className="flex items-center gap-2 px-3 pt-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("list.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            placeholder={t("list.search")}
            className="h-11 w-full rounded-lg border border-border1 bg-content3 pl-9 pr-3 text-sm shadow1 outline-none focus:border-primary focus:shadow-primary"
          />
        </label>
        <select
          value={groupFilter}
          onChange={(event) => setGroupFilter(event.target.value)}
          aria-label={t("list.group")}
          className="h-11 w-28 shrink-0 rounded-lg border border-border1 bg-content3 px-2 text-xs font-semibold shadow1 outline-none focus:border-primary focus:shadow-primary"
        >
          <option value="">{t("list.groupAll")}</option>
          <option value="__none__">{t("list.groupNone")}</option>
          {groupNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <nav className="grid grid-cols-3 gap-1 p-3 pb-2 lg:flex lg:flex-col" aria-label={t("characterSheets.list.filterLabel")}>
        {FILTERS.map((value) => {
          const count = value === "all" ? sheets.length : sheets.filter((entry) => entry.mode === value).length;
          const label = value === "all" ? t("characterSheets.list.filterAll") : t(`mode.${value}`);
          const active = listMode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              className={`flex min-h-11 min-w-0 items-center justify-between gap-1 rounded-lg px-2 text-left transition-colors duration-150 lg:min-h-14 lg:px-3 ${
                active ? "bg-content3 text-foreground shadow1" : "text-foreground/60 hover:bg-content2 hover:text-foreground"
              }`}
              onClick={() => setListMode(value)}
            >
              <span className="truncate text-xs font-black lg:text-lg">{label}</span>
              <span className="font-mono text-[10px] text-foreground/45">{count}</span>
            </button>
          );
        })}
      </nav>
      {importError ? (
        <p className="px-3 pb-2 text-sm text-error">
          {t("list.importFailed")}{" "}
          <button type="button" className="font-semibold underline" onClick={clearImportError}>
            {t("common.close")}
          </button>
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scrollbar-subtle">
        {!ready ? (
          <p className="px-2 py-6 text-sm text-foreground/60">{t("characterSheets.list.loading")}</p>
        ) : grouped.length === 0 ? (
          <p className="px-2 py-6 text-sm text-foreground/60">
            {sheets.length ? t("characterSheets.list.noSearchResults") : t("characterSheets.list.emptyTitle")}
          </p>
        ) : (
          grouped.map(([group, entries]) => (
            <section
              key={group || "ungrouped"}
              className={`mb-4 rounded-lg last:mb-0 ${dragOverGroup === group ? "bg-primary/10 ring-1 ring-primary" : ""}`}
              onDragEnter={() => setDragOverGroup(group)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverGroup(null);
              }}
              onDrop={(event) => dropOnGroup(event, group)}
            >
              <div className="flex items-center gap-2 px-2 pb-1.5 pt-2">
                <h3 className="truncate text-[11px] font-black uppercase tracking-wide text-foreground/45">
                  {group || t("list.groupNone")}
                </h3>
                <span className="font-mono text-[10px] text-foreground/35">{entries.length}</span>
                {dragging ? <span className="ml-auto text-[10px] text-foreground/35">{t("list.groupDropHint")}</span> : null}
              </div>
              <ul className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <div
                      draggable
                      aria-grabbed={dragOverGroup !== null ? undefined : false}
                      className="flex cursor-grab items-center gap-1 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-content2 active:cursor-grabbing"
                      onDragStart={(event) => {
                        setDragging(true);
                        event.dataTransfer.setData(DRAG_SHEET, entry.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragging(false);
                        setDragOverGroup(null);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextMenu({ x: event.clientX, y: event.clientY, sheet: entry });
                      }}
                    >
                      <GripVertical className="size-4 shrink-0 text-foreground/30" aria-hidden />
                      <Link href={`/character-sheet/${entry.id}/basics`} className="min-w-0 flex-1 py-1">
                        <span className="block truncate text-sm font-black">{sheetListLabel(entry)}</span>
                        <span className="block truncate text-[11px] text-foreground/50">{t(`mode.${entry.mode}`)}</span>
                      </Link>
                      <select
                        value={entry.group.trim()}
                        aria-label={`${t("list.group")}: ${sheetListLabel(entry)}`}
                        className="h-8 max-w-20 rounded-md border border-border1 bg-content3 px-1 text-[10px] outline-none focus:border-primary"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "__new__") {
                            openNewGroup(entry.id, entry.group.trim());
                          } else {
                            void updateSheetGroup(entry.id, value);
                          }
                        }}
                      >
                        <option value="">{t("list.groupNone")}</option>
                        {groupNames.map((name) => <option key={name} value={name}>{name}</option>)}
                        <option value="__new__">{t("list.groupNew")}</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {contextMenu ? (
        <Card
          role="menu"
          radius="md"
          padding="sm"
          className="fixed z-50 min-w-44 !gap-0 !p-1 shadow3"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-content2"
            onClick={async () => {
              const copy = await duplicateSheetById(contextMenu.sheet.id);
              setContextMenu(null);
              if (copy) router.push(`/character-sheet/${copy.id}/basics`);
            }}
          >
            {t("sheet.duplicate")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-content2"
            onClick={() => {
              openNewGroup(contextMenu.sheet.id, contextMenu.sheet.group.trim());
              setContextMenu(null);
            }}
          >
            {t("list.groupNew")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="rounded-md px-3 py-2 text-left text-sm font-semibold text-error hover:bg-content2"
            onClick={() => {
              setDeleteTarget(contextMenu.sheet);
              setContextMenu(null);
            }}
          >
            {t("sheet.delete")}
          </button>
        </Card>
      ) : null}
      <Modal
        isOpen={newGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNewGroup(null);
            setGroupName("");
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={t("list.groupNew")} className="flex flex-col gap-4">
              <h2 className="text-lg font-black">{t("list.groupNew")}</h2>
              <TextField label={t("list.groupPrompt")} value={groupName} onChange={setGroupName} />
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => setNewGroup(null)}
                confirmLabel={t("list.groupSave")}
                confirmVariant="primary"
                confirmDisabled={!groupName.trim()}
                enterFromInputs
                onConfirm={saveNewGroup}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal isOpen={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={t("shared.phrases.deleteConfirm")} className="flex flex-col gap-4">
              <h2 className="text-lg font-black">{t("shared.phrases.deleteConfirm")}</h2>
              <p className="text-sm text-foreground/70">{t("sheet.deleteConfirmBody")}</p>
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => setDeleteTarget(null)}
                confirmLabel={t("sheet.delete")}
                confirmVariant="danger"
                onConfirm={() => {
                  void (async () => {
                    if (deleteTarget) await removeSheetById(deleteTarget.id);
                    setDeleteTarget(null);
                  })();
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

const INNER = [
  { href: "basics", key: "sheet.basics", icon: UserRound },
  { href: "attributes", key: "sheet.attributes", icon: Sparkles },
  { href: "inventory", key: "sheet.inventory", icon: Package },
  { href: "presets", key: "sheet.presets", icon: Layers },
] as const;

export function SheetSidebar() {
  const pathname = usePathname();
  const { t } = useT();
  const { sheet, form, patchForm } = useSheetApp();
  const section = characterSheetSection(pathname);
  const layout = characterSidebar(pathname);

  if (layout === "list") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ListSidebar />
      </div>
    );
  }

  const sectionLinks = sheet ? (
    <nav className="flex gap-1 border-b border-border2 p-2 lg:flex-col lg:border-b-0" aria-label={t("list.title")}>
      {INNER.map((item) => {
        const href = `/character-sheet/${sheet.id}/${item.href}`;
        const active = section === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-colors duration-150 lg:flex-none ${
              active
                ? "bg-content3 text-foreground shadow1"
                : "text-foreground/60 hover:bg-content2/70 hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-primary text-background" : ""
              }`}
            >
              <Icon className="size-4" />
            </span>
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border2 px-3 py-3">
        <Link
          href="/character-sheet"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-bold text-foreground/65 hover:bg-content2 hover:text-foreground focus-visible:shadow-primary"
        >
          <ArrowLeft className="size-4" />
          {t("sheet.back")}
        </Link>
        {sheet ? (
          <div className="mt-3 min-w-0 px-2">
            <p className="truncate text-base font-black">{sheetListLabel(sheet)}</p>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-subtle">
      {sectionLinks}
      {sheet && form && section === "attributes" ? (
        <>
          <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
            {t("characterSheets.sections.attributes")}
          </p>
          <nav className="flex flex-col gap-1 p-2 pb-3" aria-label={t("characterSheets.sections.attributes")}>
            {OPCODE_STAT_KEYS.map((key) => {
              const Icon = STAT_ICONS[key];
              const statLabel = t(`characterSheets.stats.${key}`);
              return (
                <div key={key} className="rounded-lg px-2 py-1">
                  <div className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-content3">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{statLabel}</span>
                    <Stepper
                      value={form.baseStats[key]}
                      min={1}
                      max={10}
                      disabled={sheet.mode === "career"}
                      ariaLabel={statLabel}
                      onChange={(value) =>
                        patchForm((next) => {
                          next.baseStats[key] = value;
                        })
                      }
                    />
                  </div>
                  <details className="mt-1 rounded-lg">
                    <summary className="cursor-pointer px-1 text-xs font-semibold text-foreground/55 hover:bg-content2/70">
                      {t("characterSheets.skills.about")}
                    </summary>
                    <p className="px-1 pb-1 text-xs leading-5 text-foreground/75">
                      {t(`characterSheets.statDescriptions.${key}`)}
                    </p>
                  </details>
                </div>
              );
            })}
          </nav>
        </>
      ) : null}
      </div>
    </div>
  );
}
