import assert from "node:assert/strict";
import test from "node:test";

import { createCombatMapDocument, insertCombatMapRect } from "./combat-map-document.ts";
import {
  combatMapComplianceReport,
  complianceBlocksImport,
  listCombatMapComplianceIssues,
} from "./combat-map-compliance.ts";

test("default combat map passes compliance", () => {
  const map = createCombatMapDocument("OK");
  const report = combatMapComplianceReport(map);
  assert.equal(report.ok, true);
  assert.equal(report.errorCount, 0);
});

test("missing bounding_box fails compliance", () => {
  const map = createCombatMapDocument("Bad");
  map.svg = `<svg viewBox="0 0 100 100"><rect id="w" name="w" x="0" y="0" width="10" height="10" type="barrier"/></svg>`;
  const issues = listCombatMapComplianceIssues(map);
  assert.equal(complianceBlocksImport(issues), true);
  assert.ok(issues.some((issue) => issue.messageKey === "combat.editor.compliance.missingBounds"));
});

test("duplicate element ids fail compliance", () => {
  let svg = insertCombatMapRect(createCombatMapDocument("Dup").svg, {
    kind: "barrier",
    id: "wall-a",
    name: "wall-a",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  svg = svg.replace(/<\/svg>/i, `<rect id="wall-a" name="wall-b" x="20" y="0" width="10" height="10" type="barrier"/>\n</svg>`);
  const issues = listCombatMapComplianceIssues({ svg });
  assert.ok(issues.some((issue) => issue.messageKey === "combat.editor.compliance.duplicateId"));
});

test("npc token without sheet-id fails compliance", () => {
  const map = createCombatMapDocument("Npc");
  map.svg = map.svg.replace(
    /<\/svg>/i,
    `<circle id="npc-1" name="npc-1" cx="50" cy="50" r="14" type="npc_token"/>\n</svg>`,
  );
  const issues = listCombatMapComplianceIssues(map);
  assert.ok(issues.some((issue) => issue.messageKey === "combat.editor.compliance.npcMissingSheet"));
});

test("element outside artboard is a warning only", () => {
  const map = createCombatMapDocument("Outside");
  map.svg = map.svg.replace(
    /<\/svg>/i,
    `<rect id="room-far" name="room-far" x="5000" y="5000" width="20" height="20" type="room" fill="#FFCC24"/>\n</svg>`,
  );
  const report = combatMapComplianceReport(map);
  assert.equal(report.ok, true);
  assert.ok(report.warningCount >= 1);
  assert.equal(complianceBlocksImport(report.issues), false);
});
