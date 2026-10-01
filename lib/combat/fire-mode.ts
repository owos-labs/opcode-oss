import {
  preferredFireMode,
  type FireModeId,
} from "../combat-ai/combat-policy.ts";
import type { ActionIntent } from "../combat-ai/search.ts";
import type { CombatSnapshot, CombatWeaponView } from "./snapshot.ts";

export function fireModeActionLabel(mode: FireModeId, rounds: number): string {
  if (mode === "auto") return `全自动${rounds}发`;
  if (mode === "burst") return `点射${rounds}发`;
  return "半自动";
}

export function snapshotFireModes(weapon: CombatWeaponView | undefined): FireModeId[] {
  if (weapon?.availableFireModes?.length) return [...weapon.availableFireModes];
  return weapon?.defaultFireMode ? [weapon.defaultFireMode] : ["semi"];
}

export function exactHostileCount(snapshot: CombatSnapshot): number {
  return (snapshot.targets ?? []).filter(
    (t) => t.localization === "exact" || t.localization === "full",
  ).length;
}

export function chooseFireMode(
  snapshot: CombatSnapshot,
  distanceM: number,
  rng: () => number = () => 0,
): FireModeId {
  const available = snapshotFireModes(snapshot.weapon);
  return preferredFireMode({
    difficulty: snapshot.encounter?.profileId ?? "trained",
    available,
    defaultFireMode: snapshot.weapon?.defaultFireMode ?? available[0] ?? "semi",
    poolAllowsBurst:
      snapshot.weapon?.burstPoolOk === true || available.includes("burst"),
    exactEnemyCount: exactHostileCount(snapshot),
    distanceM,
    weaponRangeM: snapshot.weapon?.rangeM ?? 0,
    rng,
  });
}

/** Auto: at most ROF/60 rounds per action. */
export function autoRoundsPerAction(rateOfFire: number): number {
  return Math.max(1, Math.floor(Math.max(0, rateOfFire) / 60));
}

/** All ranged fire: at most ROF/20 rounds per weapon per round. */
export function weaponRoundsPerRound(rateOfFire: number): number {
  const rof = Math.max(0, rateOfFire);
  if (rof <= 0) return 0;
  return Math.max(1, Math.floor(rof / 20));
}

export function remainingWeaponRoundsThisRound(snapshot: CombatSnapshot): number {
  return Math.max(
    0,
    weaponRoundsPerRound(snapshot.weapon?.rateOfFire ?? 0) -
      (snapshot.weaponRoundsThisRound ?? 0),
  );
}

/**
 * Walk-your-fire on extra auto rounds: (3 − accuracy) on the 1st standard action,
 * (2 − accuracy) on the 2nd, (1 − accuracy) from the 3rd. Floor 0.
 */
export function walkYourFirePenalty(input: {
  accuracy: number;
  standardActionIndex: number;
}): number {
  const base =
    input.standardActionIndex <= 0 ? 3 : input.standardActionIndex === 1 ? 2 : 1;
  return Math.max(0, base - input.accuracy);
}

/** One attack roll. First miss at shot X → X−1 hits. 20 vs 15, penalty 5 → 2 hits. */
export function autoHitsFromRoll(
  total: number,
  difficulty: number,
  rounds: number,
  perExtraPenalty: number,
): number {
  if (rounds <= 0 || total < difficulty) return 0;
  if (perExtraPenalty <= 0) return rounds;
  return Math.min(rounds, 1 + Math.floor((total - difficulty) / perExtraPenalty));
}

export function standardFireTargetDistance(
  snapshot: CombatSnapshot,
  payload: { targetIds: readonly (string | null)[] },
  action: ActionIntent,
): number {
  const id = payload.targetIds[action.target];
  const target = (snapshot.targets ?? []).find((t) => t.id === id);
  if (!target) return 0;
  return Math.hypot(
    target.position.x - snapshot.position.x,
    target.position.y - snapshot.position.y,
  );
}

export type StandardFirePlan = {
  mode: FireModeId;
  rounds: number;
  walkFirePenalty: number;
};

export type StandardFirePlanOpts = {
  attackBonus?: number;
  attackMalus?: number;
  hitDifficulty?: number;
};

/** Mean auto hits across 1d10, matching bench walk-your-fire accounting. */
export function expectedAutoHitCount(input: {
  attackBonus: number;
  attackMalus?: number;
  difficulty: number;
  rounds: number;
  walkFirePenalty: number;
}): number {
  const malus = input.attackMalus ?? 0;
  let sum = 0;
  for (let face = 1; face <= 10; face++) {
    const attackTotal = face + input.attackBonus + malus - input.walkFirePenalty;
    sum += autoHitsFromRoll(
      attackTotal,
      input.difficulty,
      input.rounds,
      input.walkFirePenalty,
    );
  }
  return sum / 10;
}

/** Fewest auto rounds that reach the maximum expected hit count (never above maxRounds). */
export function optimalAutoRounds(input: {
  attackBonus: number;
  attackMalus?: number;
  difficulty: number;
  walkFirePenalty: number;
  maxRounds: number;
}): number {
  const cap = Math.max(0, Math.floor(input.maxRounds));
  if (cap <= 0) return 0;

  let maxExpected = 0;
  for (let rounds = 1; rounds <= cap; rounds++) {
    maxExpected = Math.max(
      maxExpected,
      expectedAutoHitCount({ ...input, rounds }),
    );
  }
  if (maxExpected <= 0) return 0;

  for (let rounds = 1; rounds <= cap; rounds++) {
    if (
      Math.abs(expectedAutoHitCount({ ...input, rounds }) - maxExpected) <
      1e-9
    ) {
      return rounds;
    }
  }
  return cap;
}

function autoCapRounds(
  snapshot: CombatSnapshot,
  mag: number,
  remaining: number,
): number {
  let cap = Math.min(
    autoRoundsPerAction(snapshot.weapon?.rateOfFire ?? 0),
    mag,
    remaining,
  );
  const exact = exactHostileCount(snapshot);
  if (snapshot.encounter?.profileId === "professional" && exact > 0) {
    cap = Math.max(1, Math.floor(cap / exact));
  }
  return cap;
}

function roundsForMode(
  mode: FireModeId,
  snapshot: CombatSnapshot,
  mag: number,
  remaining: number,
  walkFirePenalty: number,
  opts?: StandardFirePlanOpts,
): number {
  if (mag <= 0 || remaining <= 0) return 0;
  if (mode === "semi") return 1;
  if (mode === "burst") return Math.min(3, mag, remaining);
  const cap = autoCapRounds(snapshot, mag, remaining);
  if (
    opts?.hitDifficulty != null &&
    opts.attackBonus != null &&
    Number.isFinite(opts.hitDifficulty)
  ) {
    return optimalAutoRounds({
      attackBonus: opts.attackBonus,
      attackMalus: opts.attackMalus,
      difficulty: opts.hitDifficulty,
      walkFirePenalty,
      maxRounds: cap,
    });
  }
  return cap;
}

export function planStandardFire(
  snapshot: CombatSnapshot,
  distanceM: number,
  rng: () => number = () => 0,
  opts?: StandardFirePlanOpts,
): StandardFirePlan {
  const mode = chooseFireMode(snapshot, distanceM, rng);
  const walkFirePenalty = walkYourFirePenalty({
    accuracy: snapshot.weapon?.accuracy ?? 0,
    standardActionIndex: snapshot.standardActionsThisRound ?? 0,
  });
  return {
    mode,
    rounds: roundsForMode(
      mode,
      snapshot,
      Math.max(0, snapshot.ammo?.roundsInMagazine ?? 0),
      remainingWeaponRoundsThisRound(snapshot),
      walkFirePenalty,
      opts,
    ),
    walkFirePenalty,
  };
}

/** Semi: 1 damage if the roll hits. Burst: `rounds` damage if the roll hits. Auto: closed-form walk-your-fire. */
export function hitsForStandardFire(input: {
  mode: FireModeId;
  attackTotal: number;
  difficulty: number;
  rounds: number;
  walkFirePenalty: number;
}): number {
  if (input.rounds <= 0 || input.attackTotal < input.difficulty) return 0;
  if (input.mode === "auto") {
    return autoHitsFromRoll(
      input.attackTotal,
      input.difficulty,
      input.rounds,
      input.walkFirePenalty,
    );
  }
  return input.mode === "burst" ? input.rounds : 1;
}

export function applyStandardFireToSnapshot(
  snapshot: CombatSnapshot,
  plan: StandardFirePlan,
): CombatSnapshot {
  const spent = Math.min(plan.rounds, snapshot.ammo?.roundsInMagazine ?? 0);
  const magLeft = Math.max(0, (snapshot.ammo?.roundsInMagazine ?? 0) - spent);
  const stillDumping = plan.mode === "auto" && spent > 0 && magLeft > 0;
  return {
    ...snapshot,
    ammo: { ...snapshot.ammo, roundsInMagazine: magLeft },
    weaponRoundsThisRound: (snapshot.weaponRoundsThisRound ?? 0) + spent,
    standardActionsThisRound: (snapshot.standardActionsThisRound ?? 0) + 1,
    standardFiresThisRound: (snapshot.standardFiresThisRound ?? 0) + 1,
    sustainedFire: {
      active: stillDumping,
      walkFireMalus: stillDumping ? (plan.walkFirePenalty === 0 ? 1 : plan.walkFirePenalty) : 0,
      token: (snapshot.sustainedFire?.token ?? 0) + 1,
    },
  };
}
