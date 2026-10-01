import { ACTION_KINDS } from "../combat-ai/action-feasibility.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import { armorRatingForPart } from "../combat-ai/armor-penetration.ts";
import { orderedBarrierHits } from "../combat-ai/geometry.ts";
import {
  applyUnderPenetrationDamageFloor,
  armorAdjustedDamageDice,
} from "./armor-penetration-damage.ts";
import { resolveBallisticToTarget } from "./ballistic.ts";
import type { OpcodeHealthPart } from "../character-sheets/characterSheet.types.ts";
import type { BenchPlacementHealthState } from "./combat-bench-outcome.ts";
import type { BenchDiceRollRecord } from "./combat-bench-step-log.ts";
import type { PlanningPayload } from "./build-planning-payload.ts";
import type { CompiledCombatMap } from "./map-adapter/compile.ts";
import {
  applyDamageToBenchPlacement,
  benchHealthMode,
  formatBenchHitPartLabel,
  opcodeHitPartFromD10,
  rollOpcodeD10,
} from "./bench-health-damage.ts";
import { rollOpcodeDamageExpr } from "./damage-roll.ts";
import {
  enteredCoverBlocksRangedShot,
  rangedAttackDifficultyForTarget,
} from "./ranged-attack-cover.ts";
import {
  formatRangedAttackCheckFormula,
  rollRangedAttackCheck,
  type RangedAttackCheckTerm,
} from "./ranged-attack-roll.ts";
import type { CombatSnapshot, CombatTargetView } from "./snapshot.ts";
import {
  suppressiveFireAffectedTargets,
  suppressiveFireAimPoint,
  suppressiveFireRoundsSpent,
} from "./actions/suppressive-action.ts";
import {
  resolveSuppressiveHitCount,
  rollAgilitySaveAgainstSuppress,
  suppressiveHitDieForTarget,
  suppressiveMarginHits,
} from "./suppressive-fire-resolution.ts";
import type { WallSegment } from "../combat-ai/visibility.ts";

export type BenchStandardFireResult = {
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  diceRolls: BenchDiceRollRecord[];
  lines: string[];
};

export function resolveBenchStandardFire(input: {
  snapshot: CombatSnapshot;
  payload: PlanningPayload;
  action: ActionIntent;
  map: CompiledCombatMap;
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  actorLabel: string;
  targetLabel: (targetId: string) => string;
  /** Precomputed 1d10+ bonus (REF+技能+专精+动作减值). */
  attackBonus: number;
  attackTerms?: readonly RangedAttackCheckTerm[];
  rng: () => number;
}): BenchStandardFireResult {
  const kind = ACTION_KINDS[input.action.kind];
  if (kind !== "standard_fire") {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: [],
    };
  }

  const targetId = input.payload.targetIds[input.action.target] ?? null;
  if (!targetId) {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: ["标准射击：无目标"],
    };
  }

  const targetView = input.snapshot.targets.find((t) => t.id === targetId);
  const targetName = input.targetLabel(targetId);
  if (!targetView) {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: [`标准射击：目标 ${targetName} 不在接战中`],
    };
  }

  if (
    enteredCoverBlocksRangedShot({
      shooterCoverId: input.snapshot.coverId,
      shooter: input.snapshot.position,
      target: targetView.position,
      barriers: input.map.barriers,
    })
  ) {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: [`标准射击：掩体内无法射击掩体另一侧的 ${targetName}`],
    };
  }

  const difficultyParts = rangedAttackDifficultyForTarget({
    shooter: input.snapshot.position,
    target: targetView.position,
    weaponRangeM: input.snapshot.weapon.rangeM,
    localization: targetView.localization,
    targetCoverId: targetView.coverId,
    barriers: input.map.barriers,
  });
  const difficulty = difficultyParts.total;
  const attack = rollRangedAttackCheck({
    attackBonus: input.attackBonus,
    rng: input.rng,
  });
  const hit = attack.total >= difficulty;

  const formula =
    input.attackTerms != null
      ? formatRangedAttackCheckFormula(attack.d10, input.attackTerms)
      : `[${attack.d10}]+${input.attackBonus}`;

  const diceRolls: BenchDiceRollRecord[] = [
    {
      subjectLabel: `${input.actorLabel} 射击检定`,
      formula,
      dieFaces: [attack.d10],
      modifier: input.attackBonus,
      total: attack.total,
    },
  ];

  const diffNote = `难度${difficulty}(距${difficultyParts.range}+位${difficultyParts.localization}+掩${difficultyParts.cover})`;
  const lines = [
    `对 ${targetName} 射击检定：${formula}=${attack.total} vs ${diffNote} → ${hit ? "命中" : "未中"}`,
  ];

  if (!hit) {
    return { healthByPlacementId: input.healthByPlacementId, diceRolls, lines };
  }

  const baseExpectedDice = input.snapshot.ammo.expectedDamageDice;
  const hits = orderedBarrierHits(
    input.snapshot.position,
    targetView.position,
    input.map.barriers,
  );
  const ballistic = resolveBallisticToTarget(
    input.snapshot.ammo.penetration,
    baseExpectedDice,
    hits,
  );
  const barrierDiceLoss = Math.max(0, baseExpectedDice - ballistic.expectedDamageDice);

  if (!ballistic.reachesTarget || ballistic.expectedDamageDice <= 0) {
    const block = hits.find((h) => ballistic.remainingPenetration < h.armorRating);
    const blockNote = block
      ? `挡阻断(穿${ballistic.remainingPenetration}<AR${block.armorRating})`
      : "挡板消耗";
    lines.push(
      `伤害 | 基${baseExpectedDice}骰 挡-${barrierDiceLoss}骰 ${blockNote} → 0伤`,
    );
    return { healthByPlacementId: input.healthByPlacementId, diceRolls, lines };
  }

  const targetHealth = input.healthByPlacementId[targetId];
  const healthMode = benchHealthMode(targetHealth);

  let hitPart: OpcodeHealthPart = "torso";
  if (healthMode === "normal") {
    const locD10 = rollOpcodeD10(input.rng);
    hitPart = opcodeHitPartFromD10(locD10);
    diceRolls.push({
      subjectLabel: `${targetName} 受击部位`,
      formula: `1d10[${locD10}]→${formatBenchHitPartLabel(hitPart)}`,
      dieFaces: [locD10],
      modifier: 0,
      total: locD10,
    });
  }

  const partAr = armorRatingForPart(targetView.armorByPart, hitPart);
  const penMargin = ballistic.remainingPenetration - partAr;
  const armorDice = armorAdjustedDamageDice({
    baseDice: ballistic.expectedDamageDice,
    penetrationMargin: penMargin,
  });
  const maxDice = Math.min(ballistic.expectedDamageDice, armorDice.maxDice);

  const expr = input.snapshot.ammo.damageDiceExpr.trim() || `${ballistic.expectedDamageDice}d6`;
  const rolled = rollOpcodeDamageExpr(expr, input.rng, maxDice);
  let damage = applyUnderPenetrationDamageFloor(armorDice.kind, rolled.total);

  if (damage <= 0) {
    const locNote =
      healthMode === "normal" ? ` 位${formatBenchHitPartLabel(hitPart)}` : "";
    lines.push(
      `伤害 | 基${baseExpectedDice}骰 挡-${barrierDiceLoss}骰→${ballistic.expectedDamageDice}骰 穿${ballistic.remainingPenetration}/AR${partAr}${locNote} ${armorDice.kind} → 0伤`,
    );
    return { healthByPlacementId: input.healthByPlacementId, diceRolls, lines };
  }

  const applied = applyDamageToBenchPlacement(targetHealth ?? { current: null, max: null }, {
    damage,
    hitPart: healthMode === "normal" ? hitPart : undefined,
    attackNatural10: healthMode === "simple" && attack.d10 === 10,
  });
  const healthByPlacementId = {
    ...input.healthByPlacementId,
    [targetId]: applied.state,
  };
  damage = applied.effectiveDamage;
  const after = healthByPlacementId[targetId]?.current;

  diceRolls.push({
    subjectLabel: `${input.actorLabel} → ${targetName} 伤害`,
    formula: `${expr}（${armorDice.kind}，${maxDice}骰）`,
    dieFaces: rolled.dieFaces,
    modifier: rolled.flatModifier,
    total: damage,
  });

  const armorTag =
    armorDice.kind === "under"
      ? "欠穿"
      : armorDice.kind === "over"
        ? "过穿减骰"
        : "穿透";

  const modSuffix = rolled.flatModifier
    ? rolled.flatModifier > 0
      ? `+${rolled.flatModifier}`
      : String(rolled.flatModifier)
    : "";
  const locTag =
    healthMode === "normal" && applied.hitPart
      ? ` 位${formatBenchHitPartLabel(applied.hitPart)}`
      : "";
  const critTag = applied.simpleCrit ? " 简易×2" : "";
  const lethalTag = applied.headLethal ? " 头部致命" : "";
  lines.push(
    `伤害 ${expr} | 基${baseExpectedDice}骰 挡-${barrierDiceLoss}骰→${ballistic.expectedDamageDice}骰 穿${ballistic.remainingPenetration}/AR${partAr}${locTag} ${armorTag} 掷${maxDice}骰 → [${rolled.dieFaces.join("+")}]${modSuffix}=${damage}${critTag}${lethalTag}${after !== null && after !== undefined ? ` ${targetName}剩${after}` : ""}`,
  );

  return { healthByPlacementId, diceRolls, lines };
}

function applyBenchRangedDamageHit(input: {
  snapshot: CombatSnapshot;
  map: CompiledCombatMap;
  targetView: CombatTargetView;
  targetId: string;
  targetName: string;
  actorLabel: string;
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  rng: () => number;
  attackNatural10: boolean;
  rollSubjectLabel: string;
}): {
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  diceRolls: BenchDiceRollRecord[];
  lines: string[];
} {
  const baseExpectedDice = input.snapshot.ammo.expectedDamageDice;
  const barrierHits = orderedBarrierHits(
    input.snapshot.position,
    input.targetView.position,
    input.map.barriers,
  );
  const ballistic = resolveBallisticToTarget(
    input.snapshot.ammo.penetration,
    baseExpectedDice,
    barrierHits,
  );
  const barrierDiceLoss = Math.max(0, baseExpectedDice - ballistic.expectedDamageDice);
  const diceRolls: BenchDiceRollRecord[] = [];
  const lines: string[] = [];

  if (!ballistic.reachesTarget || ballistic.expectedDamageDice <= 0) {
    return { healthByPlacementId: input.healthByPlacementId, diceRolls, lines };
  }

  const targetHealth = input.healthByPlacementId[input.targetId];
  const healthMode = benchHealthMode(targetHealth);

  let hitPart: OpcodeHealthPart = "torso";
  if (healthMode === "normal") {
    const locD10 = rollOpcodeD10(input.rng);
    hitPart = opcodeHitPartFromD10(locD10);
    diceRolls.push({
      subjectLabel: `${input.targetName} 受击部位`,
      formula: `1d10[${locD10}]→${formatBenchHitPartLabel(hitPart)}`,
      dieFaces: [locD10],
      modifier: 0,
      total: locD10,
    });
  }

  const partAr = armorRatingForPart(input.targetView.armorByPart, hitPart);
  const penMargin = ballistic.remainingPenetration - partAr;
  const armorDice = armorAdjustedDamageDice({
    baseDice: ballistic.expectedDamageDice,
    penetrationMargin: penMargin,
  });
  const maxDice = Math.min(ballistic.expectedDamageDice, armorDice.maxDice);

  const expr =
    input.snapshot.ammo.damageDiceExpr.trim() || `${ballistic.expectedDamageDice}d6`;
  const rolled = rollOpcodeDamageExpr(expr, input.rng, maxDice);
  let damage = applyUnderPenetrationDamageFloor(armorDice.kind, rolled.total);
  if (damage <= 0) {
    return { healthByPlacementId: input.healthByPlacementId, diceRolls, lines };
  }

  const applied = applyDamageToBenchPlacement(targetHealth ?? { current: null, max: null }, {
    damage,
    hitPart: healthMode === "normal" ? hitPart : undefined,
    attackNatural10: healthMode === "simple" && input.attackNatural10,
  });
  const healthByPlacementId = {
    ...input.healthByPlacementId,
    [input.targetId]: applied.state,
  };
  damage = applied.effectiveDamage;
  const after = healthByPlacementId[input.targetId]?.current;

  diceRolls.push({
    subjectLabel: input.rollSubjectLabel,
    formula: `${expr}（${armorDice.kind}，${maxDice}骰）`,
    dieFaces: rolled.dieFaces,
    modifier: rolled.flatModifier,
    total: damage,
  });

  lines.push(
    `${input.targetName} 伤害 ${damage}${after !== null && after !== undefined ? ` 剩${after}` : ""}（挡-${barrierDiceLoss}骰）`,
  );

  return { healthByPlacementId, diceRolls, lines };
}

export type BenchSuppressiveFireResult = BenchStandardFireResult;

/** Suppress: one shot check → reflex save; on fail max(1d(ROF/n), margin) damage rolls. */
export function resolveBenchSuppressiveFire(input: {
  snapshot: CombatSnapshot;
  map: CompiledCombatMap;
  healthByPlacementId: Record<string, BenchPlacementHealthState>;
  actorLabel: string;
  targetLabel: (targetId: string) => string;
  targetReflexSave: (targetId: string) => { ref: number; athletics: number };
  attackBonus: number;
  attackTerms?: readonly RangedAttackCheckTerm[];
  roundsSpent: number;
  enteredAfterStartIds?: ReadonlySet<string>;
  /** Already passed save this suppress (until they move). */
  skipAgilitySaveIds?: ReadonlySet<string>;
  rng: () => number;
}): BenchSuppressiveFireResult {
  const from = input.snapshot.position;
  const aim = suppressiveFireAimPoint(from, input.snapshot.targets);
  if (!aim) {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: ["火力压制：无瞄准点"],
    };
  }

  const walls: readonly WallSegment[] = input.map.walls;
  const affected = suppressiveFireAffectedTargets(
    from,
    aim,
    input.snapshot.targets,
    walls,
    input.snapshot.weapon.rangeM,
  );

  let healthByPlacementId = input.healthByPlacementId;
  const diceRolls: BenchDiceRollRecord[] = [];
  const initialTargetsInZone = affected.length;
  const lines = [
    `火力压制 耗弹${input.roundsSpent} → 压制区 ${initialTargetsInZone} 目标`,
  ];

  if (
    input.snapshot.coverId &&
    affected.every((hit) =>
      enteredCoverBlocksRangedShot({
        shooterCoverId: input.snapshot.coverId,
        shooter: from,
        target: hit.position,
        barriers: input.map.barriers,
      }),
    )
  ) {
    return {
      healthByPlacementId: input.healthByPlacementId,
      diceRolls: [],
      lines: [...lines, "火力压制：掩体内无法射击掩体另一侧"],
    };
  }

  const attack = rollRangedAttackCheck({
    attackBonus: input.attackBonus,
    rng: input.rng,
  });
  const attackFormula =
    input.attackTerms != null
      ? formatRangedAttackCheckFormula(attack.d10, input.attackTerms)
      : `[${attack.d10}]+${input.attackBonus}`;

  const checkTarget = [...affected].sort((a, b) => {
    const da = Math.hypot(a.position.x - from.x, a.position.y - from.y);
    const db = Math.hypot(b.position.x - from.x, b.position.y - from.y);
    return da - db;
  })[0];
  const checkView = checkTarget
    ? input.snapshot.targets.find((t) => t.id === checkTarget.id)
    : undefined;
  let shotCheckNote = "";
  if (checkView && checkTarget) {
    const checkDiffParts = rangedAttackDifficultyForTarget({
      shooter: from,
      target: checkTarget.position,
      weaponRangeM: input.snapshot.weapon.rangeM,
      localization: checkView.localization,
      targetCoverId: checkView.coverId,
      barriers: input.map.barriers,
    });
    const checkDiff = checkDiffParts.total;
    const shotHit = attack.total >= checkDiff;
    shotCheckNote = ` vs 难度${checkDiff}(距${checkDiffParts.range}+位${checkDiffParts.localization}+掩${checkDiffParts.cover}) → ${shotHit ? "成功" : "失败"}`;
  }

  diceRolls.push({
    subjectLabel: `${input.actorLabel} 压制射击`,
    formula: attackFormula,
    dieFaces: [attack.d10],
    modifier: input.attackBonus,
    total: attack.total,
  });
  lines.push(`射击检定：${attackFormula}=${attack.total}${shotCheckNote}`);

  const skipSave = input.skipAgilitySaveIds ?? new Set<string>();
  const enteredAfter = input.enteredAfterStartIds ?? new Set<string>();
  let burstUnassigned = input.roundsSpent;

  for (const hit of affected) {
    const targetView = input.snapshot.targets.find((t) => t.id === hit.id);
    const targetName = input.targetLabel(hit.id);
    if (!targetView) continue;

    if (skipSave.has(hit.id)) {
      lines.push(`${targetName} 反射豁免：已成功（压制持续中）`);
      continue;
    }

    const { ref, athletics } = input.targetReflexSave(hit.id);
    const saveMod = ref + athletics;
    const save = rollAgilitySaveAgainstSuppress({
      ref,
      athletics,
      attackTotal: attack.total,
      rng: input.rng,
    });
    diceRolls.push({
      subjectLabel: `${targetName} 反射豁免`,
      formula: `1d10[${save.d10}]+REF${ref}+运动${athletics}`,
      dieFaces: [save.d10],
      modifier: saveMod,
      total: save.total,
    });
    lines.push(
      `${targetName} 反射豁免：1d10[${save.d10}]+REF${ref}+运动${athletics}=${save.total} vs ${attack.total} → ${save.success ? "成功" : "失败"}`,
    );
    if (save.success) continue;

    const difficultyParts = rangedAttackDifficultyForTarget({
      shooter: from,
      target: hit.position,
      weaponRangeM: input.snapshot.weapon.rangeM,
      localization: targetView.localization,
      targetCoverId: targetView.coverId,
      barriers: input.map.barriers,
    });
    const hitDifficulty = difficultyParts.total;
    const marginHits = suppressiveMarginHits(attack.total, hitDifficulty);

    const dieSides = suppressiveHitDieForTarget({
      ammoFiredThisSuppress: input.roundsSpent,
      initialTargetsInZone,
      burstUnassigned,
      enteredAfterStart: enteredAfter.has(hit.id),
    });
    const { dieRoll, hits } = resolveSuppressiveHitCount({
      dieSides,
      marginHits,
      burstUnassigned,
      rng: input.rng,
    });

    if (hits <= 0) {
      const why =
        marginHits <= 0
          ? "射击未胜出难度，豁免失败亦不结算伤害"
          : "本轮未分配弹药用尽";
      lines.push(
        `${targetName} 压制次数：max(1d${dieSides}[${dieRoll}], 胜出${marginHits}) 本轮未分配${burstUnassigned} → 0次（${why}）`,
      );
      continue;
    }

    burstUnassigned -= hits;
    lines.push(
      `${targetName} 压制次数：max(1d${dieSides}[${dieRoll}], 胜出${marginHits}) → ${hits}次（本轮未分配${burstUnassigned}）`,
    );

    for (let i = 0; i < hits; i++) {
      const applied = applyBenchRangedDamageHit({
        snapshot: input.snapshot,
        map: input.map,
        targetView,
        targetId: hit.id,
        targetName,
        actorLabel: input.actorLabel,
        healthByPlacementId,
        rng: input.rng,
        attackNatural10: attack.d10 === 10,
        rollSubjectLabel: `${input.actorLabel} → ${targetName} 压制伤害`,
      });
      healthByPlacementId = applied.healthByPlacementId;
      diceRolls.push(...applied.diceRolls);
      if (applied.lines.length > 0) {
        lines.push(...applied.lines);
      } else {
        lines.push(`${targetName} 压制伤害 0（挡板/穿深）`);
      }
    }
  }

  return { healthByPlacementId, diceRolls, lines };
}

export function suppressiveRoundsSpentForSnapshot(snapshot: CombatSnapshot): number {
  return Math.min(
    snapshot.ammo.roundsInMagazine,
    suppressiveFireRoundsSpent(snapshot.weapon.rateOfFire),
  );
}
