import {
  boundingBoxElement,
  parseCombatMapElements,
  type CombatMapDocument,
  type CombatMapElement,
} from "./combat-map-document.ts";
import { mapArtboardFromAttrs } from "./combat-map-bounds-clamp.ts";
import { elementOutsideArtboard } from "./combat-map-oob.ts";
import { combatMapElementBounds } from "./combat-map-element-geometry.ts";
import { compileSvgMapGeometry } from "./map-adapter/compile-svg-map.ts";
import { readSvgMetersPerUnit } from "./combat-map-units.ts";

export type CombatMapComplianceSeverity = "error" | "warning";

export type CombatMapComplianceIssue = {
  id: string;
  severity: CombatMapComplianceSeverity;
  messageKey: string;
  elementId?: string;
};

export type CombatMapComplianceInput = Pick<CombatMapDocument, "svg" | "layerGroups">;

function pushIssue(
  issues: CombatMapComplianceIssue[],
  issue: CombatMapComplianceIssue,
): void {
  issues.push(issue);
}

function elementArea(el: CombatMapElement): number | null {
  if (el.tag === "rect") {
    const w = Number(el.attrs.width);
    const h = Number(el.attrs.height);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return w * h;
  }
  if (el.tag === "circle") {
    const r = Number(el.attrs.r ?? 14);
    if (!Number.isFinite(r)) return null;
    return Math.PI * r * r;
  }
  if (el.tag === "path" && el.attrs.d) {
    const bounds = combatMapElementBounds(el);
    if (!bounds) return null;
    return bounds.width * bounds.height;
  }
  return null;
}

export function listCombatMapComplianceIssues(input: CombatMapComplianceInput): CombatMapComplianceIssue[] {
  const issues: CombatMapComplianceIssue[] = [];
  const svg = input.svg;

  if (!/<svg\b/i.test(svg)) {
    pushIssue(issues, { id: "missing-svg-root", severity: "error", messageKey: "combat.editor.compliance.missingSvgRoot" });
    return issues;
  }

  const mpu = readSvgMetersPerUnit(svg);
  if (mpu !== null && (!Number.isFinite(mpu) || mpu <= 0)) {
    pushIssue(issues, {
      id: "invalid-meters-per-unit",
      severity: "error",
      messageKey: "combat.editor.compliance.invalidMetersPerUnit",
    });
  }

  const elements = parseCombatMapElements(svg);
  const boundsElements = elements.filter((el) => el.kind === "bounding_box");
  if (boundsElements.length === 0) {
    pushIssue(issues, {
      id: "missing-bounds",
      severity: "error",
      messageKey: "combat.editor.compliance.missingBounds",
    });
  } else if (boundsElements.length > 1) {
    pushIssue(issues, {
      id: "multiple-bounds",
      severity: "error",
      messageKey: "combat.editor.compliance.multipleBounds",
    });
  } else {
    const bounds = boundsElements[0]!;
    const w = Number(bounds.attrs.width);
    const h = Number(bounds.attrs.height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      pushIssue(issues, {
        id: "invalid-bounds-size",
        severity: "error",
        messageKey: "combat.editor.compliance.invalidBoundsSize",
        elementId: bounds.id,
      });
    }
  }

  const idCounts = new Map<string, number>();
  for (const el of elements) {
    idCounts.set(el.id, (idCounts.get(el.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      pushIssue(issues, {
        id: `duplicate-id:${id}`,
        severity: "error",
        messageKey: "combat.editor.compliance.duplicateId",
        elementId: id,
      });
    }
  }

  const artboardEl = boundingBoxElement(svg);
  const artboard = artboardEl ? mapArtboardFromAttrs(artboardEl.attrs) : null;

  for (const el of elements) {
    if (el.kind === "unknown") {
      pushIssue(issues, {
        id: `unknown-kind:${el.id}`,
        severity: "error",
        messageKey: "combat.editor.compliance.unknownKind",
        elementId: el.id,
      });
    }

    if (el.kind === "npc_token" && !el.attrs["sheet-id"]?.trim()) {
      pushIssue(issues, {
        id: `npc-missing-sheet:${el.id}`,
        severity: "error",
        messageKey: "combat.editor.compliance.npcMissingSheet",
        elementId: el.id,
      });
    }

    const area = elementArea(el);
    if (area !== null && area <= 0 && el.kind !== "bounding_box") {
      pushIssue(issues, {
        id: `zero-area:${el.id}`,
        severity: "warning",
        messageKey: "combat.editor.compliance.zeroArea",
        elementId: el.id,
      });
    }

    if (artboard && el.kind !== "bounding_box" && elementOutsideArtboard(el, artboard)) {
      pushIssue(issues, {
        id: `outside-bounds:${el.id}`,
        severity: "warning",
        messageKey: "combat.editor.compliance.outsideBounds",
        elementId: el.id,
      });
    }
  }

  for (const group of input.layerGroups ?? []) {
    for (const memberId of group.memberIds) {
      if (!elements.some((el) => el.id === memberId)) {
        pushIssue(issues, {
          id: `group-missing-member:${group.id}:${memberId}`,
          severity: "warning",
          messageKey: "combat.editor.compliance.groupMissingMember",
          elementId: memberId,
        });
      }
    }
  }

  try {
    const geom = compileSvgMapGeometry(svg);
    if (!geom.solveBounds) {
      pushIssue(issues, {
        id: "missing-solve-bounds",
        severity: "error",
        messageKey: "combat.editor.compliance.missingSolveBounds",
      });
    }
  } catch {
    pushIssue(issues, {
      id: "compile-failed",
      severity: "error",
      messageKey: "combat.editor.compliance.compileFailed",
    });
  }

  return issues;
}

export function combatMapComplianceReport(input: CombatMapComplianceInput): {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: CombatMapComplianceIssue[];
} {
  const issues = listCombatMapComplianceIssues(input);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return { ok: errorCount === 0, errorCount, warningCount, issues };
}

export function complianceBlocksImport(issues: readonly CombatMapComplianceIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
