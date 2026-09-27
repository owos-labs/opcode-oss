/** Fixed action kinds; rule engine marks legal (round × kind × tile × target) cells. */

export const ACTION_KINDS = [
  "move",
  "standard_fire",
  "suppressive_fire",
  "standard_reload",
  "standard_aim",
  "throw",
  "enter_cover",
  "leave_cover",
  "insert",
  "surrender",
] as const;

export type ActionKindId = (typeof ACTION_KINDS)[number];

export type ActionKindIndex = number;

export function actionKindIndex(kind: ActionKindId): ActionKindIndex {
  const index = ACTION_KINDS.indexOf(kind);
  if (index < 0) throw new Error(`unknown action kind: ${kind}`);
  return index;
}

/** Index 0 tile = hold position; index 0 target = no target (reload, move-only). */
export type ActionFeasibilityShape = {
  initiativeRounds: number;
  kinds: number;
  reachableTiles: number;
  targets: number;
};

export type ActionFeasibilityTensor = {
  shape: ActionFeasibilityShape;
  /** Row-major uint8: 1 legal, 0 illegal (WASM-friendly). */
  legal: Uint8Array;
};

export function actionFeasibilitySize(shape: ActionFeasibilityShape): number {
  return shape.initiativeRounds * shape.kinds * shape.reachableTiles * shape.targets;
}

export function createActionFeasibilityTensor(shape: ActionFeasibilityShape): ActionFeasibilityTensor {
  const size = actionFeasibilitySize(shape);
  return { shape, legal: new Uint8Array(size) };
}

export function actionFeasibilityIndex(
  shape: ActionFeasibilityShape,
  round: number,
  kind: number,
  tile: number,
  target: number,
): number {
  const { initiativeRounds, kinds, reachableTiles, targets } = shape;
  if (round < 0 || round >= initiativeRounds) throw new RangeError("round");
  if (kind < 0 || kind >= kinds) throw new RangeError("kind");
  if (tile < 0 || tile >= reachableTiles) throw new RangeError("tile");
  if (target < 0 || target >= targets) throw new RangeError("target");
  return (((round * kinds + kind) * reachableTiles + tile) * targets + target);
}

export function setActionLegal(
  tensor: ActionFeasibilityTensor,
  round: number,
  kind: number,
  tile: number,
  target: number,
  legal: boolean,
): void {
  const i = actionFeasibilityIndex(tensor.shape, round, kind, tile, target);
  tensor.legal[i] = legal ? 1 : 0;
}

export function isActionLegal(
  tensor: ActionFeasibilityTensor,
  round: number,
  kind: number,
  tile: number,
  target: number,
): boolean {
  const i = actionFeasibilityIndex(tensor.shape, round, kind, tile, target);
  return tensor.legal[i] === 1;
}

export type ActionCell = {
  round: number;
  kind: number;
  tile: number;
  target: number;
};

/** Search / WASM iterates only legal cells — no rule checks in the hot loop. */
export function* iterateLegalActions(tensor: ActionFeasibilityTensor): Generator<ActionCell> {
  const { shape, legal } = tensor;
  const { initiativeRounds, kinds, reachableTiles, targets } = shape;
  for (let round = 0; round < initiativeRounds; round++) {
    for (let kind = 0; kind < kinds; kind++) {
      for (let tile = 0; tile < reachableTiles; tile++) {
        for (let target = 0; target < targets; target++) {
          const i = (((round * kinds + kind) * reachableTiles + tile) * targets + target);
          if (legal[i] === 1) yield { round, kind, tile, target };
        }
      }
    }
  }
}

export function countLegalActions(tensor: ActionFeasibilityTensor): number {
  let n = 0;
  for (const x of tensor.legal) if (x === 1) n++;
  return n;
}

/** Bundled once per decide(); feasibility is computed by rules, not search. */
export type CombatPlanningTensorBundle = {
  feasibility: ActionFeasibilityTensor;
};
