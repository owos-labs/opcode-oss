/** Opcode D10 cover/wall presets (AR + SSP per 1.6 护甲和掩体). */

export type CombatMapCoverPresetKind = "barrier" | "concealment";

export type CombatMapCoverPreset = {
  id: string;
  ar: number;
  ssp: number;
  kinds: readonly CombatMapCoverPresetKind[];
};

export const COMBAT_MAP_COVER_PRESETS: readonly CombatMapCoverPreset[] = [
  { id: "dryWood", ar: 10, ssp: 15, kinds: ["barrier", "concealment"] },
  { id: "woodWall", ar: 15, ssp: 20, kinds: ["barrier"] },
  { id: "carDoor", ar: 20, ssp: 25, kinds: ["barrier", "concealment"] },
  { id: "tree", ar: 35, ssp: 25, kinds: ["concealment"] },
  { id: "iron", ar: 40, ssp: 30, kinds: ["barrier"] },
  { id: "temperedGlass", ar: 10, ssp: 2, kinds: ["concealment"] },
  { id: "brickWall", ar: 40, ssp: 25, kinds: ["barrier"] },
  { id: "sandbag", ar: 45, ssp: 30, kinds: ["barrier", "concealment"] },
  { id: "concrete", ar: 55, ssp: 20, kinds: ["barrier"] },
  { id: "armoredSteel", ar: 65, ssp: 25, kinds: ["barrier"] },
  { id: "boronCarbide", ar: 60, ssp: 5, kinds: ["barrier"] },
  { id: "rolledHomogeneous", ar: 100, ssp: 30, kinds: ["barrier"] },
] as const;

export function coverPresetsForKind(kind: CombatMapCoverPresetKind): CombatMapCoverPreset[] {
  return COMBAT_MAP_COVER_PRESETS.filter((preset) => preset.kinds.includes(kind));
}

export function findMatchingCoverPreset(
  attrs: Record<string, string>,
  kind: CombatMapCoverPresetKind,
): CombatMapCoverPreset | null {
  const ar = Number(attrs.ar);
  const ssp = Number(attrs.ssp);
  if (!Number.isFinite(ar) || !Number.isFinite(ssp)) return null;
  return (
    coverPresetsForKind(kind).find((preset) => preset.ar === ar && preset.ssp === ssp) ?? null
  );
}

export function coverPresetAttrs(preset: CombatMapCoverPreset): Record<string, string> {
  return {
    ar: String(preset.ar),
    ssp: String(preset.ssp),
  };
}

export function coverPresetSelectOptions(
  kind: CombatMapCoverPresetKind,
  t: (key: string, params?: Record<string, unknown>) => string,
): { value: string; label: string }[] {
  return coverPresetsForKind(kind).map((preset) => ({
    value: preset.id,
    label: `${t(`combat.editor.coverPreset.${preset.id}`)} (${t("combat.editor.coverPreset.stats", { ar: preset.ar, ssp: preset.ssp })})`,
  }));
}
