import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_KINDS,
  actionFeasibilityIndex,
  actionKindIndex,
  createActionFeasibilityTensor,
  setActionLegal,
} from "./action-feasibility.ts";
import {
  buildTransferableDecidePayload,
  executeWorkerDecideRequest,
} from "./combat-ai.worker.ts";

test("executeWorkerDecideRequest reads detached buffers and returns a plan", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  const feasibility = createActionFeasibilityTensor(shape);
  const utility = new Float32Array(feasibility.legal.length);
  const reload = actionKindIndex("standard_reload");
  setActionLegal(feasibility, 0, reload, 0, 0, true);
  utility[actionFeasibilityIndex(shape, 0, reload, 0, 0)] = 4;

  const { legalBuffer, utilityBuffer } = buildTransferableDecidePayload(
    shape,
    feasibility.legal,
    utility,
  );

  const { plan } = executeWorkerDecideRequest({
    profileId: "novice",
    randomSeed: 1,
    snapshotVersion: 3,
    allowNpcSurrender: false,
    surrenderThreshold: -Infinity,
    deadlineMs: 4800,
    startedAtMs: Date.now(),
    shape,
    legalBuffer,
    utilityBuffer,
  });

  assert.equal(plan.snapshotVersion, 3);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]!.kind, reload);
});

test("executeWorkerDecideRequest rejects wrong buffer length", () => {
  const shape = { initiativeRounds: 1, kinds: ACTION_KINDS.length, reachableTiles: 1, targets: 1 };
  assert.throws(
    () =>
      executeWorkerDecideRequest({
        profileId: "newstupid",
        randomSeed: 0,
        snapshotVersion: 0,
        allowNpcSurrender: false,
        surrenderThreshold: 0,
        deadlineMs: 4800,
        startedAtMs: Date.now(),
        shape,
        legalBuffer: new ArrayBuffer(1),
        utilityBuffer: new Float32Array(1).buffer,
      }),
    RangeError,
  );
});
