import {
  actionFeasibilitySize,
  createActionFeasibilityTensor,
  type ActionFeasibilityShape,
  type ActionFeasibilityTensor,
} from "./action-feasibility.ts";
import { decideFromBundle } from "./decide.ts";
import { createPlanningBundle } from "./planning.ts";
import type { NpcDifficultyId } from "./difficulty.ts";
import { NPC_AI_DEADLINE_MS } from "./difficulty.ts";
import type { RoundPlan } from "./decide.ts";

export type WorkerDecideRequest = {
  profileId: NpcDifficultyId;
  randomSeed: number;
  snapshotVersion: number;
  allowNpcSurrender: boolean;
  surrenderThreshold: number;
  deadlineMs: number;
  startedAtMs: number;
  shape: ActionFeasibilityShape;
  /** Detached legal bytes; length must match actionFeasibilitySize(shape). */
  legalBuffer: ArrayBuffer;
  utilityBuffer: ArrayBuffer;
};

export type WorkerDecideResponse = {
  plan: RoundPlan;
};

export function tensorFromRequest(req: WorkerDecideRequest): ActionFeasibilityTensor {
  const expected = actionFeasibilitySize(req.shape);
  const legal = new Uint8Array(req.legalBuffer);
  if (legal.length !== expected) {
    throw new RangeError(`legal buffer length ${legal.length} != ${expected}`);
  }
  return { shape: req.shape, legal };
}

export function utilityFromRequest(req: WorkerDecideRequest): Float32Array {
  const expected = actionFeasibilitySize(req.shape);
  const utility = new Float32Array(req.utilityBuffer);
  if (utility.length !== expected) {
    throw new RangeError(`utility buffer length ${utility.length} != ${expected}`);
  }
  return utility;
}

/** Pure decide path used by Web Worker and node tests. */
export function executeWorkerDecideRequest(req: WorkerDecideRequest): WorkerDecideResponse {
  const bundle = createPlanningBundle({
    profileId: req.profileId,
    feasibility: tensorFromRequest(req),
    utility: utilityFromRequest(req),
    randomSeed: req.randomSeed,
    snapshotVersion: req.snapshotVersion,
    allowNpcSurrender: req.allowNpcSurrender,
    surrenderThreshold: req.surrenderThreshold,
    deadlineMs: req.deadlineMs ?? NPC_AI_DEADLINE_MS,
  });

  const plan = decideFromBundle(bundle, req.startedAtMs);
  return { plan };
}

export function buildTransferableDecidePayload(
  shape: ActionFeasibilityShape,
  legal: Uint8Array,
  utility: Float32Array,
): { legalBuffer: ArrayBuffer; utilityBuffer: ArrayBuffer; transfer: ArrayBuffer[] } {
  if (legal.buffer !== utility.buffer) {
    return {
      legalBuffer: legal.buffer as ArrayBuffer,
      utilityBuffer: utility.buffer as ArrayBuffer,
      transfer: [legal.buffer as ArrayBuffer, utility.buffer as ArrayBuffer],
    };
  }
  const tensor = createActionFeasibilityTensor(shape);
  tensor.legal.set(legal);
  return {
    legalBuffer: tensor.legal.buffer as ArrayBuffer,
    utilityBuffer: utility.buffer as ArrayBuffer,
    transfer: [tensor.legal.buffer as ArrayBuffer, utility.buffer as ArrayBuffer],
  };
}
