import type { CharacterSheet } from "../character-sheets/characterSheet.types.ts";
import { readOpcodeSheetSummary } from "../character-sheets/opcodeSheet.ts";
import { actionKindIndex } from "../combat-ai/action-feasibility.ts";
import type { Vec2 } from "../combat-ai/visibility.ts";
import { suppressiveFireAimPoint } from "./actions/suppressive-action.ts";
import { applyPlanStepToSnapshot } from "./apply-plan-step.ts";
import { fireModeActionLabel, planStandardFire } from "./fire-mode.ts";
import { NPC_DIFFICULTY_LABELS, type NpcDifficultyId } from "../combat-ai/difficulty.ts";
import { senseFromSheet } from "./bench-intel.ts";
import { buildCombatBenchActionBudgetView, type PlanMoveLeg } from "./combat-bench-action-budget.ts";
import { placementProfileId } from "./combat-bench-initiative.ts";
import { formatPlanMoveDebug, planStayReason } from "./combat-plan-intent.ts";
import { remainingMoveBudgetMeters } from "./movement.ts";
import { placementIsNeutralized, type BenchPlacementHealthState } from "./combat-bench-outcome.ts";
import type { CombatMapPlacement } from "./combat-bench-placements.ts";
import type { PlacementBenchPlan } from "./combat-bench.ts";
import {
  pickSquadLeader,
  type LeaderCandidate,
  type NonCombatState,
} from "./non-combat-fsm.ts";
import type { EncounterNav, HuntPatrolRoute, PatrolGraph } from "./patrol.ts";
import { walkPathPoints, walkStepPositions } from "../combat-ai/walk-path.ts";
import type { CombatLocalizationLevel, CoverHeightBand } from "../combat-ai/cover-concealment-view.ts";
import { closestPointOnSegment, type BallisticBarrier } from "../combat-ai/geometry.ts";
import { isWithinMapCoverBenefitRadius } from "./ranged-attack-cover.ts";

export type CombatBenchSenseRing = {
  placementId: string;
  origin: Vec2;
  hearingA: number;
  openVisionV: number;
  passiveS: number;
};

export type CombatBenchPatrolPath = {
  placementId: string;
  team: string;
  waypoints: Vec2[];
  currentIndex: number;
};

export type CombatBenchNavRoom = {
  id: string;
  centroid: Vec2;
  cells: Vec2[];
  hull: Vec2[];
};

export type CombatBenchNavOverlay = {
  rooms: CombatBenchNavRoom[];
  nodes: { id: string; kind: "room" | "corner"; position: Vec2 }[];
  edges: { id: string; from: Vec2; to: Vec2 }[];
};

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Monotone-chain hull in meters. Degenerate clouds stay as the unique points. */
export function convexHullMeters(points: readonly Vec2[]): Vec2[] {
  const uniq: Vec2[] = [];
  for (const p of points) {
    if (!uniq.some((q) => Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6)) {
      uniq.push({ x: p.x, y: p.y });
    }
  }
  if (uniq.length <= 2) return uniq;
  const pts = [...uniq].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function nodeById(graph: PatrolGraph): Map<string, { id: string; kind: "room" | "corner"; position: Vec2 }> {
  return new Map(graph.nodes.map((n) => [n.id, { id: n.id, kind: n.kind, position: n.position }]));
}

export function buildCombatBenchNavOverlay(nav: EncounterNav | null | undefined): CombatBenchNavOverlay | null {
  if (!nav) return null;
  const lookup = nodeById(nav.graph);
  const edges: CombatBenchNavOverlay["edges"] = [];
  for (const edge of nav.graph.edges) {
    const a = lookup.get(edge.a);
    const b = lookup.get(edge.b);
    if (!a || !b) continue;
    edges.push({
      id: `${edge.a}|${edge.b}`,
      from: a.position,
      to: b.position,
    });
  }
  return {
    rooms: nav.rooms.map((room) => ({
      id: room.id,
      centroid: { ...room.centroid },
      cells: room.cells.map((c) => ({ ...c })),
      hull: convexHullMeters(room.cells.length >= 3 ? room.cells : [room.centroid, ...room.cells]),
    })),
    nodes: nav.graph.nodes.map((n) => ({ id: n.id, kind: n.kind, position: { ...n.position } })),
    edges,
  };
}

export type CombatBenchPlanFireLeg = {
  placementId: string;
  kind: "standard_fire" | "suppressive_fire" | "throw";
  label: string;
  from: Vec2;
  to: Vec2;
  round: number;
  planIndex: number;
};

export type LabeledPlanMoveLeg = PlanMoveLeg & { placementId: string };

const FIRE_KIND = actionKindIndex("standard_fire");
const SUPPRESS_KIND = actionKindIndex("suppressive_fire");
const THROW_KIND = actionKindIndex("throw");

export function buildCombatBenchSenseRings(input: {
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  originByPlacementId?: Readonly<Record<string, Vec2>>;
}): CombatBenchSenseRing[] {
  return input.placements.map((placement) => {
    const sense = senseFromSheet(input.sheetById.get(placement.sheetId));
    const origin = input.originByPlacementId?.[placement.id] ?? {
      x: placement.x,
      y: placement.y,
    };
    return {
      placementId: placement.id,
      origin,
      hearingA: sense.hearingA,
      openVisionV: sense.openVisionV,
      passiveS: sense.passiveS,
    };
  });
}

export function buildCombatBenchPatrolPaths(input: {
  placements: readonly CombatMapPlacement[];
  fsmByPlacementId?: Readonly<
    Record<string, { huntRoute?: HuntPatrolRoute; patrolIndex: number }>
  >;
}): CombatBenchPatrolPath[] {
  if (!input.fsmByPlacementId) return [];
  const out: CombatBenchPatrolPath[] = [];
  for (const placement of input.placements) {
    const memory = input.fsmByPlacementId[placement.id];
    const waypoints = memory?.huntRoute?.waypoints ?? [];
    if (waypoints.length < 2) continue;
    out.push({
      placementId: placement.id,
      team: placement.team,
      waypoints: waypoints.map((wp) => ({ ...wp.position })),
      currentIndex: memory?.patrolIndex ?? 0,
    });
  }
  return out;
}

export type CombatBenchWalkPreview = {
  placementId: string;
  polyline: Vec2[];
  steps: Vec2[];
};

export function buildCombatBenchWalkPreviews(input: {
  placements: readonly CombatMapPlacement[];
  plansByPlacementId?: Readonly<Record<string, PlacementBenchPlan>>;
  fsmByPlacementId?: Readonly<
    Record<string, { state?: NonCombatState; huntRoute?: HuntPatrolRoute; patrolIndex: number }>
  >;
}): CombatBenchWalkPreview[] {
  const out: CombatBenchWalkPreview[] = [];
  for (const placement of input.placements) {
    const bundle = input.plansByPlacementId?.[placement.id];
    const walls = bundle?.payload.walls ?? [];
    const from = bundle?.snapshot.position ?? { x: placement.x, y: placement.y };
    const stepM = Math.max(0.5, (bundle?.snapshot.mov ?? 6) * 0.5);
    const moveLegs = bundle ? buildCombatBenchActionBudgetView(bundle).moveLegs : [];
    const dest =
      moveLegs[moveLegs.length - 1]?.to ??
      (!bundle?.snapshot.targets.some((t) => t.localization === "exact" || t.localization === "full")
        ? input.fsmByPlacementId?.[placement.id]?.huntRoute?.waypoints[
            input.fsmByPlacementId[placement.id]?.patrolIndex ?? 0
          ]?.position
        : undefined);
    if (!dest) continue;
    const polyline =
      moveLegs.length > 0
        ? moveLegs.flatMap((leg, i) => (i === 0 ? leg.path : leg.path.slice(1)))
        : walkPathPoints(from, dest, walls);
    if (polyline.length < 2) continue;
    out.push({
      placementId: placement.id,
      polyline,
      steps: walkStepPositions(from, dest, walls, stepM).slice(1),
    });
  }
  return out;
}

export function buildCombatBenchPlanMoveLegs(
  plansByPlacementId: Readonly<Record<string, PlacementBenchPlan>> | undefined,
): LabeledPlanMoveLeg[] {
  if (!plansByPlacementId) return [];
  const out: LabeledPlanMoveLeg[] = [];
  for (const [placementId, bundle] of Object.entries(plansByPlacementId)) {
    for (const leg of buildCombatBenchActionBudgetView(bundle).moveLegs) {
      out.push({ ...leg, placementId });
    }
  }
  return out;
}

export function buildCombatBenchPlanFireLegs(
  plansByPlacementId: Readonly<Record<string, PlacementBenchPlan>> | undefined,
): CombatBenchPlanFireLeg[] {
  if (!plansByPlacementId) return [];
  const out: CombatBenchPlanFireLeg[] = [];
  for (const [placementId, bundle] of Object.entries(plansByPlacementId)) {
    const ordered = bundle.plan.actions
      .map((action, planIndex) => ({ action, planIndex }))
      .sort((a, b) =>
        a.action.round !== b.action.round
          ? a.action.round - b.action.round
          : a.planIndex - b.planIndex,
      );
    let sim = bundle.snapshot;
    for (const { action, planIndex } of ordered) {
      if (
        action.kind === FIRE_KIND ||
        action.kind === SUPPRESS_KIND ||
        action.kind === THROW_KIND
      ) {
        const from = sim.position;
        const targetId = bundle.payload.targetIds[action.target] ?? null;
        const target = targetId
          ? bundle.snapshot.targets.find((row) => row.id === targetId)
          : undefined;
        const aim =
          target?.position ??
          (action.kind === SUPPRESS_KIND
            ? suppressiveFireAimPoint(from, bundle.snapshot.targets)
            : null);
        if (aim) {
          const kind =
            action.kind === THROW_KIND
              ? "throw"
              : action.kind === SUPPRESS_KIND
                ? "suppressive_fire"
                : "standard_fire";
          const firePlan =
            kind === "standard_fire"
              ? planStandardFire(
                  sim,
                  Math.hypot(aim.x - from.x, aim.y - from.y),
                )
              : null;
          out.push({
            placementId,
            kind,
            label:
              kind === "throw"
                ? "投掷"
                : kind === "suppressive_fire"
                  ? "压制"
                  : fireModeActionLabel(firePlan!.mode, firePlan!.rounds),
            from: { ...from },
            to: { ...aim },
            round: action.round,
            planIndex,
          });
        }
      }
      sim = applyPlanStepToSnapshot(sim, bundle.payload, action);
    }
  }
  return out;
}

/** One leader per team with two or more living members. */
export function buildSquadLeaderPlacementIds(input: {
  placements: readonly CombatMapPlacement[];
  sheetById: ReadonlyMap<string, CharacterSheet>;
  healthByPlacementId?: Readonly<Record<string, BenchPlacementHealthState>>;
}): ReadonlySet<string> {
  const living = input.placements.filter(
    (placement) => !placementIsNeutralized(input.healthByPlacementId?.[placement.id]),
  );
  const byTeam = new Map<string, LeaderCandidate[]>();
  for (const placement of living) {
    const sheet = input.sheetById.get(placement.sheetId);
    const summary = sheet ? readOpcodeSheetSummary(sheet.stats, sheet.status) : null;
    const list = byTeam.get(placement.team) ?? [];
    list.push({
      id: placement.id,
      difficulty: placementProfileId(placement),
      skillScore: summary?.skillPointsUsed,
      attrScore: summary?.attributePointsUsed,
    });
    byTeam.set(placement.team, list);
  }
  const out = new Set<string>();
  for (const squad of byTeam.values()) {
    if (squad.length < 2) continue;
    const leaderId = pickSquadLeader(squad);
    if (leaderId) out.add(leaderId);
  }
  return out;
}

export function niceMapScaleMeters(mapWidthM: number): number {
  if (mapWidthM >= 80) return 20;
  if (mapWidthM >= 40) return 10;
  if (mapWidthM >= 16) return 5;
  return 2;
}

/** CSS pixels for a meter length at the current map zoom. */
export function mapScaleBarPx(lengthM: number, zoom: number, metersPerUnit: number): number {
  return (lengthM * zoom) / Math.max(metersPerUnit, 1e-9);
}

export function locLevelShortLabel(level: CombatLocalizationLevel | "none"): string {
  if (level === "full") return "完全";
  if (level === "exact") return "精确";
  if (level === "approximate") return "模糊";
  return "无";
}

export type CombatBenchCoverMark = {
  placementId: string;
  team: string;
  kind: "entered" | "map";
  coverId: string;
  band: CoverHeightBand | undefined;
  a: Vec2;
  b: Vec2;
  from: Vec2;
  to: Vec2;
};

export function coverMarkShortLabel(mark: Pick<CombatBenchCoverMark, "kind">): string {
  return mark.kind === "entered" ? "掩体" : "近掩";
}

function barrierCoverBand(barrier: BallisticBarrier): CoverHeightBand | undefined {
  return barrier.coverHeightBand ?? (barrier.blocksVision ? "full" : undefined);
}

function nearestMapCoverBarrier(
  point: Vec2,
  barriers: readonly BallisticBarrier[],
): BallisticBarrier | undefined {
  let best: BallisticBarrier | undefined;
  let bestD2 = Infinity;
  for (const barrier of barriers) {
    const band = barrierCoverBand(barrier);
    if (!band || band === "none") continue;
    if (!isWithinMapCoverBenefitRadius(point, barrier)) continue;
    const closest = closestPointOnSegment(point, barrier);
    const d2 = (closest.x - point.x) ** 2 + (closest.y - point.y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = barrier;
    }
  }
  return best;
}

export function buildCombatBenchCoverMarks(input: {
  placements: readonly CombatMapPlacement[];
  plansByPlacementId?: Readonly<Record<string, PlacementBenchPlan>>;
  barriers: readonly BallisticBarrier[];
}): CombatBenchCoverMark[] {
  if (input.barriers.length === 0) return [];
  const marks: CombatBenchCoverMark[] = [];
  for (const placement of input.placements) {
    const snapshot = input.plansByPlacementId?.[placement.id]?.snapshot;
    const from = snapshot?.position ?? { x: placement.x, y: placement.y };
    const entered = snapshot?.coverId
      ? input.barriers.find((barrier) => barrier.id === snapshot.coverId)
      : undefined;
    const barrier = entered ?? nearestMapCoverBarrier(from, input.barriers);
    if (!barrier) continue;
    marks.push({
      placementId: placement.id,
      team: placement.team,
      kind: entered ? "entered" : "map",
      coverId: barrier.id,
      band: barrierCoverBand(barrier),
      a: { ...barrier.a },
      b: { ...barrier.b },
      from: { ...from },
      to: closestPointOnSegment(from, barrier),
    });
  }
  return marks;
}

export type CombatBenchLocMark = {
  observerId: string;
  targetId: string;
  targetLabel: string;
  from: Vec2;
  to: Vec2;
  level: CombatLocalizationLevel;
};

export function buildCombatBenchLocMarks(input: {
  observerId: string | null;
  plansByPlacementId?: Readonly<Record<string, PlacementBenchPlan>>;
  labelById: (id: string) => string;
}): CombatBenchLocMark[] {
  if (!input.observerId || !input.plansByPlacementId) return [];
  const bundle = input.plansByPlacementId[input.observerId];
  if (!bundle) return [];
  const from = bundle.snapshot.position;
  return bundle.snapshot.targets.map((target) => ({
    observerId: input.observerId!,
    targetId: target.id,
    targetLabel: input.labelById(target.id),
    from: { ...from },
    to: { ...target.position },
    level: target.localization,
  }));
}

const FSM_STATE_LABEL: Record<NonCombatState, string> = {
  patrol: "巡逻",
  investigate: "调查",
  search: "搜索",
  assist: "协助",
  recon: "侦察",
};

export type CombatBenchFsmHint = {
  placementId: string;
  text: string;
  destination?: Vec2;
};

export function fsmStateLabel(state: NonCombatState | undefined, inCombat: boolean): string {
  if (inCombat) return "接战";
  return state ? FSM_STATE_LABEL[state] : "待命";
}

export function buildCombatBenchFsmHints(input: {
  placements: readonly CombatMapPlacement[];
  plansByPlacementId?: Readonly<Record<string, PlacementBenchPlan>>;
  fsmByPlacementId?: Readonly<
    Record<string, { state?: NonCombatState; huntRoute?: HuntPatrolRoute; patrolIndex: number }>
  >;
}): CombatBenchFsmHint[] {
  return input.placements.map((placement) => {
    const snapshot = input.plansByPlacementId?.[placement.id]?.snapshot;
    const inCombat = snapshot?.targets.some((t) => t.localization === "exact" || t.localization === "full") ?? false;
    const memory = input.fsmByPlacementId?.[placement.id];
    const waypoint = memory?.huntRoute?.waypoints[memory.patrolIndex];
    const destination = !inCombat && waypoint ? { ...waypoint.position } : undefined;
    const destNote =
      destination != null ? ` → (${destination.x.toFixed(0)}, ${destination.y.toFixed(0)})` : "";
    return {
      placementId: placement.id,
      text: `${fsmStateLabel(memory?.state, inCombat)}${destNote}`,
      destination,
    };
  });
}

export function planFireKindLabel(leg: CombatBenchPlanFireLeg | CombatBenchPlanFireLeg["kind"]): string {
  if (typeof leg === "string") {
    if (leg === "suppressive_fire") return "压制";
    if (leg === "throw") return "投掷";
    return "射击";
  }
  return leg.label;
}

export function markerDifficultyLabel(profileId: NpcDifficultyId | undefined): string {
  return NPC_DIFFICULTY_LABELS[profileId ?? "trained"];
}

export { formatPlanMoveDebug } from "./combat-plan-intent.ts";

export function buildCombatBenchMoveDebugHints(
  plansByPlacementId: Readonly<Record<string, PlacementBenchPlan>> | undefined,
): { placementId: string; text: string }[] {
  if (!plansByPlacementId) return [];
  const byId = new Map<string, LabeledPlanMoveLeg>();
  for (const leg of buildCombatBenchPlanMoveLegs(plansByPlacementId)) {
    if (!byId.has(leg.placementId)) byId.set(leg.placementId, leg);
  }
  return Object.keys(plansByPlacementId).map((placementId) => {
    const bundle = plansByPlacementId[placementId]!;
    const leg = byId.get(placementId);
    if (leg) return { placementId, text: formatPlanMoveDebug(leg.from, leg.to, undefined, leg.meters) };
    const slot = bundle.plan.actions[0]?.round ?? 0;
    return {
      placementId,
      text: formatPlanMoveDebug(
        bundle.snapshot.position,
        bundle.snapshot.position,
        planStayReason({
          payload: bundle.payload,
          actions: bundle.plan.actions,
          slot,
          movRemaining: remainingMoveBudgetMeters(
            bundle.snapshot.mov,
            bundle.snapshot.metersMovedThisRound,
          ),
          coverId: bundle.snapshot.coverId,
          profileId: bundle.snapshot.encounter.profileId,
        }),
      ),
    };
  });
}

/** SVG triangle at `to`, pointing along from→to. */
export function svgArrowHeadPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): string | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || size <= 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  const baseX = to.x - ux * size;
  const baseY = to.y - uy * size;
  const px = -uy * size * 0.45;
  const py = ux * size * 0.45;
  return `${to.x},${to.y} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`;
}
