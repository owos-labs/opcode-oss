"use client";

import { Button } from "@heroui/react";
import { Modal } from "@heroui/react/modal";
import { Brain, Crosshair, Dumbbell, Sparkles, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { Card, ModalShortcutFooter, SelectField, Stepper, TextField } from "@/app/components/ui";
import {
  calculateOpcodeSkillPointBudget,
  calculateOpcodeSkillPointsUsed,
  formatOpcodeSaveRoll,
  formatOpcodeSpecializationRollLine,
  opcodeSpecializationNameTaken,
  parseOpcodeSkillLevel,
  readOpcodeFortitudeBonus,
  readOpcodeSheetSummary,
} from "@/lib/character-sheets/opcodeSheet";
import {
  findOpcodeSpecializationPreset,
  groupOpcodeSkillRows,
  OPCODE_SKILL_DEFINITIONS,
  OPCODE_SPECIALIZATION_PRESETS,
  type OpcodeSkillGroupKey,
} from "@/lib/character-sheets/opcodeSkillDefinitions";
import { useT } from "@/lib/character-sheets/i18n";

const GROUP_ICONS: Record<OpcodeSkillGroupKey, LucideIcon> = {
  general: Brain,
  social: Users,
  technical: Wrench,
  combat: Crosshair,
  physical: Dumbbell,
  custom: Sparkles,
};

export function AttributesEditor() {
  const { t } = useT();
  const { sheet, form, patchForm } = useSheetApp();
  const [customSpecSkillIndex, setCustomSpecSkillIndex] = useState<number | null>(null);
  const [customSpecName, setCustomSpecName] = useState("");
  if (!sheet || !form) return null;
  const locked = sheet.mode === "career";
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const budget = calculateOpcodeSkillPointBudget(form.skillPointMode, form.baseStats);
  const used = calculateOpcodeSkillPointsUsed(form.skills);
  const remaining = budget.budget - used;
  const groups = groupOpcodeSkillRows(form.skills);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-black">{t("characterSheets.skills.title")}</h2>
          <p className={`font-mono text-sm font-semibold ${remaining < 0 ? "text-error" : ""}`}>
            {used}/{budget.budget}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SelectField
            label={t("characterSheets.skills.budgetMode")}
            value={form.skillPointMode}
            disabled={locked}
            className="min-w-0"
            hint={
              form.skillPointMode === "sum"
                ? t("characterSheets.skills.budgetFromAttributes", {
                    total: budget.attributePointsTotal,
                    points: budget.budget,
                  })
                : t("characterSheets.skills.budgetFromCap", {
                    stat: t(`characterSheets.stats.${budget.highestStat.key}`),
                    value: budget.highestStat.value,
                    points: budget.budget,
                  })
            }
            onChange={(value) =>
              patchForm((next) => {
                next.skillPointMode = value === "sum" ? "sum" : "cap";
              })
            }
            options={[
              { value: "cap", label: t("characterSheets.skills.budgetModeCap") },
              { value: "sum", label: t("characterSheets.skills.budgetModeSum") },
            ]}
          />
          <SelectField
            label={t("characterSheets.health.mode")}
            value={form.healthMode}
            disabled={locked}
            className="min-w-0"
            hint={
              form.healthMode === "normal"
                ? t("characterSheets.health.normalHint")
                : t("characterSheets.health.simpleHint")
            }
            onChange={(value) =>
              patchForm((next) => {
                next.healthMode = value === "normal" ? "normal" : "simple";
              })
            }
            options={[
              { value: "simple", label: t("characterSheets.health.simple") },
              { value: "normal", label: t("characterSheets.health.normal") },
            ]}
          />
        </div>
      </div>
      {locked ? <p className="text-sm text-foreground/60">{t("sheet.careerLocked")}</p> : null}

      <section>
        <h2 className="mb-3 text-lg font-black">{t("characterSheets.sections.preview")}</h2>
        <div className="flex flex-nowrap gap-4 overflow-x-auto pb-1 scrollbar-subtle">
          <Cell label={t("characterSheets.points.skillPointsUsed")} value={`${used} / ${budget.budget}`} warn={remaining < 0} />
          <Cell label={t("characterSheets.skills.budgetRemaining")} value={String(remaining)} warn={remaining < 0} />
          <Cell label={t("characterSheets.saves.stun")} value={formatOpcodeSaveRoll(summary.baseStats.wil, readOpcodeFortitudeBonus(summary.skills))} />
          <Cell label={t("characterSheets.saves.death")} value={formatOpcodeSaveRoll(summary.baseStats.bod, readOpcodeFortitudeBonus(summary.skills))} />
          <Cell label={t("characterSheets.stats.mov")} value={`${summary.mov}${t("characterSheets.units.meters")}`} />
          <Cell label={t("characterSheets.stats.sensA")} value={`${summary.sensA}${t("characterSheets.units.meters")}`} />
          <Cell label={t("characterSheets.stats.sensV")} value={`${summary.sensV}${t("characterSheets.units.meters")}`} />
          <Cell label={t("characterSheets.stats.sensS")} value={`${summary.sensS}${t("characterSheets.units.meters")}`} />
          <Cell label={t("characterSheets.stats.weight")} value={String(summary.weight)} />
          <Cell label={t("characterSheets.stats.hp")} value={String(summary.maxHealth)} />
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const Icon = GROUP_ICONS[group.key];
          return (
            <Card key={group.key} className="p-4">
            <details open>
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg">
                <span className="flex size-9 items-center justify-center rounded-full bg-content2">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black">{t(`characterSheets.skillGroups.${group.key}.title`)}</h3>
                  <p className="text-sm text-foreground/60">{t(`characterSheets.skillGroups.${group.key}.hint`)}</p>
                </div>
              </summary>
                <div className="mt-4 flex flex-col gap-6">
                  {group.items.map(({ skill, index }) => (
                    <div key={skill.id} className="min-w-0">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-lg font-bold">
                          {Object.hasOwn(OPCODE_SKILL_DEFINITIONS, skill.name)
                            ? t(`characterSheets.skillNames.${skill.name}`)
                            : skill.name}
                        </p>
                        <Stepper
                          value={skill.value}
                          min={0}
                          max={10}
                          disabled={locked}
                          ariaLabel={skill.name}
                          onChange={(value) =>
                            patchForm((next) => {
                              next.skills[index].value = value;
                            })
                          }
                        />
                      </div>
                      {Object.hasOwn(OPCODE_SKILL_DEFINITIONS, skill.name) ? (
                        <details className="mt-2 rounded-lg">
                          <summary className="cursor-pointer rounded-lg px-1 text-sm font-semibold text-foreground/60 hover:bg-content2/70">
                            {t("characterSheets.skills.about")}
                          </summary>
                          <p className="mt-2 text-sm leading-6 text-foreground/80">
                            {t(`characterSheets.skillDescriptions.${skill.name}`)}
                          </p>
                        </details>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(OPCODE_SPECIALIZATION_PRESETS[skill.name] || [])
                          .filter((preset) => !(skill.specializations || []).some((spec) => spec.name === preset.name))
                          .map((preset) => (
                            <button
                              key={preset.key}
                              type="button"
                              disabled={locked}
                              className="min-h-11 rounded-full border border-border1 bg-content3 px-3 text-xs font-bold shadow1 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() =>
                                patchForm((next) => {
                                  next.skills[index].specializations ||= [];
                                  next.skills[index].specializations!.push({
                                    id: crypto.randomUUID(),
                                    name: preset.name,
                                    value: "0",
                                  });
                                })
                              }
                            >
                              + {t(`characterSheets.specializationPresets.${skill.name}.${preset.key}`)}
                            </button>
                          ))}
                        <button
                          type="button"
                          disabled={locked}
                          className="min-h-11 rounded-full border border-dashed border-border1 bg-content2 px-3 text-xs font-bold text-foreground/80 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => {
                            setCustomSpecSkillIndex(index);
                            setCustomSpecName("");
                          }}
                        >
                          + {t("characterSheets.skills.addCustomSpecialization")}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-col gap-2">
                        {(skill.specializations || []).map((spec, specIndex) => (
                          <div key={spec.id} className="flex items-center justify-between gap-2 rounded-lg px-1">
                            <p className="min-w-0 truncate font-semibold">
                              {findOpcodeSpecializationPreset(skill.name, spec.name)
                                ? t(`characterSheets.specializationPresets.${skill.name}.${findOpcodeSpecializationPreset(skill.name, spec.name)!.key}`)
                                : spec.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <Stepper
                                value={spec.value}
                                min={0}
                                max={10}
                                disabled={locked}
                                onChange={(value) =>
                                  patchForm((next) => {
                                    next.skills[index].specializations![specIndex].value = String(value);
                                  })
                                }
                              />
                              <button
                                type="button"
                                disabled={locked}
                                aria-label={t("characterSheets.skills.removeSpecialization")}
                                className="min-h-11 rounded-lg px-2 text-sm text-foreground/50 hover:bg-content2 disabled:cursor-not-allowed"
                                onClick={() =>
                                  patchForm((next) => {
                                    next.skills[index].specializations?.splice(specIndex, 1);
                                  })
                                }
                              >
                                ×
                              </button>
                            </div>
                            {parseOpcodeSkillLevel(spec.value) > 0 ? (
                              <span className="sr-only">
                                {formatOpcodeSpecializationRollLine(skill.stats, form.baseStats, spec.value)}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
              </Card>
            );
          })}
        </div>

      <Modal
        isOpen={customSpecSkillIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCustomSpecSkillIndex(null);
            setCustomSpecName("");
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog
              aria-label={t("characterSheets.skills.addCustomSpecialization")}
              className="flex flex-col gap-4"
            >
              <h2 className="text-lg font-black">{t("characterSheets.skills.addCustomSpecialization")}</h2>
              <p className="text-sm leading-6 text-foreground/70">{t("characterSheets.skills.specializationGuide")}</p>
              <TextField
                label={t("characterSheets.skills.specialization")}
                value={customSpecName}
                disabled={locked}
                onChange={setCustomSpecName}
              />
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => {
                  setCustomSpecSkillIndex(null);
                  setCustomSpecName("");
                }}
                confirmLabel={t("characterSheets.skills.addSpecialization")}
                confirmVariant="primary"
                confirmDisabled={
                  locked ||
                  customSpecSkillIndex === null ||
                  opcodeSpecializationNameTaken(
                    form.skills[customSpecSkillIndex]?.specializations,
                    customSpecName,
                  )
                }
                enterFromInputs
                onConfirm={() => {
                  if (customSpecSkillIndex === null) return;
                  const name = customSpecName.trim();
                  if (opcodeSpecializationNameTaken(form.skills[customSpecSkillIndex].specializations, name)) return;
                  patchForm((next) => {
                    next.skills[customSpecSkillIndex].specializations ||= [];
                    next.skills[customSpecSkillIndex].specializations!.push({
                      id: crypto.randomUUID(),
                      name,
                      value: "0",
                    });
                  });
                  setCustomSpecSkillIndex(null);
                  setCustomSpecName("");
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function Cell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-28 shrink-0">
      <p className="text-xs font-semibold text-foreground/60">{label}</p>
      <p className={`font-mono text-sm font-black ${warn ? "text-error" : ""}`}>{value}</p>
    </div>
  );
}
