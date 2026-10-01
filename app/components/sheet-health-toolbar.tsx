"use client";

import { useSheetApp } from "@/app/components/sheet-app";
import { Card } from "@/app/components/card";
import { Stepper } from "@/app/components/ui";
import {
  formatOpcodeSaveRoll,
  readOpcodeFortitudeBonus,
  readOpcodeSheetSummary,
} from "@/lib/character-sheets/opcodeSheet";
import { useT } from "@/lib/character-sheets/i18n";
import { opcodeVitalsBarClass } from "@/lib/character-sheets/opcode-health-vitals";

export function SheetHealthToolbar({ className }: { className?: string }) {
  const { t } = useT();
  const { sheet, patchSheet } = useSheetApp();
  if (!sheet) return null;
  const summary = readOpcodeSheetSummary(sheet.stats, sheet.status);
  const fort = summary.fortitudeBonus;
  const stunRoll = formatOpcodeSaveRoll(summary.baseStats.wil, fort);
  const deathRoll = formatOpcodeSaveRoll(summary.baseStats.bod, fort);
  const stunMax = summary.stunGaugeMax;
  const stunCurrent = summary.stunGauge ?? 0;
  const stunRatio = stunMax > 0 ? stunCurrent / stunMax : 0;
  const career = sheet.mode === "career";

  return (
    <Card
      tone="secondary"
      radius="md"
      padding="sm"
      className={className}
      role="toolbar"
      aria-label={t("characterSheets.health.vitalsToolbar")}
    >
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
        {t("characterSheets.health.vitalsToolbar")}
      </p>
      <dl className="flex flex-col gap-2 text-xs">
        <div>
          <dt className="font-semibold text-foreground/55">{t("characterSheets.saves.stun")}</dt>
          <dd className="font-mono font-black">
            {stunRoll}{" "}
            <span className="text-foreground/60">
              {t("characterSheets.saves.vs", { value: summary.stunSaveDifficulty })}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground/55">{t("characterSheets.saves.death")}</dt>
          <dd className="font-mono font-black">
            {deathRoll}{" "}
            <span className="text-foreground/60">
              {t("characterSheets.saves.vs", { value: summary.deathSaveDifficulty })}
            </span>
          </dd>
        </div>
        <div>
          <dt className="mb-1 font-semibold text-foreground/55">
            {t("characterSheets.health.stunGauge")}
          </dt>
          <dd className="flex flex-col gap-1">
            <div
              className="h-2 overflow-hidden rounded-full bg-content3"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={stunMax}
              aria-valuenow={stunCurrent}
              aria-label={t("characterSheets.health.stunGauge")}
            >
              <div
                className={`h-full transition-[width] ${opcodeVitalsBarClass(stunRatio)}`}
                style={{ width: `${Math.min(100, Math.round(stunRatio * 100))}%` }}
              />
            </div>
            {career ? (
              <Stepper
                value={stunCurrent}
                min={0}
                max={stunMax}
                ariaLabel={t("characterSheets.health.stunGauge")}
                onChange={(value) =>
                  patchSheet((current) => ({
                    ...current,
                    status: {
                      ...current.status,
                      health: {
                        ...(current.status.health as Record<string, unknown>),
                        stun: { base: value, mod: 0 },
                      },
                    },
                  }))
                }
              />
            ) : (
              <span className="font-mono font-black">
                {stunCurrent}/{stunMax}
              </span>
            )}
            {summary.stunPenalty > 0 ? (
              <span className="text-foreground/60">
                {t("characterSheets.health.stunPenalty", { value: summary.stunPenalty })}
              </span>
            ) : null}
            {summary.vitalsUnconscious ? (
              <span className="font-semibold text-warning">{t("characterSheets.health.unconscious")}</span>
            ) : null}
            {summary.vitalsDeathSave ? (
              <span className="font-semibold text-error">{t("characterSheets.health.deathSaveActive")}</span>
            ) : null}
            {summary.vitalsDead ? (
              <span className="font-semibold text-error">{t("characterSheets.health.dead")}</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
