"use client";

import { Button } from "@heroui/react";
import { Dropdown } from "@heroui/react/dropdown";
import { ArrowLeft, ChevronDown, ChevronRight, Folder, Layers, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/app/components/card";

import { CombatMapLayerIcon } from "@/app/components/combat-layer-icon";
import { combatEditorLayerLabel } from "@/app/components/combat-map-editor";
import { useCombatEditorMap, useCombatEditorMeta, useCombatList } from "@/app/components/combat-app";
import { combatMapLayerRevision } from "@/lib/combat/combat-map-layer-revision";
import { CombatMapImportInput } from "@/app/components/combat-map-import-input";
import type { CombatMapImportResult } from "@/lib/combat/combat-map-import-export";
import { TextField } from "@/app/components/ui";
import {
  canDeleteCombatMapElement,
  mapSizeLabel,
  parseCombatMapElements,
  type CombatMapLayerGroup,
} from "@/lib/combat/combat-map-document";
import {
  buildCombatMapLayerRows,
  groupMemberIds,
  removeLayerFromGroups,
  renameLayerGroup,
} from "@/lib/combat/combat-map-layer-groups";
import { clickSelectIds } from "@/lib/combat/combat-map-selection";
import { useT } from "@/lib/character-sheets/i18n";

const LINKS = [
  { href: "/combat", key: "combat.nav.overview" as const },
  { href: "/combat/test", key: "combat.nav.test" as const },
] as const;

const LAYER_DRAG_MIME = "application/x-opcode-combat-layer";

function linkClass(active: boolean) {
  return `block rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
  }`;
}

function layerButtonClass(active: boolean, nested = false) {
  return `w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
    nested ? "pl-8" : ""
  } ${
    active ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
  }`;
}

function EditorLayersSidebar({
  mapId,
  svg,
  layerRevision,
  layerGroups,
  selectedLayerIds,
  onSelectLayerIds,
  onLayerGroupsChange,
  onRenameLayer,
  onDeleteLayer,
}: {
  mapId: string;
  svg: string;
  layerRevision: string;
  layerGroups: CombatMapLayerGroup[];
  selectedLayerIds: string[];
  onSelectLayerIds: (ids: string[]) => void;
  onLayerGroupsChange: (groups: CombatMapLayerGroup[]) => void;
  onRenameLayer: (id: string, name: string) => void;
  onDeleteLayer?: (id: string) => void;
}) {
  const { t } = useT();
  const elements = useMemo(() => parseCombatMapElements(svg), [svg]);
  const elementById = useMemo(() => new Map(elements.map((el) => [el.id, el])), [elements]);
  const rows = useMemo(() => buildCombatMapLayerRows(elements, layerGroups), [elements, layerGroups]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<{ kind: "layer" | "group"; id: string; draft: string } | null>(null);
  const dragLayerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function dismiss(event: PointerEvent) {
      if ((event.target as Element | null)?.closest("[data-combat-layer-menu]")) return;
      setContextMenu(null);
    }
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [contextMenu]);

  function commitRename() {
    if (!renaming) return;
    const trimmed = renaming.draft.trim();
    if (trimmed) {
      if (renaming.kind === "layer") onRenameLayer(renaming.id, trimmed);
      else onLayerGroupsChange(renameLayerGroup(layerGroups, renaming.id, trimmed));
    }
    setRenaming(null);
  }

  function ungroupLayer(layerId: string) {
    onLayerGroupsChange(removeLayerFromGroups(layerGroups, layerId));
  }

  function renderLayerButton(id: string, nested = false) {
    const layer = elementById.get(id);
    if (!layer) return null;
    const active = selectedLayerIds.includes(id);
    if (renaming?.kind === "layer" && renaming.id === id) {
      return (
        <input
          key={`${mapId}-${id}-rename`}
          autoFocus
          value={renaming.draft}
          onChange={(event) => setRenaming({ ...renaming, draft: event.target.value })}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename();
            if (event.key === "Escape") setRenaming(null);
          }}
          className={`${layerButtonClass(active, nested)} border border-primary bg-content2 outline-none`}
        />
      );
    }
    return (
      <button
        key={`${mapId}-${id}`}
        type="button"
        draggable
        onDragStart={(event) => {
          dragLayerIdRef.current = id;
          event.dataTransfer.setData(LAYER_DRAG_MIME, id);
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          dragLayerIdRef.current = null;
        }}
        onClick={(event) => {
          const additive = event.shiftKey || event.metaKey || event.ctrlKey;
          onSelectLayerIds(clickSelectIds(selectedLayerIds, id, additive));
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          if (layer.kind === "bounding_box") return;
          setRenaming({ kind: "layer", id, draft: layer.attrs.name?.trim() || layer.id });
        }}
        onContextMenu={(event) => {
          if (!onDeleteLayer || !canDeleteCombatMapElement(layer)) return;
          event.preventDefault();
          onSelectLayerIds([id]);
          setContextMenu({ x: event.clientX, y: event.clientY, id });
        }}
        className={`${layerButtonClass(active, nested)} flex items-center gap-2`}
      >
        <CombatMapLayerIcon kind={layer.kind} />
        <span className="truncate">{combatEditorLayerLabel(layer, t)}</span>
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <Link
        href="/combat"
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("combat.editor.back")}
      </Link>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
        <Layers className="size-3.5" />
        {t("combat.editor.layers")}
      </p>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-subtle"
        onDragOver={(event) => {
          if (dragLayerIdRef.current || event.dataTransfer.types.includes(LAYER_DRAG_MIME)) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData(LAYER_DRAG_MIME) || dragLayerIdRef.current;
          if (id) ungroupLayer(id);
          dragLayerIdRef.current = null;
        }}
      >
        {rows.map((row) => {
          if (row.kind === "layer") return renderLayerButton(row.id);
          const expanded = expandedGroups[row.id] ?? true;
          const members = groupMemberIds({ id: row.id, name: row.name, memberIds: row.memberIds });
          const groupActive = members.length > 0 && members.every((id) => selectedLayerIds.includes(id));
          if (renaming?.kind === "group" && renaming.id === row.id) {
            return (
              <input
                key={`${mapId}-${row.id}-rename`}
                autoFocus
                value={renaming.draft}
                onChange={(event) => setRenaming({ ...renaming, draft: event.target.value })}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setRenaming(null);
                }}
                className="rounded-xl border border-primary bg-content2 px-3 py-2 text-sm font-semibold outline-none"
              />
            );
          }
          return (
            <div key={`${mapId}-${row.id}`} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={(event) => {
                  const additive = event.shiftKey || event.metaKey || event.ctrlKey;
                  if (!additive) {
                    onSelectLayerIds(members);
                    return;
                  }
                  const allSelected = members.every((memberId) => selectedLayerIds.includes(memberId));
                  onSelectLayerIds(
                    allSelected
                      ? selectedLayerIds.filter((memberId) => !members.includes(memberId))
                      : [...new Set([...selectedLayerIds, ...members])],
                  );
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  setRenaming({ kind: "group", id: row.id, draft: row.name });
                }}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  groupActive ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <span
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-md hover:bg-foreground/5"
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedGroups((current) => ({ ...current, [row.id]: !expanded }));
                  }}
                >
                  {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </span>
                <Folder className="size-4 shrink-0 opacity-70" />
                <span className="truncate">{row.name}</span>
              </button>
              {expanded ? members.map((memberId) => renderLayerButton(memberId, true)) : null}
            </div>
          );
        })}
      </nav>
      {contextMenu && onDeleteLayer ? (
        <Card
          role="menu"
          radius="md"
          padding="sm"
          data-combat-layer-menu=""
          className="fixed z-50 min-w-36 !gap-0 !p-1 shadow3"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-error hover:bg-content2"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDeleteLayer(contextMenu.id);
              setContextMenu(null);
            }}
          >
            {t("combat.editor.delete")}
          </button>
        </Card>
      ) : null}
    </div>
  );
}

const MemoEditorLayersSidebar = memo(
  EditorLayersSidebar,
  (prev, next) =>
    prev.mapId === next.mapId &&
    prev.layerRevision === next.layerRevision &&
    prev.selectedLayerIds.join("\0") === next.selectedLayerIds.join("\0") &&
    prev.onSelectLayerIds === next.onSelectLayerIds &&
    prev.onLayerGroupsChange === next.onLayerGroupsChange &&
    prev.onRenameLayer === next.onRenameLayer &&
    prev.onDeleteLayer === next.onDeleteLayer,
);

function CombatEditorLayersSidebar() {
  const { map, selectedIds, setSelectedIds, setLayerGroups, renameLayer, deleteLayer } =
    useCombatEditorMap();
  const layerRevision = useMemo(
    () => (map ? combatMapLayerRevision(map.svg, map.layerGroups) : ""),
    [map],
  );
  if (!map) return null;
  return (
    <MemoEditorLayersSidebar
      mapId={map.id}
      svg={map.svg}
      layerRevision={layerRevision}
      layerGroups={map.layerGroups ?? []}
      selectedLayerIds={selectedIds}
      onSelectLayerIds={setSelectedIds}
      onLayerGroupsChange={setLayerGroups}
      onRenameLayer={renameLayer}
      onDeleteLayer={deleteLayer}
    />
  );
}

function CombatListSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { ready, maps, listQuery, setListQuery, createMap, importMapFromText, loadError } = useCombatList();
  const [importFailure, setImportFailure] = useState<CombatMapImportResult | null>(null);

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLocaleLowerCase();
    if (!q) return maps;
    return maps.filter((entry) => entry.title.toLocaleLowerCase().includes(q));
  }, [listQuery, maps]);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
        {t("nav.combat")}
      </p>

      <div className="flex gap-2">
        <Dropdown>
          <Button variant="primary" className="h-10 flex-1 gap-2 rounded-xl font-semibold">
            <Plus className="size-4" />
            {t("combat.list.new")}
            <ChevronDown className="size-4" />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label={t("combat.list.new")}
              onAction={(key) => {
                if (key !== "combat") return;
                void createMap().then((map) => router.push(`/combat/${map.id}`));
              }}
            >
              <Dropdown.Item id="combat" textValue={t("combat.list.newCombat")}>
                {t("combat.list.newCombat")}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <CombatMapImportInput
          onPick={(file) => {
            void file.text().then(async (text) => {
              const result = await importMapFromText(text);
              if (!result.ok) {
                setImportFailure(result);
                return;
              }
              router.push(`/combat/${result.map.id}`);
            });
          }}
        >
          {(open) => (
            <Button variant="secondary" className="h-10 shrink-0 gap-2 rounded-xl px-3 font-semibold" onPress={open}>
              <Upload className="size-4" />
              <span className="sr-only">{t("combat.editor.import")}</span>
            </Button>
          )}
        </CombatMapImportInput>
      </div>
      {importFailure && !importFailure.ok ? (
        <p className="text-sm text-error">{t(importFailure.errorKey)}</p>
      ) : null}

      <TextField
        label={t("combat.list.search")}
        value={listQuery}
        onChange={setListQuery}
        icon={<Search className="size-4" />}
      />

      {process.env.NODE_ENV !== "production" ? (
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
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {t("combat.list.maps")}
        </p>
        {!ready ? (
          <p className="text-sm text-foreground/50">{t("combat.list.loading")}</p>
        ) : loadError ? (
          <p className="text-sm text-error">{t("combat.bench.sheetsError")}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-foreground/50">{t("combat.list.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((map) => {
              const active = pathname === `/combat/${map.id}`;
              return (
                <li key={map.id}>
                  <Link
                    href={`/combat/${map.id}`}
                    className={`block rounded-xl px-3 py-2 transition-colors ${
                      active ? "bg-primary/15" : "hover:bg-foreground/5"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold">{map.title}</p>
                    <p className="mt-0.5 text-xs text-foreground/50">
                      {mapSizeLabel(map.svg)}
                      {" · "}
                      {map.inCombat ? t("combat.list.inCombat") : t("combat.list.idle")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CombatSidebar() {
  const { mapId, layout } = useCombatEditorMeta();
  if (mapId && layout === "edit") return <CombatEditorLayersSidebar />;
  return <CombatListSidebar />;
}
