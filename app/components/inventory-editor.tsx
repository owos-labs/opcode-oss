"use client";

import { Button } from "@heroui/react";
import { Drawer } from "@heroui/react/drawer";
import { Modal } from "@heroui/react/modal";
import { ChevronDown, ChevronRight, Copy, GripVertical, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type DragEvent } from "react";

import {
  applyOpcodeModEffectRangeBand,
  cloneOpcodeInventoryDrafts,
  compatibleAmmoDrafts,
  compatibleMagazineDrafts,
  createOpcodeInventoryDraft,
  createOpcodeModEffectDraft,
  fillMagazine,
  formatOpcodeModEffectLine,
  groupInventoryByKind,
  installWeaponModification,
  opcodeModEffectRangeBand,
  patchWeaponModification,
  removeWeaponModification,
  inventoryItemFromQuery,
  inventoryListFacts,
  inventoryMatchesQuery,
  inventoryMoveBefore,
  normalizeOpcodeAmmoDamageKind,
  roundsForPresetLoad,
  setWeaponMagazine,
} from "@/lib/character-sheets/opcodeInventory";
import type {
  OpcodeInventoryDraft,
  OpcodeInventoryItemKind,
  OpcodeModEffectDraft,
  OpcodeModEffectKind,
  OpcodeModRangeBand,
  OpcodeWeaponModificationDraft,
} from "@/lib/character-sheets/opcodeInventory.types";
import {
  carriedKilograms,
  effectiveCarryKilograms,
  dissolveContainer,
  duplicateInventoryItem,
  groupItems,
  placeContainerItem,
  type ItemContainer,
} from "@/lib/character-sheets/model";
import {
  OPCODE_AMMO_DAMAGE_KINDS,
  OPCODE_ARMOR_MATERIALS,
  OPCODE_EXPLOSIVE_TYPES,
  OPCODE_INVENTORY_LIST_KIND_ORDER,
  OPCODE_INVENTORY_TYPED_KINDS,
  OPCODE_MOD_EFFECT_KINDS,
  OPCODE_MOD_EFFECT_TARGETS,
  OPCODE_MOD_RANGE_BAND_ORDER,
  OPCODE_WEAPON_CONCEALABILITY,
  OPCODE_WEAPON_MODIFICATION_SLOTS,
  OPCODE_WEAPON_FIRE_MODE_BITS,
  OPCODE_WEAPON_RELIABILITY,
  OPCODE_WEAPON_TYPES,
} from "@/lib/character-sheets/opcodeInventory.types";
import { OPCODE_HEALTH_PARTS as HEALTH_PARTS } from "@/lib/character-sheets/characterSheet.types";
import { ITEM_PRESET_DRAG_TYPE, type ItemPreset } from "@/lib/character-sheets/item-presets.types";
import { useT } from "@/lib/character-sheets/i18n";
import { resolveItemPresetDtoForLocale } from "@/lib/character-sheets/item-preset-dto";
import { resolveLocaleText } from "@/lib/character-sheets/locale-text";
import { calculateOpcodeDerived } from "@/lib/character-sheets/opcodeSheet";
import {
  damageDiceExprFromAmmoDraft,
  damageDiceExprFromDamageRecord,
  setAmmoDamageDice,
  setAmmoDamageKind,
  setDamageDiceOnRecord,
} from "@/lib/combat/opcode-ammo-damage";
import { Card } from "@/app/components/card";
import { AreaField, ModalShortcutFooter, SelectField, Stepper, TextField } from "@/app/components/ui";
import { useSheetApp } from "@/app/components/sheet-app";
import { InventoryPresetsSidebar } from "@/app/components/inventory-presets-sidebar";

type DrawerState = { mode: "edit"; id: string } | { mode: "add"; containerId: string | null } | { mode: "mod"; weaponId: string; modificationId: string } | null;

const DRAG_ITEM = "text/plain";
const DRAG_AMMO = "application/x-opcode-ammo";
const DRAG_MAGAZINE = "application/x-opcode-magazine";

const FACT_KEY: Record<string, string> = {
  melee: "characterSheets.inventory.weapon.types.melee",
  ranged: "characterSheets.inventory.weapon.types.ranged",
  ball: "characterSheets.inventory.ammo.kinds.ball",
  buck: "characterSheets.inventory.ammo.kinds.buck",
  explosive: "characterSheets.inventory.ammo.kinds.explosive",
  he: "characterSheets.inventory.throwable.types.he",
  frag: "characterSheets.inventory.throwable.types.frag",
  thermal: "characterSheets.inventory.throwable.types.thermal",
  uhmpe: "characterSheets.inventory.armor.materials.uhmpe",
  metal: "characterSheets.inventory.armor.materials.metal",
  ceramic: "characterSheets.inventory.armor.materials.ceramic",
};

export function InventoryEditor({ initialItemId }: { initialItemId?: string | null }) {
  const { locale, t } = useT();
  const { ready, drafts, containers, form, setDrafts, setContainers, saveNow } = useSheetApp();
  const maxCarry = calculateOpcodeDerived({
    ref: 0,
    int: 0,
    wil: 0,
    chr: 0,
    bod: Number(form?.baseStats.bod) || 0,
    luk: 0,
  }).weight;
  const effectiveCarry = effectiveCarryKilograms(maxCarry, containers);
  const usedCarry = carriedKilograms(drafts, containers);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("0");
  const [pendingDelete, setPendingDelete] = useState<null | { type: "item"; id: string } | { type: "container"; id: string }>(null);
  const [query, setQuery] = useState("");
  const [openedQueryItem, setOpenedQueryItem] = useState<string | null>(null);
  const visible = drafts.filter((draft) => inventoryMatchesQuery(draft, query, drafts));
  const assigned = new Set(Object.values(containers).flatMap((container) => container.items));
  const loose = drafts.filter((draft) => !assigned.has(draft.id));
  const editing = drawer?.mode === "edit" ? drafts.find((draft) => draft.id === drawer.id) : undefined;
  const editingMod = drawer?.mode === "mod"
    ? drafts.find((draft) => draft.id === drawer.weaponId)?.weapon?.modifications.find((mod) => mod.id === drawer.modificationId)
    : undefined;
  const drawerTitle = drawer?.mode === "add"
    ? t("characterSheets.inventory.createTitle")
    : (drawer?.mode === "mod" ? editingMod?.name : editing?.name)?.trim() || t("characterSheets.inventory.unnamed");

  useEffect(() => {
    if (!ready || openedQueryItem === initialItemId) return;
    const itemId = inventoryItemFromQuery(initialItemId, drafts);
    if (!itemId) return;
    const timer = window.setTimeout(() => {
      setDrawer({ mode: "edit", id: itemId });
      setOpenedQueryItem(itemId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [drafts, initialItemId, openedQueryItem, ready]);

  function place(itemId: string, containerId: string | null, beforeId?: string) {
    setContainers(placeContainerItem(containers, itemId, containerId, beforeId));
  }

  function commitDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "item") {
      setDrafts(drafts.filter((draft) => draft.id !== pendingDelete.id));
      setContainers(placeContainerItem(containers, pendingDelete.id, null));
      setDrawer((current) => (current?.mode === "edit" && current.id === pendingDelete.id ? null : current));
    } else {
      setContainers(dissolveContainer(containers, pendingDelete.id));
    }
    setPendingDelete(null);
  }

  function copyItem(id: string) {
    const result = duplicateInventoryItem(drafts, containers, id);
    if (!result) return;
    setDrafts(result.drafts);
    setContainers(result.containers);
  }

  function addItem(kind: OpcodeInventoryItemKind) {
    if (drawer?.mode !== "add") return;
    const next = cloneOpcodeInventoryDrafts(drafts);
    const draft = createOpcodeInventoryDraft(kind);
    next.push(draft);
    setDrafts(next);
    if (drawer.containerId) setContainers(placeContainerItem(containers, draft.id, drawer.containerId));
    setDrawer({ mode: "edit", id: draft.id });
  }

  function addPreset(preset: ItemPreset) {
    const next = cloneOpcodeInventoryDrafts(drafts);
    const draft = inventoryDraftFromPreset(preset);
    next.push(draft);
    setDrafts(next);
    setDrawer({ mode: "edit", id: draft.id });
  }

  function fillFromInventory(magazineId: string, ammoId: string): string | null {
    const result = fillMagazine(drafts, magazineId, ammoId);
    if (!result.ok) return result.error ?? null;
    setDrafts(result.drafts);
    return null;
  }

  function loadPresetIntoMagazine(magazineId: string, preset: ItemPreset): string | null {
    if (preset.category !== "ammo") {
      addPreset(preset);
      return null;
    }
    const next = cloneOpcodeInventoryDrafts(drafts);
    let ammo = next.find((item) => item.kind === "ammo" && item.source.presetId === preset.id);
    const created = !ammo;
    if (!ammo) {
      ammo = inventoryDraftFromPreset(preset);
      next.push(ammo);
    }
    const magazine = next.find((item) => item.id === magazineId);
    const capacity = Number(magazine?.magazine?.containsMax);
    const loaded = magazine?.magazine?.loaded.length ?? 0;
    const free = Number.isFinite(capacity) ? capacity - loaded : 0;
    const have = Number(ammo.count);
    ammo.count = String(roundsForPresetLoad(Number.isFinite(have) ? have : 0, free, created));
    const result = fillMagazine(next, magazineId, ammo.id);
    if (!result.ok) return result.error ?? null;
    setDrafts(result.drafts);
    if (created) {
      const containerId = Object.entries(containers).find(([, container]) => container.items.includes(magazineId))?.[0];
      if (containerId) setContainers(placeContainerItem(containers, ammo.id, containerId));
    }
    return null;
  }

  function removeModification(weaponId: string, modificationId: string) {
    const result = removeWeaponModification(drafts, weaponId, modificationId);
    if (!result.ok) return;
    setDrafts(result.drafts);
    setDrawer((current) => (
      current?.mode === "mod" && current.weaponId === weaponId && current.modificationId === modificationId ? null : current
    ));
  }

  function mountMagazine(weaponId: string, magazineId: string): string | null {
    const result = setWeaponMagazine(drafts, weaponId, magazineId);
    if (!result.ok) return result.error ?? null;
    setDrafts(result.drafts);
    return null;
  }

  function mountPresetMagazine(weaponId: string, preset: ItemPreset): string | null {
    const next = cloneOpcodeInventoryDrafts(drafts);
    let magazine = next.find((item) => item.kind === "magazine" && item.source.presetId === preset.id);
    const created = !magazine;
    if (!magazine) {
      magazine = inventoryDraftFromPreset(preset);
      next.push(magazine);
    }
    const result = setWeaponMagazine(next, weaponId, magazine.id);
    if (!result.ok) return result.error ?? null;
    setDrafts(result.drafts);
    if (created) {
      const containerId = Object.entries(containers).find(([, container]) => container.items.includes(weaponId))?.[0];
      if (containerId) setContainers(placeContainerItem(containers, magazine.id, containerId));
    }
    return null;
  }

  function installPresetAttachment(weaponId: string, preset: ItemPreset): string | null {
    const data = resolveItemPresetDtoForLocale(preset.data, locale);
    const attachment = isRecord(data.attachment) ? data.attachment : {};
    const result = installWeaponModification(drafts, weaponId, {
      slot: presetString(attachment.slot, "attachment"),
      name: data.name,
      description: resolveLocaleText(data.desc, locale),
      source: {
        presetId: preset.id,
        presetCategory: preset.category,
        presetData: structuredClone(data),
      },
    });
    if (!result.ok) return result.error ?? null;
    setDrafts(result.drafts);
    return null;
  }

  function dropPreset(targetId: string, preset: ItemPreset): string | null {
    const target = drafts.find((item) => item.id === targetId);
    if (target?.kind === "weapon" && preset.category === "magazines") return mountPresetMagazine(targetId, preset);
    if (target?.kind === "weapon" && preset.category === "attachments") return installPresetAttachment(targetId, preset);
    if (target?.kind === "magazine") return loadPresetIntoMagazine(targetId, preset);
    addPreset(preset);
    return null;
  }

  function inventoryDraftFromPreset(preset: ItemPreset) {
    const data = resolveItemPresetDtoForLocale(preset.data, locale);
    const draft = createOpcodeInventoryDraft(readItemPresetKind(data));
    draft.source = {
      presetId: preset.id,
      presetCategory: preset.category,
      presetData: structuredClone(data),
    };
    draft.name = data.name;
    draft.count = String(typeof data.count === "number" ? data.count : data.count ?? 1);
    const nestedWeight = isRecord(data.weapon) ? data.weapon.weight : isRecord(data.armor) ? data.armor.weight : undefined;
    draft.weight = presetLastNumber(data.weight ?? nestedWeight, "0");
    draft.desc = resolveLocaleText(data.desc, locale);
    if (draft.weapon && isRecord(data.weapon)) {
      const weapon = data.weapon;
      draft.weapon.type = weapon.type === "melee" ? "melee" : "ranged";
      draft.weapon.caliber = presetString(weapon.caliber, draft.weapon.caliber);
      draft.weapon.range = presetNumber(weapon.range, draft.weapon.range);
      draft.weapon.accuracy = presetNumber(weapon.accuracy, draft.weapon.accuracy);
      draft.weapon.concealability = presetLevel(weapon.concealability, { E: "0", G: "1", C: "2", P: "3", N: "4" }, draft.weapon.concealability);
      draft.weapon.rof = presetNumber(weapon.rof, draft.weapon.rof);
      draft.weapon.mode = presetFireMode(weapon.mode, draft.weapon.mode);
      draft.weapon.reliability = presetLevel(weapon.reliability, { V: "0", N: "1", U: "2" }, draft.weapon.reliability);
      draft.weapon.weight = presetNumber(weapon.weight, draft.weapon.weight);
      draft.weapon.damage = isRecord(weapon.damage)
        ? structuredClone(weapon.damage)
        : typeof weapon.damage === "string" ? { dice: weapon.damage } : {};
      draft.weapon.modifications = presetWeaponModifications(weapon.modifications);
    }
    if (draft.ammo && isRecord(data.ammo)) {
      const ammo = data.ammo;
      draft.ammo.caliber = presetString(ammo.caliber, draft.ammo.caliber);
      draft.ammo.damage = presetAmmoKind(ammo, data.type === "throwable");
      draft.ammo.penetration = presetNumber(ammo.penetration, draft.ammo.penetration);
      draft.ammo.projectileCount = presetNumber(ammo.projectileCount, draft.ammo.projectileCount);
      const damageDice = typeof ammo.damage === "string" && !OPCODE_AMMO_DAMAGE_KINDS.includes(ammo.damage as typeof OPCODE_AMMO_DAMAGE_KINDS[number])
        ? ammo.damage
        : "";
      if (damageDice && draft.ammo.damage === "buck") draft.ammo.buckDamage = { dice: damageDice };
      if (damageDice && draft.ammo.damage === "ball") draft.ammo.ballDamage = { dice: damageDice };
      if (Array.isArray(ammo.explosives)) {
        draft.ammo.explosives = ammo.explosives.filter(isRecord).map((entry) => ({
          id: crypto.randomUUID(),
          type: presetExplosiveType(entry.type),
          damage: isRecord(entry.damage) ? structuredClone(entry.damage) : damageDice ? { dice: damageDice } : {},
          lethal: presetNumber(entry.lethal, "0"),
          wound: presetNumber(entry.wound, "0"),
          persistance: presetNumber(entry.persistance, "0"),
          fuse: presetNumber(entry.fuse, "0"),
          source: { presetData: structuredClone(entry) },
        }));
      }
      if (draft.ammo.damage === "explosive" && !draft.ammo.explosives.length) {
        draft.ammo.explosives = [{
          id: crypto.randomUUID(),
          type: presetExplosiveType(ammo.damageType),
          damage: damageDice ? { dice: damageDice } : {},
          lethal: "0",
          wound: "0",
          persistance: "0",
          fuse: "0",
          source: { presetData: structuredClone(ammo) },
        }];
      }
    }
    if (draft.magazine && isRecord(data.magazine)) {
      draft.magazine.caliber = presetString(data.magazine.caliber, draft.magazine.caliber);
      draft.magazine.containsMax = presetNumber(data.magazine.containsMax, draft.magazine.containsMax);
    }
    if (draft.armor && isRecord(data.armor)) {
      draft.armor.material = presetArmorMaterial(data.armor.material);
      draft.armor.layer = presetNumber(data.armor.layer, draft.armor.layer);
      if (isRecord(data.armor.protection)) {
        for (const part of HEALTH_PARTS) {
          if (data.armor.protection[part] !== undefined) draft.armor.protection[part] = presetNumber(data.armor.protection[part], draft.armor.protection[part]);
        }
      }
      const representativeAr = data.armor.primaryAr ?? data.armor.ar;
      if (representativeAr !== undefined) draft.armor.protection.torso = presetLastNumber(representativeAr, draft.armor.protection.torso);
    }
    return draft;
  }

  function createContainer() {
    const allows = Number(weight);
    setContainers(
      groupItems(
        containers,
        [],
        name.trim() || t("inventory.container"),
        crypto.randomUUID(),
        Number.isFinite(allows) ? Math.max(0, allows) : 0,
      ),
    );
    setModalOpen(false);
  }

  function updateContainer(id: string, patch: Partial<ItemContainer>) {
    const container = containers[id];
    if (!container) return;
    setContainers({ ...containers, [id]: { ...container, ...patch } });
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
      <div
        className="flex min-w-0 flex-1 flex-col gap-4"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(ITEM_PRESET_DRAG_TYPE)) event.preventDefault();
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData(ITEM_PRESET_DRAG_TYPE);
          if (!raw) return;
          event.preventDefault();
          try {
            addPreset(JSON.parse(raw) as ItemPreset);
          } catch {
            // Ignore malformed preset payloads.
          }
        }}
      >
      <Card tone="secondary" radius="md" padding="sm" className="flex-row flex-wrap items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/55">{t("sheet.inventory")}</p>
          <p className="mt-1 truncate text-sm font-semibold">
            {t("inventory.carryLine", { max: maxCarry, effective: effectiveCarry, used: usedCarry })}
          </p>
        </div>
        <Modal
          isOpen={modalOpen}
          onOpenChange={(open) => {
            if (open) {
              setName("");
              setWeight("0");
            }
            setModalOpen(open);
          }}
        >
          <Button variant="primary" className="gap-2">
            <Plus className="size-4" />
            {t("inventory.addContainer")}
          </Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog aria-label={t("inventory.createContainer")} className="flex flex-col gap-4">
                <h2 className="text-lg font-black">{t("inventory.createContainer")}</h2>
                <TextField label={t("inventory.containerName")} value={name} onChange={setName} />
                <Stepper
                  display="box"
                  label={t("inventory.containerWeight")}
                  value={weight}
                  min={0}
                  max={9999}
                  onChange={setWeight}
                />
                <ModalShortcutFooter
                  cancelLabel={t("common.close")}
                  onCancel={() => {
                    setModalOpen(false);
                    setName("");
                    setWeight("0");
                  }}
                  confirmLabel={t("inventory.addContainer")}
                  confirmVariant="primary"
                  enterFromInputs
                  onConfirm={createContainer}
                />
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">{t("inventory.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("inventory.search")}
            className="h-11 w-full rounded-lg border border-border1 bg-content3 pl-9 pr-3 text-sm shadow1 outline-none focus:border-primary focus:shadow-primary"
          />
        </label>
      </div>
      {query.trim() && visible.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("inventory.searchEmpty")}</p>
      ) : null}
      <GearCard
        drafts={drafts}
        title={t("inventory.loose")}
        items={loose.filter((draft) => visible.includes(draft))}
        activeId={editing?.id}
        onOpen={(id) => setDrawer({ mode: "edit", id })}
        onAdd={() => setDrawer({ mode: "add", containerId: null })}
        onCopy={copyItem}
        onDelete={(id) => setPendingDelete({ type: "item", id })}
        onPlace={(itemId, beforeId) => place(itemId, null, beforeId)}
        onFill={fillFromInventory}
        onMount={mountMagazine}
        onLoadPreset={dropPreset}
        onEditMod={(weaponId, modificationId) => setDrawer({ mode: "mod", weaponId, modificationId })}
        onRemoveMod={removeModification}
      />
      {/* ponytail: loose order follows draft order; store loose ids if intra-loose rank matters */}
      {Object.entries(containers).map(([id, container]) => (
        <GearCard
          key={id}
          drafts={drafts}
          container={container}
          items={container.items.flatMap((itemId) => {
            const draft = drafts.find((entry) => entry.id === itemId);
            return draft && visible.includes(draft) ? [draft] : [];
          })}
          activeId={editing?.id}
          onOpen={(itemId) => setDrawer({ mode: "edit", id: itemId })}
          onAdd={() => setDrawer({ mode: "add", containerId: id })}
          onCopy={copyItem}
          onDelete={(id) => setPendingDelete({ type: "item", id })}
          onPlace={(itemId, beforeId) => place(itemId, id, beforeId)}
          onRename={(next) => updateContainer(id, { name: next })}
          onWeight={(allows) => updateContainer(id, { weight: { ...container.weight, allows } })}
          onDeleteContainer={() => setPendingDelete({ type: "container", id })}
          onFill={fillFromInventory}
          onMount={mountMagazine}
          onLoadPreset={dropPreset}
          onEditMod={(weaponId, modificationId) => setDrawer({ mode: "mod", weaponId, modificationId })}
          onRemoveMod={removeModification}
        />
      ))}
      <Drawer isOpen={drawer !== null} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog aria-label={drawerTitle} className="flex max-h-dvh flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border2 px-4 py-3">
                <h2 className="text-lg font-black">{drawerTitle}</h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {drawer?.mode === "add" ? (
                  <CreatePanel onAdd={addItem} />
                ) : drawer?.mode === "edit" ? (
                  <ItemForm selectedId={drawer.id} />
                ) : drawer?.mode === "mod" ? (
                  <ModificationForm weaponId={drawer.weaponId} modificationId={drawer.modificationId} />
                ) : null}
              </div>
              {drawer?.mode === "edit" || drawer?.mode === "mod" ? (
                <div className="flex shrink-0 flex-wrap gap-2 border-t border-border2 p-4">
                  {drawer.mode === "edit" ? (
                    <Button
                      variant="danger"
                      className="gap-2"
                      onPress={() => setPendingDelete({ type: "item", id: drawer.id })}
                    >
                      <Trash2 className="size-4" />
                      {t("characterSheets.inventory.delete")}
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    className="ms-auto gap-2"
                    onPress={() => {
                      void saveNow().then(() => setDrawer(null));
                    }}
                  >
                    <Save className="size-4" />
                    {t("characterSheets.inventory.save")}
                  </Button>
                </div>
              ) : null}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      <Modal isOpen={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={t("shared.phrases.deleteConfirm")} className="flex flex-col gap-4">
              <h2 className="text-lg font-black">
                {pendingDelete?.type === "container" ? t("inventory.deleteContainer") : t("inventory.deleteItem")}
              </h2>
              <p className="text-sm text-foreground/70">
                {pendingDelete?.type === "container" ? t("inventory.deleteContainerBody") : t("inventory.deleteItemBody")}
              </p>
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => setPendingDelete(null)}
                confirmLabel={t("characterSheets.inventory.delete")}
                confirmVariant="danger"
                confirmIcon={<Trash2 className="size-4" />}
                onConfirm={commitDelete}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      </div>
      <InventoryPresetsSidebar onAdd={addPreset} />
    </div>
  );
}

function readItemPresetKind(data: ItemPreset["data"]): OpcodeInventoryItemKind {
  const type = data.type;
  if (typeof type === "string" && (OPCODE_INVENTORY_TYPED_KINDS as readonly string[]).includes(type))
    return type as OpcodeInventoryItemKind;
  return "generic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function presetString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function presetNumber(value: unknown, fallback = "") {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const match = presetString(value).match(/[+-]?\d+(?:\.\d+)?/);
  return match ? String(Number(match[0])) : fallback;
}

function presetLastNumber(value: unknown, fallback = "") {
  const matches = presetString(value).match(/[+-]?\d+(?:\.\d+)?/g);
  if (!matches?.length) return fallback;
  return String(Number(matches[matches.length - 1]));
}

function presetLevel(value: unknown, levels: Record<string, string>, fallback: string) {
  const raw = presetString(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return raw;
  return levels[raw.slice(0, 1).toUpperCase()] || fallback;
}

function presetFireMode(value: unknown, fallback: string) {
  const raw = presetString(value).trim();
  if (/^\d+$/.test(raw)) return raw;
  let mode = 0;
  if (/\bSA\b|SEMI/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.semi;
  if (/\bFA\b|AUTO/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.auto;
  if (/\bB\b|BURST/i.test(raw)) mode |= OPCODE_WEAPON_FIRE_MODE_BITS.burst;
  return mode ? String(mode) : fallback;
}

function presetAmmoKind(ammo: Record<string, unknown>, throwable: boolean) {
  if (throwable) return "explosive" as const;
  const type = presetString(ammo.type).toLowerCase();
  const damageType = presetString(ammo.damageType).toLowerCase();
  if (type.includes("buck") || type.includes("shotgun")) return "buck" as const;
  if (type.includes("explosive") || /he|frag|thermal/.test(damageType)) return "explosive" as const;
  return "ball" as const;
}

function presetExplosiveType(value: unknown) {
  const raw = presetString(value).trim().toLowerCase();
  if (raw === "f" || raw.includes("frag")) return "frag";
  if (raw === "t" || raw.includes("thermal") || raw.includes("incendiary")) return "thermal";
  return "he";
}

function presetArmorMaterial(value: unknown) {
  const raw = presetString(value, "ceramic").toLowerCase();
  if (raw.includes("ceramic")) return "ceramic";
  if (raw.includes("steel") || raw.includes("metal")) return "metal";
  if (raw.includes("soft") || raw.includes("composite") || raw.includes("pe")) return "uhmpe";
  return raw;
}

function presetWeaponModifications(value: unknown): OpcodeWeaponModificationDraft[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([slot, instances]) => {
    if (slot === "magazine" || !isRecord(instances)) return [];
    return Object.entries(instances).flatMap(([id, raw]) => {
      if (!isRecord(raw)) return [];
      return [{
        id,
        slot,
        name: presetString(raw.name),
        description: presetString(raw.description),
        effects: presetModificationEffects(raw.effects),
        source: structuredClone(raw),
      }];
    });
  });
}

function presetModificationEffects(value: unknown): OpcodeModEffectDraft[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, raw]) => {
    const record = isRecord(raw) ? raw : {};
    if (typeof record.enable_slot === "string") {
      return {
        key,
        kind: "enable_slot",
        slot: record.enable_slot,
        count: presetNumber(record.count, "1"),
        max: presetNumber(record.max, ""),
        target: "",
        flat: "",
        level: "",
        rangeMin: "",
        rangeMax: "",
        concealMax: "",
        note: "",
        source: structuredClone(record),
      };
    }
    const mod = isRecord(record.mod) ? record.mod : {};
    const valueRecord = isRecord(mod.value) ? mod.value : {};
    const applied = isRecord(valueRecord.applied_on) ? valueRecord.applied_on : {};
    const range = isRecord(applied.range_target) ? applied.range_target : {};
    const conceal = isRecord(applied.concealability) ? applied.concealability : {};
    const target = typeof mod.target === "string" && ["diff", "range", "caliber", "accuracy", "concealability", "weight"].includes(mod.target)
      ? mod.target as OpcodeModEffectDraft["target"]
      : "";
    return {
      key,
      kind: Object.keys(mod).length ? "mod" : "unknown",
      slot: "",
      count: "1",
      max: "",
      target,
      flat: presetNumber(valueRecord.flat, ""),
      level: presetNumber(valueRecord.level, ""),
      rangeMin: presetNumber(range.min, ""),
      rangeMax: presetNumber(range.max, ""),
      concealMax: presetNumber(conceal.max, ""),
      note: typeof applied.text === "string" ? applied.text : "",
      source: structuredClone(record),
    };
  });
}

function GearCard({
  drafts,
  title,
  container,
  items,
  activeId,
  onOpen,
  onAdd,
  onCopy,
  onDelete,
  onPlace,
  onRename,
  onWeight,
  onDeleteContainer,
  onFill,
  onMount,
  onLoadPreset,
  onEditMod,
  onRemoveMod,
}: {
  drafts: OpcodeInventoryDraft[];
  title?: string;
  container?: ItemContainer;
  items: OpcodeInventoryDraft[];
  activeId?: string;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onPlace: (itemId: string, beforeId?: string) => void;
  onRename?: (name: string) => void;
  onWeight?: (allows: number) => void;
  onDeleteContainer?: () => void;
  onFill: (magazineId: string, ammoId: string) => string | null;
  onMount: (weaponId: string, magazineId: string) => string | null;
  onLoadPreset: (targetId: string, preset: ItemPreset) => string | null;
  onEditMod: (weaponId: string, modificationId: string) => void;
  onRemoveMod: (weaponId: string, modificationId: string) => void;
}) {
  const { t } = useT();
  const [over, setOver] = useState(false);

  function allow(event: DragEvent) {
    if (event.dataTransfer.types.includes(DRAG_ITEM)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  return (
    <Card
      tone="secondary"
      radius="md"
      padding="sm"
      className={`min-h-28 ${over ? "shadow-primary" : ""}`}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes(DRAG_ITEM)) setOver(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDragOver={allow}
      onDropCapture={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        const itemId = event.dataTransfer.getData(DRAG_ITEM);
        if (itemId) onPlace(itemId);
      }}
    >
      <div className="flex min-h-11 items-center gap-2 px-1">
        {container ? (
          <>
            <input
              value={container.name}
              aria-label={t("inventory.containerName")}
              onChange={(event) => onRename?.(event.target.value)}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm font-black outline-none"
            />
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-foreground/70">
              <span>{t("inventory.containerWeight")}</span>
              <input
                type="number"
                min={0}
                aria-label={t("inventory.containerWeight")}
                value={container.weight.allows}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  onWeight?.(Number.isFinite(next) ? Math.max(0, next) : 0);
                }}
                className="h-9 w-16 rounded-md border border-border1 bg-content3 text-center text-sm font-semibold outline-none focus:border-primary"
              />
            </label>
          </>
        ) : (
          <p className="flex h-11 min-w-0 flex-1 items-center truncate text-sm font-black">{title}</p>
        )}
        <Button variant="primary" className="shrink-0 gap-2" onPress={onAdd}>
          <Plus className="size-4" />
          {t("characterSheets.inventory.addItem")}
        </Button>
        {onDeleteContainer ? (
          <button type="button" aria-label={t("inventory.deleteContainer")} className="flex size-9 shrink-0 items-center justify-center text-error" onClick={onDeleteContainer}>
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      <ul className="flex min-h-11 flex-1 flex-col">
        {groupInventoryByKind(items).map((group) => (
          <li key={group.kind} className="flex flex-col">
            <p className="px-2 pt-2 text-xs font-black text-foreground/55">{t(`characterSheets.inventory.groups.${group.kind}`)}</p>
            <ul>
              {group.items.map((draft) => (
                <GearRow
                  key={draft.id}
                  drafts={drafts}
                  draft={draft}
                  selected={activeId === draft.id}
                  onOpen={() => onOpen(draft.id)}
                  onCopy={() => onCopy(draft.id)}
                  onDelete={() => onDelete(draft.id)}
                  onDropItem={(itemId) => onPlace(itemId, draft.id)}
                  onMove={(delta) => {
                    const before = inventoryMoveBefore(group.items.map((item) => item.id), draft.id, delta);
                    if (before !== undefined) onPlace(draft.id, before ?? undefined);
                  }}
                  onFill={onFill}
                  onMount={onMount}
                  onLoadPreset={onLoadPreset}
                  onEditMod={onEditMod}
                  onRemoveMod={onRemoveMod}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GearRow({
  drafts,
  draft,
  selected,
  onOpen,
  onCopy,
  onDelete,
  onDropItem,
  onMove,
  onFill,
  onMount,
  onLoadPreset,
  onEditMod,
  onRemoveMod,
}: {
  drafts: OpcodeInventoryDraft[];
  draft: OpcodeInventoryDraft;
  selected: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDropItem: (itemId: string) => void;
  onMove: (delta: number) => void;
  onFill: (magazineId: string, ammoId: string) => string | null;
  onMount: (weaponId: string, magazineId: string) => string | null;
  onLoadPreset: (targetId: string, preset: ItemPreset) => string | null;
  onEditMod: (weaponId: string, modificationId: string) => void;
  onRemoveMod: (weaponId: string, modificationId: string) => void;
}) {
  const { t } = useT();
  const facts = inventoryListFacts(draft, drafts);
  const [loadOver, setLoadOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modsOpen, setModsOpen] = useState(true);
  const magazine = draft.kind === "magazine";
  const weapon = draft.kind === "weapon";

  function acceptLoad(event: DragEvent) {
    const types = event.dataTransfer.types;
    if (types.includes(ITEM_PRESET_DRAG_TYPE) && (magazine || weapon)) return true;
    if (magazine && types.includes(DRAG_AMMO)) return true;
    return weapon && types.includes(DRAG_MAGAZINE);
  }

  return (
    <li className={`flex flex-col rounded-md ${loadOver ? "bg-content3" : ""}`}>
      <div
        className="flex min-h-11 flex-wrap items-center gap-1"
        onDragEnter={(event) => {
          if (acceptLoad(event)) setLoadOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setLoadOver(false);
        }}
        onDragOver={(event) => {
          if (acceptLoad(event)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (event.dataTransfer.types.includes(DRAG_ITEM)) event.preventDefault();
        }}
        onDrop={(event) => {
          setLoadOver(false);
          const presetRaw = event.dataTransfer.getData(ITEM_PRESET_DRAG_TYPE);
          if (presetRaw && (magazine || weapon)) {
            event.preventDefault();
            event.stopPropagation();
            try {
              const preset = JSON.parse(presetRaw) as ItemPreset;
              setLoadError(onLoadPreset(draft.id, preset));
            } catch {
              setLoadError(null);
            }
            return;
          }
          const ammoId = event.dataTransfer.getData(DRAG_AMMO);
          if (ammoId && magazine && ammoId !== draft.id) {
            event.preventDefault();
            event.stopPropagation();
            setLoadError(onFill(draft.id, ammoId));
            return;
          }
          const magazineId = event.dataTransfer.getData(DRAG_MAGAZINE);
          if (magazineId && weapon && magazineId !== draft.id) {
            event.preventDefault();
            event.stopPropagation();
            setLoadError(onMount(draft.id, magazineId));
            return;
          }
          const itemId = event.dataTransfer.getData(DRAG_ITEM);
          if (!itemId) return;
          event.preventDefault();
          event.stopPropagation();
          if (itemId !== draft.id) onDropItem(itemId);
        }}
      >
        <button
          type="button"
          draggable
          aria-label={t("inventory.drag")}
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_ITEM, draft.id);
            if (draft.kind === "ammo") event.dataTransfer.setData(DRAG_AMMO, draft.id);
            if (draft.kind === "magazine") event.dataTransfer.setData(DRAG_MAGAZINE, draft.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onMove(-1);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onMove(1);
            }
          }}
          className="flex size-11 shrink-0 cursor-grab items-center justify-center text-foreground/40 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className={`flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md px-2 text-left ${
            selected ? "bg-content3" : "hover:bg-content3"
          }`}
        >
          <span className="truncate text-sm font-semibold">{draft.name.trim() || t("characterSheets.inventory.unnamed")}</span>
          {facts.length ? (
            <span className="truncate text-xs text-foreground/60">
              {facts.map((fact) => (FACT_KEY[fact] ? t(FACT_KEY[fact]) : fact)).join(" · ")}
            </span>
          ) : null}
        </button>
        {magazine ? (
          <MagazineLoad drafts={drafts} magazine={draft} onFill={(ammoId) => setLoadError(onFill(draft.id, ammoId))} />
        ) : null}
        <Button
          size="sm"
          variant="outline"
          aria-label={t("sheet.duplicate")}
          className="size-9 min-w-9 shrink-0 p-0"
          onPress={onCopy}
        >
          <Copy className="size-4" />
        </Button>
        <button type="button" aria-label={t("inventory.deleteItem")} className="flex size-8 shrink-0 items-center justify-center text-error" onClick={onDelete}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {weapon && draft.weapon?.modifications.length ? (
        <details
          open={modsOpen}
          onToggle={(event) => setModsOpen(event.currentTarget.open)}
          className="group/mods mb-1 ml-11 border-l border-border2 pl-2"
        >
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 px-2 text-xs font-black text-foreground/55 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 group-open/mods:hidden" />
            <ChevronDown className="hidden size-3.5 group-open/mods:block" />
            {t("characterSheets.inventory.modifications.title")}
          </summary>
          <ul>
            {draft.weapon.modifications.map((mod) => (
              <li key={mod.id} className="flex min-h-11 items-center gap-1 px-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{mod.name.trim() || t("characterSheets.inventory.unnamed")}</p>
                  <p className="truncate text-xs text-foreground/60">
                    {[slotLabel(t, mod.slot), ...mod.effects.map((effect) => formatOpcodeModEffectLine(effect, t))].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={t("characterSheets.inventory.modifications.edit")}
                  className="size-9 min-w-9 shrink-0 p-0"
                  onPress={() => onEditMod(draft.id, mod.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <button type="button" aria-label={t("inventory.deleteItem")} className="flex size-8 shrink-0 items-center justify-center text-error" onClick={() => onRemoveMod(draft.id, mod.id)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {loadError ? <p className="px-12 pb-1 text-xs text-error">{t(loadError)}</p> : null}
    </li>
  );
}

function slotLabel(t: (key: string) => string, slot: string) {
  const key = `characterSheets.inventory.modifications.slots.${slot}`;
  const label = t(key);
  return label === key ? slot : label;
}

function ModificationForm({ weaponId, modificationId }: { weaponId: string; modificationId: string }) {
  const { t } = useT();
  const { drafts, setDrafts } = useSheetApp();
  const mod = drafts.find((draft) => draft.id === weaponId)?.weapon?.modifications.find((item) => item.id === modificationId);
  if (!mod) return null;
  function patch(next: { name?: string; slot?: string; description?: string }) {
    const result = patchWeaponModification(drafts, weaponId, modificationId, next);
    if (result.ok) setDrafts(result.drafts);
  }
  function patchEffects(mutator: (effects: OpcodeModEffectDraft[]) => void) {
    const effects = mod!.effects.map((effect) => ({ ...effect, source: { ...effect.source } }));
    mutator(effects);
    const result = patchWeaponModification(drafts, weaponId, modificationId, { effects });
    if (result.ok) setDrafts(result.drafts);
  }
  const slots = (OPCODE_WEAPON_MODIFICATION_SLOTS as readonly string[]).includes(mod.slot)
    ? OPCODE_WEAPON_MODIFICATION_SLOTS
    : [mod.slot, ...OPCODE_WEAPON_MODIFICATION_SLOTS];
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label={t("characterSheets.inventory.modifications.slot")}
        value={mod.slot}
        onChange={(value) => patch({ slot: value })}
        options={slots.map((slot) => ({ value: slot, label: slotLabel(t, slot) }))}
      />
      <TextField label={t("characterSheets.inventory.modifications.name")} value={mod.name} onChange={(value) => patch({ name: value })} />
      <AreaField label={t("characterSheets.inventory.modifications.description")} value={mod.description} rows={3} onChange={(value) => patch({ description: value })} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-foreground/55">{t("characterSheets.inventory.modifications.effects")}</p>
        <Button size="sm" variant="outline" onPress={() => patchEffects((effects) => { effects.push(createOpcodeModEffectDraft("mod")); })}>
          {t("characterSheets.inventory.modifications.addEffect")}
        </Button>
      </div>
      {mod.effects.map((effect, index) => (
        <EffectFields
          key={`${effect.key}:${index}`}
          effect={effect}
          onChange={(next) => patchEffects((effects) => { effects[index] = next; })}
          onRemove={() => patchEffects((effects) => { effects.splice(index, 1); })}
        />
      ))}
    </div>
  );
}

function EffectFields({
  effect,
  onChange,
  onRemove,
}: {
  effect: OpcodeModEffectDraft;
  onChange: (next: OpcodeModEffectDraft) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const kinds = effect.kind === "unknown" ? (["unknown", ...OPCODE_MOD_EFFECT_KINDS] as const) : OPCODE_MOD_EFFECT_KINDS;
  const band = opcodeModEffectRangeBand(effect.rangeMin, effect.rangeMax);
  function set(patch: Partial<OpcodeModEffectDraft>) {
    onChange({ ...effect, ...patch });
  }
  return (
    <Card radius="md" padding="sm" className="gap-3">
      <div className="flex items-end gap-2">
        <SelectField
          className="min-w-0 flex-1"
          label={t("characterSheets.inventory.modifications.kind")}
          value={effect.kind}
          onChange={(value) => {
            if (value === "unknown" || value === effect.kind) return;
            const next = createOpcodeModEffectDraft(value as OpcodeModEffectKind);
            next.key = effect.key;
            onChange(next);
          }}
          options={kinds.map((kind) => ({
            value: kind,
            label: t(`characterSheets.inventory.modifications.kinds.${kind}`),
          }))}
        />
        <button type="button" aria-label={t("characterSheets.inventory.modifications.removeEffect")} className="mb-1 flex size-8 shrink-0 items-center justify-center text-error" onClick={onRemove}>
          <Trash2 className="size-4" />
        </button>
      </div>
      {effect.kind === "enable_slot" ? (
        <>
          <SelectField
            label={t("characterSheets.inventory.modifications.slot")}
            value={effect.slot}
            onChange={(value) => set({ slot: value })}
            options={((OPCODE_WEAPON_MODIFICATION_SLOTS as readonly string[]).includes(effect.slot)
              ? OPCODE_WEAPON_MODIFICATION_SLOTS
              : [effect.slot, ...OPCODE_WEAPON_MODIFICATION_SLOTS]
            ).map((slot) => ({ value: slot, label: slotLabel(t, slot) }))}
          />
          <div className="flex gap-3">
            <TextField label={t("characterSheets.inventory.modifications.count")} value={effect.count} onChange={(value) => set({ count: value })} />
            <TextField label={t("characterSheets.inventory.modifications.max")} value={effect.max} onChange={(value) => set({ max: value })} />
          </div>
        </>
      ) : effect.kind === "mod" ? (
        <>
          <SelectField
            label={t("characterSheets.inventory.modifications.target")}
            value={effect.target}
            onChange={(value) => set({ target: value as OpcodeModEffectDraft["target"] })}
            options={OPCODE_MOD_EFFECT_TARGETS.map((target) => ({
              value: target,
              label: t(`characterSheets.inventory.modifications.targets.${target}`),
            }))}
          />
          <div className="flex gap-3">
            <TextField type="number" step={1} label={t("characterSheets.inventory.modifications.flat")} value={effect.flat} onChange={(value) => set({ flat: value })} />
            <TextField type="number" step={1} label={t("characterSheets.inventory.modifications.level")} value={effect.level} onChange={(value) => set({ level: value })} />
          </div>
          <SelectField
            label={t("characterSheets.inventory.modifications.rangeBand")}
            value={band === "custom" ? "custom" : band}
            onChange={(value) => {
              if (value === "custom") return;
              const next = { ...effect, source: { ...effect.source } };
              applyOpcodeModEffectRangeBand(next, value as OpcodeModRangeBand | "");
              onChange(next);
            }}
            options={[
              { value: "", label: t("characterSheets.inventory.modifications.rangeBands.any") },
              ...OPCODE_MOD_RANGE_BAND_ORDER.map((name) => ({
                value: name,
                label: t(`characterSheets.inventory.modifications.rangeBands.${name}`),
              })),
              ...(band === "custom" ? [{ value: "custom", label: t("characterSheets.inventory.modifications.rangeBands.custom") }] : []),
            ]}
          />
          {band === "custom" ? (
            <div className="flex gap-3">
              <TextField label={t("characterSheets.inventory.modifications.rangeMin")} value={effect.rangeMin} onChange={(value) => set({ rangeMin: value })} />
              <TextField label={t("characterSheets.inventory.modifications.rangeMax")} value={effect.rangeMax} onChange={(value) => set({ rangeMax: value })} />
            </div>
          ) : null}
          {effect.target === "concealability" ? (
            <SelectField
              label={t("characterSheets.inventory.modifications.concealMax")}
              value={effect.concealMax}
              onChange={(value) => set({ concealMax: value })}
              options={[
                { value: "", label: "—" },
                ...OPCODE_WEAPON_CONCEALABILITY.map((level) => ({
                  value: String(level),
                  label: t(`characterSheets.inventory.weapon.concealabilityLevels.${level}`),
                })),
              ]}
            />
          ) : null}
          <TextField label={t("characterSheets.inventory.modifications.note")} value={effect.note} onChange={(value) => set({ note: value })} />
        </>
      ) : (
        <p className="text-sm text-foreground/60">{t("characterSheets.inventory.modifications.kinds.unknown")}</p>
      )}
    </Card>
  );
}

function MagazineLoad({
  drafts,
  magazine,
  onFill,
}: {
  drafts: OpcodeInventoryDraft[];
  magazine: OpcodeInventoryDraft;
  onFill: (ammoId: string) => void;
}) {
  const { t } = useT();
  const ammo = compatibleAmmoDrafts(drafts, magazine.magazine?.caliber || "").filter((item) => (Number(item.count) || 0) > 0);
  const [picked, setPicked] = useState(ammo[0]?.id ?? "");
  const selected = ammo.some((item) => item.id === picked) ? picked : (ammo[0]?.id ?? "");
  return (
    <div className="flex shrink-0 items-center gap-1">
      {ammo.length ? (
        <select
          aria-label={t("inventory.loadAmmo")}
          value={selected}
          onChange={(event) => setPicked(event.target.value)}
          className="h-9 max-w-36 rounded-md border border-border1 bg-content3 px-2 text-xs font-semibold outline-none focus:border-primary"
        >
          {ammo.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.name.trim() || t("characterSheets.inventory.unnamed")} ×${item.count}`}
            </option>
          ))}
        </select>
      ) : null}
      <Button size="sm" variant="outline" className="shrink-0" isDisabled={!selected} onPress={() => { if (selected) onFill(selected); }}>
        {t("inventory.load")}
      </Button>
    </div>
  );
}

function CreatePanel({ onAdd }: { onAdd: (kind: OpcodeInventoryItemKind) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/60">{t("characterSheets.inventory.createHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        {OPCODE_INVENTORY_LIST_KIND_ORDER.map((kind) => (
          <Card
            as="button"
            key={kind}
            type="button"
            radius="md"
            padding="sm"
            className="min-h-11 text-left text-sm font-black hover:bg-content2"
            onClick={() => onAdd(kind)}
          >
            {t(`characterSheets.inventory.kinds.${kind}`)}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ItemForm({ selectedId }: { selectedId: string }) {
  const { t } = useT();
  const { drafts, setDrafts } = useSheetApp();
  const index = drafts.findIndex((draft) => draft.id === selectedId);
  const item = drafts[index];
  if (!item) return null;

  function patch(mutator: (draft: OpcodeInventoryDraft) => void) {
    const next = cloneOpcodeInventoryDrafts(drafts);
    if (!next[index]) return;
    mutator(next[index]);
    setDrafts(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t("characterSheets.inventory.fields.name")} value={item.name} onChange={(value) => patch((draft) => { draft.name = value; })} />
      <div className="flex flex-wrap gap-3">
        {item.kind !== "magazine" ? (
          <Stepper
            display="box"
            label={t("characterSheets.inventory.fields.count")}
            value={item.count}
            min={0}
            max={9999}
            onChange={(value) => patch((draft) => { draft.count = value; })}
          />
        ) : null}
        <Stepper
          display="box"
          label={t("inventory.itemWeight")}
          value={item.weapon ? item.weapon.weight : item.weight}
          min={0}
          max={999}
          step={0.1}
          onChange={(value) => patch((draft) => {
            if (draft.weapon) draft.weapon.weight = value;
            else draft.weight = value;
          })}
        />
      </div>
      <AreaField label={t("characterSheets.inventory.fields.desc")} value={item.desc} rows={3} onChange={(value) => patch((draft) => { draft.desc = value; })} />
      {item.kind === "weapon" && item.weapon ? <WeaponFields item={item} drafts={drafts} onPatch={patch} /> : null}
      {item.kind === "ammo" && item.ammo ? <AmmoFields item={item} onPatch={patch} /> : null}
      {item.kind === "magazine" && item.magazine ? <MagazineFields item={item} onPatch={patch} /> : null}
      {item.kind === "throwable" && item.ammo ? <ThrowableFields item={item} onPatch={patch} /> : null}
      {item.kind === "armor" && item.armor ? <ArmorFields item={item} onPatch={patch} /> : null}
    </div>
  );
}

function WeaponFields({
  item,
  drafts,
  onPatch,
}: {
  item: OpcodeInventoryDraft;
  drafts: OpcodeInventoryDraft[];
  onPatch: (mutator: (draft: OpcodeInventoryDraft) => void) => void;
}) {
  const { t } = useT();
  const weapon = item.weapon!;
  const magazines = compatibleMagazineDrafts(drafts, weapon.caliber);
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("characterSheets.inventory.weapon.weaponType")}
        value={weapon.type}
        onChange={(value) => onPatch((draft) => { draft.weapon!.type = value === "ranged" ? "ranged" : "melee"; })}
        options={OPCODE_WEAPON_TYPES.map((type) => ({
          value: type,
          label: t(`characterSheets.inventory.weapon.types.${type}`),
        }))}
      />
      {weapon.type === "melee" ? (
        <TextField
          label={t("characterSheets.inventory.weapon.damage")}
          placeholder="2d6+1"
          value={damageDiceExprFromDamageRecord(weapon.damage)}
          onChange={(value) => onPatch((draft) => {
            draft.weapon!.damage = setDamageDiceOnRecord(draft.weapon!.damage, value);
          })}
        />
      ) : weapon.type === "ranged" ? (
        <TextField
          label={t("characterSheets.inventory.fields.caliber")}
          value={weapon.caliber}
          onChange={(value) => onPatch((draft) => { draft.weapon!.caliber = value; })}
        />
      ) : null}
      <SelectField
        label={t("characterSheets.inventory.weapon.magazine")}
        value={weapon.magazineId}
        onChange={(value) => onPatch((draft) => { draft.weapon!.magazineId = value; })}
        options={[
          { value: "", label: t("characterSheets.inventory.weapon.noMagazine") },
          ...magazines.map((magazine) => ({ value: magazine.id, label: magazine.name || magazine.id })),
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Stepper display="box" label={t("characterSheets.inventory.weapon.range")} value={weapon.range} min={0} max={9999} onChange={(value) => onPatch((draft) => { draft.weapon!.range = value; })} />
        <Stepper
          display="box"
          label={t("characterSheets.inventory.weapon.rof")}
          value={weapon.rof}
          min={0}
          max={9999}
          onChange={(value) => onPatch((draft) => { draft.weapon!.rof = value; })}
        />
        {weapon.type === "ranged" ? (
          <Stepper
            display="box"
            label={t("characterSheets.inventory.weapon.accuracy")}
            value={String(Number(String(weapon.accuracy).replace(/^\+/, "")) || 0)}
            min={-5}
            max={5}
            onChange={(value) => onPatch((draft) => {
              const n = Number(value);
              draft.weapon!.accuracy = Number.isFinite(n) ? (n > 0 ? `+${n}` : String(n)) : "0";
            })}
          />
        ) : null}
        <SelectField
          label={t("characterSheets.inventory.weapon.concealability")}
          value={weapon.concealability}
          onChange={(value) => onPatch((draft) => { draft.weapon!.concealability = value; })}
          options={OPCODE_WEAPON_CONCEALABILITY.map((level) => ({
            value: String(level),
            label: t(`characterSheets.inventory.weapon.concealabilityLevels.${level}`),
          }))}
        />
      </div>
      {weapon.type === "ranged" ? (
        <div className="flex flex-wrap gap-4">
          {(["semi", "auto", "burst"] as const).map((mode) => (
            <label key={mode} className="flex min-h-11 items-center gap-2 rounded-lg bg-content2 px-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={((Number(weapon.mode) || 0) & OPCODE_WEAPON_FIRE_MODE_BITS[mode]) === OPCODE_WEAPON_FIRE_MODE_BITS[mode]}
                onChange={(event) => {
                  const bit = OPCODE_WEAPON_FIRE_MODE_BITS[mode];
                  const current = Number(weapon.mode) || 0;
                  onPatch((draft) => {
                    draft.weapon!.mode = String(event.target.checked ? current | bit : current & ~bit);
                  });
                }}
              />
              {t(`characterSheets.inventory.weapon.modes.${mode}`)}
            </label>
          ))}
          <SelectField
            label={t("characterSheets.inventory.weapon.reliability")}
            value={weapon.reliability}
            onChange={(value) => onPatch((draft) => { draft.weapon!.reliability = value; })}
            options={OPCODE_WEAPON_RELIABILITY.map((level) => ({
              value: String(level),
              label: t(`characterSheets.inventory.weapon.reliabilityLevels.${level}`),
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function AmmoFields({
  item,
  onPatch,
}: {
  item: OpcodeInventoryDraft;
  onPatch: (mutator: (draft: OpcodeInventoryDraft) => void) => void;
}) {
  const { t } = useT();
  const ammo = item.ammo!;
  const damageKind = normalizeOpcodeAmmoDamageKind(ammo.damage);
  return (
    <div className="flex flex-col gap-3 border-t border-border2 pt-4">
      <TextField label={t("characterSheets.inventory.fields.caliber")} value={ammo.caliber} onChange={(value) => onPatch((draft) => { draft.ammo!.caliber = value; })} />
      <SelectField
        label={t("characterSheets.inventory.ammo.damageKind")}
        value={damageKind}
        onChange={(value) => onPatch((draft) => { setAmmoDamageKind(draft.ammo!, normalizeOpcodeAmmoDamageKind(value)); })}
        options={OPCODE_AMMO_DAMAGE_KINDS.map((kind) => ({
          value: kind,
          label: t(`characterSheets.inventory.ammo.kinds.${kind}`),
        }))}
      />
      <TextField
        label={t("characterSheets.inventory.weapon.damage")}
        placeholder="2d6+1"
        value={damageDiceExprFromAmmoDraft(ammo)}
        onChange={(value) => onPatch((draft) => { setAmmoDamageDice(draft.ammo!, value); })}
      />
      {damageKind === "buck" ? (
        <Stepper
          display="box"
          label={t("characterSheets.inventory.ammo.projectileCount")}
          value={ammo.projectileCount}
          min={1}
          max={99}
          onChange={(value) => onPatch((draft) => { draft.ammo!.projectileCount = value; })}
        />
      ) : null}
      <Stepper display="box" label={t("characterSheets.inventory.ammo.penetration")} value={ammo.penetration} min={0} max={9999} onChange={(value) => onPatch((draft) => { draft.ammo!.penetration = value; })} />
    </div>
  );
}

function MagazineFields({
  item,
  onPatch,
}: {
  item: OpcodeInventoryDraft;
  onPatch: (mutator: (draft: OpcodeInventoryDraft) => void) => void;
}) {
  const { t } = useT();
  const magazine = item.magazine!;
  return (
    <div className="flex flex-col gap-3">
      <TextField label={t("characterSheets.inventory.fields.caliber")} value={magazine.caliber} onChange={(value) => onPatch((draft) => { draft.magazine!.caliber = value; })} />
      <Stepper display="box" label={t("characterSheets.inventory.magazine.capacity")} value={magazine.containsMax} min={1} max={999} onChange={(value) => onPatch((draft) => { draft.magazine!.containsMax = value; })} />
      <p className="text-sm text-foreground/60">
        {t("characterSheets.inventory.magazine.loadedCount", {
          loaded: magazine.loaded.length,
          capacity: magazine.containsMax || "0",
        })}
      </p>
    </div>
  );
}

function ThrowableFields({
  item,
  onPatch,
}: {
  item: OpcodeInventoryDraft;
  onPatch: (mutator: (draft: OpcodeInventoryDraft) => void) => void;
}) {
  const { t } = useT();
  const ammo = item.ammo!;
  const explosive = ammo.explosives[0];
  return (
    <div className="flex flex-col gap-3">
      {explosive ? (
        <>
          <SelectField
            label={t("characterSheets.inventory.throwable.explosiveType")}
            value={explosive.type}
            onChange={(value) => onPatch((draft) => { draft.ammo!.explosives[0].type = value; })}
            options={OPCODE_EXPLOSIVE_TYPES.map((kind) => ({
              value: kind,
              label: t(`characterSheets.inventory.throwable.types.${kind}`),
            }))}
          />
          <TextField
            label={t("characterSheets.inventory.weapon.damage")}
            placeholder="2d6+1"
            value={damageDiceExprFromAmmoDraft(ammo)}
            onChange={(value) => onPatch((draft) => { setAmmoDamageDice(draft.ammo!, value); })}
          />
          <div className="flex flex-wrap gap-3">
            <Stepper display="box" step={0.1} label={t("characterSheets.inventory.throwable.lethal")} value={explosive.lethal} min={0} max={999} onChange={(value) => onPatch((draft) => { draft.ammo!.explosives[0].lethal = value; })} />
            <Stepper display="box" step={0.1} label={t("characterSheets.inventory.throwable.wound")} value={explosive.wound} min={0} max={999} onChange={(value) => onPatch((draft) => { draft.ammo!.explosives[0].wound = value; })} />
            <Stepper display="box" step={0.1} label={t("characterSheets.inventory.throwable.fuse")} value={explosive.fuse} min={0} max={999} onChange={(value) => onPatch((draft) => { draft.ammo!.explosives[0].fuse = value; })} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ArmorFields({
  item,
  onPatch,
}: {
  item: OpcodeInventoryDraft;
  onPatch: (mutator: (draft: OpcodeInventoryDraft) => void) => void;
}) {
  const { t } = useT();
  const armor = item.armor!;
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("characterSheets.inventory.armor.material")}
        value={armor.material}
        onChange={(value) => onPatch((draft) => { draft.armor!.material = value; })}
        options={OPCODE_ARMOR_MATERIALS.map((material) => ({
          value: material,
          label: t(`characterSheets.inventory.armor.materials.${material}`),
        }))}
      />
      <Stepper display="box" label={t("characterSheets.inventory.armor.layer")} value={armor.layer} min={0} max={20} onChange={(value) => onPatch((draft) => { draft.armor!.layer = value; })} />
      <div className="flex flex-wrap gap-3">
        {HEALTH_PARTS.map((part) => (
          <Stepper
            key={part}
            display="box"
            label={t(`characterSheets.health.${part}`)}
            value={armor.protection[part] || "0"}
            min={0}
            max={99}
            onChange={(value) => onPatch((draft) => { draft.armor!.protection[part] = value; })}
          />
        ))}
      </div>
    </div>
  );
}
