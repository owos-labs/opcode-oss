"use client";

import { Modal } from "@heroui/react/modal";
import { useEffect, useMemo, useRef, useState } from "react";

import { ComboField, ModalShortcutFooter, SelectField, Stepper, TextField } from "@/app/components/ui";
import { useT } from "@/lib/character-sheets/i18n";
import type { OpcodeInventoryDraft } from "@/lib/character-sheets/opcodeInventory.types";
import type { OpcodeSheetSummary } from "@/lib/character-sheets/opcodeSheet";
import {
  buildAttackRollPresetLabel,
  buildCustomAttackRollPresetFormula,
  defaultAttackSkillName,
  isRangedWeaponDraft,
  listAttackSkillOptions,
  listAttackSpecSuggestionNames,
  listWeaponDrafts,
  parseWeaponAccuracy,
  type AttackRollPreset,
  type AttackRollPresetInput,
  type RollPresetLabels,
} from "@/lib/character-sheets/roll-presets";

type AttackPresetModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: OpcodeSheetSummary;
  drafts: OpcodeInventoryDraft[];
  labels: RollPresetLabels;
  preset?: AttackRollPreset | null;
  onConfirm: (input: AttackRollPresetInput) => void;
};

export function AttackPresetModal({
  open,
  onOpenChange,
  summary,
  drafts,
  labels,
  preset,
  onConfirm,
}: AttackPresetModalProps) {
  const { t } = useT();
  const editing = Boolean(preset);
  const weapons = useMemo(() => listWeaponDrafts(drafts), [drafts]);
  const [weaponId, setWeaponId] = useState("");
  const [skillName, setSkillName] = useState("");
  const [specializationName, setSpecializationName] = useState("");
  const [adjustment, setAdjustment] = useState("0");
  const [presetName, setPresetName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const hydratedKey = useRef<string | null>(null);

  const weapon = weapons.find((entry) => entry.id === weaponId) ?? weapons[0];
  const ranged = weapon ? isRangedWeaponDraft(weapon) : false;
  const weaponAccuracy = weapon ? parseWeaponAccuracy(weapon) : 0;
  const skillOptions = listAttackSkillOptions(summary, weapon);
  const specSuggestions = skillName ? listAttackSpecSuggestionNames(summary, skillName) : [];
  const suggestedName = skillName ? buildAttackRollPresetLabel(skillName, labels) : "";
  const previewInput = weapon && skillName
    ? {
        skillName,
        specializationName,
        adjustment: ranged ? 0 : Number(adjustment) || 0,
      }
    : null;
  const preview = weapon && previewInput
    ? buildCustomAttackRollPresetFormula(summary, weapon, previewInput, labels)
    : null;

  useEffect(() => {
    if (!open) {
      hydratedKey.current = null;
      return;
    }
    if (!weapons.length || !preset) return;
    const key = `edit:${preset.id}`;
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    const nextWeapon = weapons.find((entry) => entry.id === preset.itemId) ?? weapons[0];
    if (!nextWeapon) return;
    setWeaponId(nextWeapon.id);
    setSkillName(preset.skillName.trim() || defaultAttackSkillName(summary, nextWeapon));
    setSpecializationName(preset.specializationName);
    setAdjustment(String(preset.adjustment));
    setPresetName(preset.label);
    setNameTouched(true);
  }, [open, preset, summary, weapons]);

  useEffect(() => {
    if (!open) return;
    if (!weapons.length || preset) return;
    if (hydratedKey.current === "add") return;
    hydratedKey.current = "add";
    const first = weapons[0];
    if (!first) return;
    setWeaponId(first.id);
    setSkillName(defaultAttackSkillName(summary, first));
    setSpecializationName("");
    setAdjustment("0");
    setPresetName("");
    setNameTouched(false);
  }, [open, preset, summary, weapons]);

  useEffect(() => {
    if (!open || !specializationName || specSuggestions.includes(specializationName)) return;
    setSpecializationName("");
  }, [open, skillName, specSuggestions, specializationName]);

  useEffect(() => {
    if (!open || nameTouched || !suggestedName) return;
    setPresetName(suggestedName);
  }, [open, nameTouched, suggestedName]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function skillLabel(name: string) {
    return labels.skill(name);
  }

  function specLabel(skill: string, specName: string) {
    return labels.specialization(skill, specName);
  }

  const canConfirm = Boolean(weapon && skillName && preview && presetName.trim());

  return (
    <Modal isOpen={open} onOpenChange={handleOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog
            aria-label={editing ? t("sheet.presets.attackEditModalTitle") : t("sheet.presets.attackModalTitle")}
            className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto"
          >
            <h2 className="text-lg font-black">
              {editing ? t("sheet.presets.attackEditModalTitle") : t("sheet.presets.attackModalTitle")}
            </h2>

            <SelectField
              label={t("sheet.presets.attackWeapon")}
              value={weapon?.id ?? ""}
              onChange={setWeaponId}
              options={weapons.map((entry) => ({
                value: entry.id,
                label: entry.name.trim() || t("sheet.presets.unnamedWeapon"),
              }))}
            />

            <ComboField
              label={t("sheet.presets.attackSkill")}
              value={skillName}
              onChange={setSkillName}
              placeholder={t("sheet.presets.attackSkillPlaceholder")}
              searchable
              allowCustom={false}
              options={skillOptions.map((name) => ({
                value: name,
                label: skillLabel(name),
              }))}
            />

            <ComboField
              label={t("sheet.presets.attackSpecialization")}
              value={specializationName}
              onChange={setSpecializationName}
              placeholder={t("sheet.presets.attackSpecPlaceholder")}
              searchable
              allowCustom={false}
              options={[
                { value: "", label: t("sheet.presets.attackNoSpecialization") },
                ...specSuggestions.map((name) => ({
                  value: name,
                  label: specLabel(skillName, name),
                })),
              ]}
            />

            {ranged ? (
              <p className="text-sm text-foreground/70">
                {t("sheet.presets.attackAccuracyFromWeapon", {
                  value: weaponAccuracy > 0 ? `+${weaponAccuracy}` : String(weaponAccuracy),
                })}
              </p>
            ) : (
              <Stepper
                label={t("sheet.presets.attackAdjustment")}
                value={adjustment}
                min={-10}
                max={10}
                ariaLabel={t("sheet.presets.attackAdjustment")}
                onChange={setAdjustment}
              />
            )}

            <TextField
              label={t("sheet.presets.attackName")}
              value={presetName}
              placeholder={suggestedName || t("sheet.presets.attackNamePlaceholder")}
              onChange={(value) => {
                setNameTouched(true);
                setPresetName(value);
              }}
            />

            {preview ? (
              <div className="rounded-lg bg-content3 px-3 py-2">
                <p className="mb-1 text-sm font-semibold text-foreground/70">{presetName.trim() || suggestedName}</p>
                <p className="font-mono text-sm">{preview}</p>
              </div>
            ) : null}

            <ModalShortcutFooter
              cancelLabel={t("common.close")}
              onCancel={() => handleOpenChange(false)}
              confirmLabel={editing ? t("sheet.presets.attackEditConfirm") : t("sheet.presets.attackConfirm")}
              confirmVariant="primary"
              confirmDisabled={!canConfirm}
              enterFromInputs
              onConfirm={() => {
                if (!weapon || !canConfirm || !previewInput) return;
                onConfirm({
                  id: preset?.id,
                  itemId: weapon.id,
                  skillName,
                  specializationName,
                  adjustment: previewInput.adjustment,
                  label: presetName.trim(),
                });
                handleOpenChange(false);
              }}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
