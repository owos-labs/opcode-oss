import {
  normalizeCombatMapDocument,
  pruneCombatMapLayerGroups,
  type CombatMapDocument,
} from "./combat-map-document.ts";
import { complianceBlocksImport, listCombatMapComplianceIssues } from "./combat-map-compliance.ts";

export const COMBAT_MAP_BUNDLE_KIND = "opcode.combat-map";
export const COMBAT_MAP_BUNDLE_VERSION = 1;

export type CombatMapExportBundle = {
  version: typeof COMBAT_MAP_BUNDLE_VERSION;
  kind: typeof COMBAT_MAP_BUNDLE_KIND;
  exported_at: string;
  map: CombatMapDocument;
};

export function serializeCombatMapExport(map: CombatMapDocument): string {
  const bundle: CombatMapExportBundle = {
    version: COMBAT_MAP_BUNDLE_VERSION,
    kind: COMBAT_MAP_BUNDLE_KIND,
    exported_at: new Date().toISOString(),
    map,
  };
  return JSON.stringify(bundle, null, 2);
}

export function exportCombatMapFilename(map: CombatMapDocument): string {
  const base = map.title.trim().replace(/[^\w\u4e00-\u9fff-]+/g, "-").replace(/^-+|-+$/g, "") || "combat-map";
  return `${base}.combat-map.json`;
}

export type CombatMapImportParseResult =
  | { ok: true; map: CombatMapDocument }
  | { ok: false; errorKey: "combat.editor.import.invalidJson" | "combat.editor.import.invalidDocument" };

export function parseCombatMapExportFile(text: string): CombatMapImportParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errorKey: "combat.editor.import.invalidJson" };
  }
  const doc =
    raw && typeof raw === "object" && (raw as CombatMapExportBundle).kind === COMBAT_MAP_BUNDLE_KIND
      ? (raw as CombatMapExportBundle).map
      : raw;
  const map = normalizeCombatMapDocument(doc);
  if (!map) return { ok: false, errorKey: "combat.editor.import.invalidDocument" };
  return { ok: true, map };
}

/** Assign a fresh OPFS id; keep geometry and layer metadata. */
export function prepareImportedCombatMap(map: CombatMapDocument): CombatMapDocument {
  const now = new Date().toISOString();
  return {
    ...map,
    id: crypto.randomUUID(),
    inCombat: false,
    updated_at: now,
    layerGroups: pruneCombatMapLayerGroups(map.svg, map.layerGroups),
  };
}

export type CombatMapImportResult =
  | { ok: true; map: CombatMapDocument }
  | {
      ok: false;
      errorKey:
        | "combat.editor.import.invalidJson"
        | "combat.editor.import.invalidDocument"
        | "combat.editor.import.complianceFailed";
      issues?: ReturnType<typeof listCombatMapComplianceIssues>;
    };

export function validateCombatMapImport(text: string): CombatMapImportResult {
  const parsed = parseCombatMapExportFile(text);
  if (!parsed.ok) return parsed;
  const issues = listCombatMapComplianceIssues(parsed.map);
  if (complianceBlocksImport(issues)) {
    return { ok: false, errorKey: "combat.editor.import.complianceFailed", issues };
  }
  return { ok: true, map: prepareImportedCombatMap(parsed.map) };
}

export function importCombatMapFromText(text: string): CombatMapImportResult {
  return validateCombatMapImport(text);
}

/** Convenience for tests and blank maps. */
export function createCombatMapDocumentFromImport(text: string): CombatMapDocument | null {
  const result = importCombatMapFromText(text);
  return result.ok ? result.map : null;
}

export function isCombatMapExportBundle(raw: unknown): raw is CombatMapExportBundle {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as CombatMapExportBundle;
  return o.kind === COMBAT_MAP_BUNDLE_KIND && o.version === COMBAT_MAP_BUNDLE_VERSION && !!normalizeCombatMapDocument(o.map);
}

export function roundTripExport(map: CombatMapDocument): CombatMapDocument | null {
  return createCombatMapDocumentFromImport(serializeCombatMapExport(map));
}
