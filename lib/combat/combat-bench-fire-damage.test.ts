import assert from "node:assert/strict";
import test from "node:test";

import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import { defaultCombatSnapshot } from "./scenario-fixture.ts";
import {
  resolveBenchStandardFire,
  resolveBenchSuppressiveFire,
} from "./combat-bench-fire-damage.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";

const fireInput = {
  snapshot: defaultCombatSnapshot({
    ammo: {
      penetration: 55,
      damageDiceExpr: "3d6",
      expectedDamageDice: 3,
      roundsInMagazine: 10,
    },
    targets: [
      {
        id: "tgt",
        position: { x: 6, y: 0 },
        localization: "full",
        armorByPart: { torso: 10 },
        coverId: null,
      },
    ],
  }),
  payload: {
    targetIds: [null, "tgt"],
    stancePositions: [{ x: 0, y: 0 }],
  } as PlanningPayload,
  action: {
    round: 0,
    kind: actionKindIndex("standard_fire"),
    tile: 0,
    target: 1,
    timing: "immediate",
  },
  map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
  healthByPlacementId: { tgt: { current: 20, max: 20 } },
  actorLabel: "A",
  targetLabel: () => "T",
  attackBonus: 20,
};

test("resolveBenchStandardFire skips damage on failed attack roll", () => {
  const result = resolveBenchStandardFire({
    ...fireInput,
    attackBonus: 1,
    rng: () => 0,
  });

  assert.equal(result.diceRolls.length, 1);
  assert.equal(result.healthByPlacementId.tgt!.current, 20);
  assert.match(result.lines[0] ?? "", /未中/);
  assert.match(result.lines[0] ?? "", /难度\d+\(距\d+\+位\d+\+掩\d+\)/);
});

test("resolveBenchStandardFire writes the ranged check breakdown", () => {
  const result = resolveBenchStandardFire({
    ...fireInput,
    attackBonus: 4,
    attackTerms: [
      { value: 4, label: "专精" },
      { value: 3, label: "技能" },
      { value: -3, label: "惩罚", source: "连续射击" },
    ],
    rng: () => 0,
  });
  assert.equal(
    result.diceRolls[0]?.formula,
    "1d10[1]+4专精+3技能-3惩罚（连续射击）",
  );
  assert.match(result.lines[0] ?? "", /1d10\[1\]\+4专精\+3技能-3惩罚（连续射击）=5/);
});

test("resolveBenchStandardFire still damages through concealment-only cover", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    return 0.5;
  };

  const result = resolveBenchStandardFire({
    ...fireInput,
    map: {
      walls: [],
      barriers: [
        {
          id: "bush-e0",
          a: { x: 3, y: -2 },
          b: { x: 3, y: 2 },
          armorRating: 15,
          maxSsp: 10,
          currentSsp: 10,
          blocksVision: false,
        },
        {
          id: "bush-e2",
          a: { x: 4, y: -2 },
          b: { x: 4, y: 2 },
          armorRating: 15,
          maxSsp: 10,
          currentSsp: 10,
          blocksVision: false,
        },
      ],
      solveBounds: null,
      emplacements: [],
    },
    rng,
  });

  assert.match(result.lines[0] ?? "", /命中/);
  assert.ok(result.healthByPlacementId.tgt!.current! < 20);
  assert.ok(!(result.lines[1] ?? "").includes("→ 0伤"));
});

test("resolveBenchStandardFire auto walk-your-fire is X-1 hits from one roll", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    return 0.5;
  };

  const result = resolveBenchStandardFire({
    ...fireInput,
    attackBonus: 10,
    snapshot: defaultCombatSnapshot({
      encounter: {
        profileId: "expert",
        allowNpcSurrender: false,
        surrenderThreshold: -Infinity,
        mission: "hunt",
      },
      weapon: {
        rangeM: 400,
        rateOfFire: 1200,
        accuracy: -2,
        semiAutoOrBetter: true,
        availableFireModes: ["auto"],
        defaultFireMode: "auto",
      },
      ammo: {
        penetration: 55,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 20,
      },
      targets: fireInput.snapshot.targets,
    }),
    rng,
  });

  assert.match(result.lines[0] ?? "", /全自动\d+发 走火-5 命中1/);
  assert.equal(result.diceRolls.filter((r) => r.subjectLabel.includes("伤害")).length, 1);
  assert.ok(result.healthByPlacementId.tgt!.current! < 20);
});

test("resolveBenchStandardFire applies walk-your-fire to the attack check", () => {
  const result = resolveBenchStandardFire({
    ...fireInput,
    attackBonus: 9,
    attackTerms: [
      { value: 3, label: "技能" },
      { value: 6, label: "属性" },
    ],
    snapshot: defaultCombatSnapshot({
      weapon: {
        rangeM: 400,
        rateOfFire: 900,
        accuracy: 0,
        semiAutoOrBetter: true,
        availableFireModes: ["auto"],
        defaultFireMode: "auto",
      },
      ammo: {
        penetration: 55,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 30,
      },
      targets: fireInput.snapshot.targets,
    }),
    rng: () => 0.6,
  });
  assert.match(result.lines[0] ?? "", /1d10\[7\]\+3技能\+6属性-3惩罚（走火）=13 vs 难度15/);
  assert.match(result.lines[0] ?? "", /未中/);
  assert.equal(result.healthByPlacementId.tgt!.current, 20);
});

test("resolveBenchStandardFire rolls damage after hit", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    return 0.5;
  };

  const result = resolveBenchStandardFire({ ...fireInput, rng });

  assert.equal(result.diceRolls.length, 2);
  assert.match(result.lines[0] ?? "", /命中/);
  assert.ok(result.healthByPlacementId.tgt!.current! < 20);
});

test("resolveBenchStandardFire applies under-penetration quarter dice", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    return 0;
  };

  const result = resolveBenchStandardFire({
    ...fireInput,
    snapshot: defaultCombatSnapshot({
      ammo: {
        penetration: 5,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 10,
      },
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 40 },
          coverId: null,
        },
      ],
    }),
    rng,
  });

  assert.match(result.lines[1] ?? "", /欠穿/);
  assert.match(result.lines[1] ?? "", /基\d+骰 挡-\d+骰/);
  assert.equal(result.diceRolls[1]?.dieFaces.length, 1);
  assert.ok((result.healthByPlacementId.tgt!.current ?? 20) < 20);
});

test("resolveBenchStandardFire normal mode uses hit location armor", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    if (n === 2) return 0;
    return 0.5;
  };

  const result = resolveBenchStandardFire({
    ...fireInput,
    snapshot: defaultCombatSnapshot({
      ammo: {
        penetration: 55,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 10,
      },
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 80, leg_left: 0 },
          coverId: null,
        },
      ],
    }),
    healthByPlacementId: {
      tgt: {
        mode: "normal",
        current: 20,
        max: 20,
        parts: {
          head: { current: 2, max: 2 },
          torso: { current: 6, max: 6 },
          hand_primary: { current: 2, max: 2 },
          hand_secondary: { current: 4, max: 4 },
          leg_left: { current: 4, max: 4 },
          leg_right: { current: 2, max: 2 },
        },
      },
    },
    rng,
  });

  assert.match(result.lines[1] ?? "", /位左腿/);
  assert.ok(result.healthByPlacementId.tgt!.parts!.leg_left.current! < 4);
});

test("resolveBenchSuppressiveFire uses agility save and hit-count die", () => {
  const result = resolveBenchSuppressiveFire({
    snapshot: defaultCombatSnapshot({
      weapon: { rangeM: 350, rateOfFire: 600, accuracy: 0, semiAutoOrBetter: true },
      ammo: {
        penetration: 55,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 30,
      },
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 0 },
          coverId: null,
        },
      ],
    }),
    map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
    healthByPlacementId: { tgt: { current: 20, max: 20 } },
    actorLabel: "A",
    targetLabel: () => "T",
    targetReflexSave: () => ({ ref: 0, athletics: 0 }),
    attackBonus: 20,
    roundsSpent: 30,
    rng: () => 0.95,
  });

  assert.ok(result.lines.some((line) => line.includes("火力压制")));
  assert.ok(result.lines.some((line) => line.includes("反射豁免")));
  assert.ok(result.lines.some((line) => line.includes("射击检定")));
  assert.ok(result.diceRolls.length >= 1);
});

test("resolveBenchSuppressiveFire damages only when agility save fails", () => {
  let passRoll = 0;
  const passRng = () => {
    passRoll++;
    return passRoll === 1 ? 0.5 : 0.95;
  };

  const pass = resolveBenchSuppressiveFire({
    snapshot: defaultCombatSnapshot({
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 0 },
          coverId: null,
        },
      ],
    }),
    map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
    healthByPlacementId: { tgt: { current: 20, max: 20 } },
    actorLabel: "A",
    targetLabel: () => "T",
    targetReflexSave: () => ({ ref: 6, athletics: 4 }),
    attackBonus: 5,
    roundsSpent: 1,
    rng: passRng,
  });
  assert.equal(pass.healthByPlacementId.tgt!.current, 20);
  assert.ok(pass.lines.some((line) => line.includes("成功")));

  let failRoll = 0;
  const failRng = () => {
    failRoll++;
    if (failRoll <= 2) return failRoll === 1 ? 0.5 : 0;
    return 0.5;
  };

  const fail = resolveBenchSuppressiveFire({
    snapshot: defaultCombatSnapshot({
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 0 },
          coverId: null,
        },
      ],
    }),
    map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
    healthByPlacementId: { tgt: { current: 20, max: 20 } },
    actorLabel: "A",
    targetLabel: () => "T",
    targetReflexSave: () => ({ ref: 0, athletics: 0 }),
    attackBonus: 20,
    roundsSpent: 1,
    rng: failRng,
  });
  assert.ok(fail.healthByPlacementId.tgt!.current! < 20);
  assert.ok(fail.lines.some((line) => line.includes("失败")));
});

test("resolveBenchSuppressiveFire hit count is min of 1d(remaining ammo) and success count", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.5;
    if (n === 2) return 0;
    return 0;
  };

  const result = resolveBenchSuppressiveFire({
    snapshot: defaultCombatSnapshot({
      weapon: { rangeM: 350, rateOfFire: 20, accuracy: 0, semiAutoOrBetter: true },
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 0 },
          coverId: null,
        },
      ],
    }),
    map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
    healthByPlacementId: { tgt: { current: 20, max: 20 } },
    actorLabel: "A",
    targetLabel: () => "T",
    targetReflexSave: () => ({ ref: 0, athletics: 0 }),
    attackBonus: 10,
    roundsSpent: 20,
    rng,
  });

  assert.ok(result.lines.some((line) => line.includes("射击检定") && line.includes("=16")));
  assert.ok(result.lines.some((line) => /压制次数：min\(1d20\[1\], 成功1\)/.test(line)));
});

test("resolveBenchSuppressiveFire damage rolls apply armor at hit part", () => {
  let n = 0;
  const rng = () => {
    n++;
    if (n === 1) return 0.95;
    if (n === 2) return 0;
    return 0;
  };

  const result = resolveBenchSuppressiveFire({
    snapshot: defaultCombatSnapshot({
      ammo: {
        penetration: 5,
        damageDiceExpr: "3d6",
        expectedDamageDice: 3,
        roundsInMagazine: 30,
      },
      targets: [
        {
          id: "tgt",
          position: { x: 6, y: 0 },
          localization: "full",
          armorByPart: { torso: 40 },
          coverId: null,
        },
      ],
    }),
    map: { walls: [], barriers: [], solveBounds: null, emplacements: [] },
    healthByPlacementId: { tgt: { current: 40, max: 40 } },
    actorLabel: "A",
    targetLabel: () => "T",
    targetReflexSave: () => ({ ref: 0, athletics: 0 }),
    attackBonus: 30,
    roundsSpent: 30,
    rng,
  });

  assert.ok(result.lines.some((line) => line.includes("AR40") && line.includes("欠穿")));
});
