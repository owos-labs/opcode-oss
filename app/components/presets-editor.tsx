"use client";

import { Button } from "@heroui/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AttackPresetModal } from "@/app/components/attack-preset-modal";
import { useSheetApp } from "@/app/components/sheet-app";
import { Card } from "@/app/components/card";
import { useT } from "@/lib/character-sheets/i18n";
import {
  findOpcodeSpecializationPreset,
  OPCODE_SKILL_DEFINITIONS,
} from "@/lib/character-sheets/opcodeSkillDefinitions";
import { readOpcodeSheetSummary } from "@/lib/character-sheets/opcodeSheet";
import {
  createCustomAttackRollPreset,
  listSavePresetColumn,
  listWeaponDrafts,
  readAttackRollPresets,
  resolveAttackPresetFormulas,
  SAVE_PRESET_COLUMNS,
  writeAttackRollPresets,
  type AttackRollPreset,
  type AttackRollPresetInput,
  type RollPresetLabels,
  type SavePresetColumn,
} from "@/lib/character-sheets/roll-presets";

export function PresetsEditor() {
  const { t } = useT();
  const { sheet, drafts, patchSheet } = useSheetApp();
  const [attackModalOpen, setAttackModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AttackRollPreset | null>(null);

  const labels = useMemo<RollPresetLabels>(() => ({
    stat: (key) => t(`characterSheets.stats.${key}`),
    skill: (name) => (
      Object.hasOwn(OPCODE_SKILL_DEFINITIONS, name)
        ? t(`characterSheets.skillNames.${name}`)
        : name
    ),
    specialization: (skillName, specName) => {
      const preset = findOpcodeSpecializationPreset(skillName, specName);
      return preset
        ? t(`characterSheets.specializationPresets.${skillName}.${preset.key}`)
        : specName;
    },
    save: (column) => t(`characterSheets.saves.${column}`),
    bonus: t("sheet.presets.bonus"),
    adjustment: t("sheet.presets.adjustment"),
    accuracy: t("characterSheets.inventory.weapon.accuracy"),
    fortitude: t("sheet.presets.fortitude"),
  }), [t]);

  if (!sheet) return null;

  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const saveColumns = SAVE_PRESET_COLUMNS.map((column) => ({
    column,
    entries: listSavePresetColumn(column, summary, labels),
  }));
  const attackPresets = readAttackRollPresets(sheet.stats);
  const weapons = listWeaponDrafts(drafts);
  const inventoryHref = `/character-sheet/${sheet.id}/inventory`;

  function saveAttackPreset(input: AttackRollPresetInput) {
    const weapon = drafts.find((entry) => entry.id === input.itemId);
    if (!weapon) return;
    const preset = createCustomAttackRollPreset(summary, weapon, input, labels);
    if (!preset) return;
    patchSheet((current) => {
      const existing = readAttackRollPresets(current.stats);
      const next = input.id
        ? existing.map((entry) => (entry.id === input.id ? preset : entry))
        : [...existing, preset];
      return {
        ...current,
        stats: writeAttackRollPresets(current.stats, next),
      };
    });
  }

  function removeAttackPreset(id: string) {
    patchSheet((current) => ({
      ...current,
      stats: writeAttackRollPresets(
        current.stats,
        readAttackRollPresets(current.stats).filter((entry) => entry.id !== id),
      ),
    }));
  }

  function openAddModal() {
    setEditingPreset(null);
    setAttackModalOpen(true);
  }

  function openEditModal(preset: AttackRollPreset) {
    setEditingPreset(preset);
    setAttackModalOpen(true);
  }

  function handleAttackModalChange(open: boolean) {
    setAttackModalOpen(open);
    if (!open) setEditingPreset(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Card tone="secondary" radius="md" padding="sm">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/55">{t("sheet.presets")}</p>
        <p className="mt-1 text-sm text-foreground/70">{t("sheet.presets.savesHint")}</p>
      </Card>

      <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto pb-1 md:grid-cols-3 xl:grid-cols-6">
        {saveColumns.map(({ column, entries }) => (
          <SavePresetColumnCard key={column} column={column} entries={entries} title={labels.save(column)} />
        ))}
      </div>

      <Card tone="secondary" radius="md" padding="sm" className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">{t("sheet.presets.attacks")}</h2>
            <p className="mt-1 text-xs text-foreground/60">{t("sheet.presets.attacksHint")}</p>
          </div>
          {weapons.length ? (
            <Button size="sm" variant="outline" className="gap-2" onPress={openAddModal}>
              <Plus className="size-4" />
              {t("sheet.presets.addAttackAction")}
            </Button>
          ) : null}
        </div>

        {!weapons.length ? (
          <Link
            href={inventoryHref}
            className="inline-flex min-h-11 w-fit items-center gap-1 rounded-lg border border-border1 bg-content3 px-3 text-sm font-semibold shadow1 transition-colors hover:bg-content2 focus-visible:shadow-primary"
          >
            {t("sheet.presets.noWeaponsPrefix")}
            <span className="font-black text-primary">{t("sheet.presets.addWeapon")}</span>
          </Link>
        ) : null}

        {attackPresets.length ? (
          <ul className="flex flex-col gap-2">
            {attackPresets.map((preset) => {
              const weapon = drafts.find((entry) => entry.id === preset.itemId);
              const { formula, totalFormula } = resolveAttackPresetFormulas(summary, weapon, preset, labels);
              return (
              <li
                key={preset.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border1 bg-content3 px-3 py-2"
              >
                <PresetFormulaDisplay
                  label={preset.label}
                  formula={formula}
                  totalFormula={totalFormula}
                />
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("sheet.presets.editAttack")}
                    className="size-9 min-w-9 p-0"
                    onPress={() => openEditModal(preset)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("sheet.presets.removeAttack")}
                    className="size-9 min-w-9 p-0"
                    onPress={() => removeAttackPreset(preset.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        ) : weapons.length ? (
          <p className="text-sm text-foreground/60">{t("sheet.presets.attacksEmpty")}</p>
        ) : null}
      </Card>

      <AttackPresetModal
        open={attackModalOpen}
        onOpenChange={handleAttackModalChange}
        summary={summary}
        drafts={drafts}
        labels={labels}
        preset={editingPreset}
        onConfirm={saveAttackPreset}
      />
    </div>
  );
}

function PresetFormulaDisplay({
  label,
  formula,
  totalFormula,
  size = "md",
}: {
  label: string;
  formula: string;
  totalFormula: string;
  size?: "sm" | "md";
}) {
  const total = totalFormula;
  const showDetail = total !== formula;

  return (
    <div className="min-w-0">
      <p className={`break-all font-semibold ${size === "sm" ? "text-xs" : "text-sm"}`}>
        <span className={size === "sm" ? "text-foreground/55" : "font-semibold text-foreground"}>{label}</span>
        <span className="text-foreground/55"> = </span>
        <span className="font-mono">{total}</span>
      </p>
      {showDetail ? (
        <p className={`mt-0.5 break-all font-mono text-foreground/55 ${size === "sm" ? "text-[11px]" : "text-xs"}`}>
          {formula}
        </p>
      ) : null}
    </div>
  );
}

function SavePresetColumnCard({
  column,
  title,
  entries,
}: {
  column: SavePresetColumn;
  title: string;
  entries: Array<{ id: string; label: string; formula: string; totalFormula: string }>;
}) {
  return (
    <Card tone="secondary" radius="md" padding="sm" className="min-w-[11rem] gap-3">
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={`${column}:${entry.id}`} className="rounded-lg bg-content3 px-2 py-2">
            <PresetFormulaDisplay
              label={entry.label}
              formula={entry.formula}
              totalFormula={entry.totalFormula}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
