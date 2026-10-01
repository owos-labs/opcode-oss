import type { Vec2, WallSegment } from "./visibility.ts";

const EPS = 1e-9;
const CORNER_INSET = 0.15;

export type WalkCostNode = { pos: Vec2; cost: number };
export type WalkRoute = { points: Vec2[]; meters: number };

// Compiled map geometry is immutable. A new wall array gets a new navigation cache.
const boundedWallsCache = new WeakMap<readonly WallSegment[], { boundsKey: string; walls: WallSegment[] }>();
// ponytail: dense O(corners²) edge cache suits current maps; use sparse edges if map sizes outgrow it.
const walkGraphCache = new WeakMap<readonly WallSegment[], { anchors: Vec2[]; visibility: Int8Array }>();

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

function hypot2(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function keyOf(p: Vec2): string {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
}

/** Map edge is a walk wall. SVG bounding_box is not in `map.walls`. */
export function walkWalls(
  walls: readonly WallSegment[],
  bounds?: { min: Vec2; max: Vec2 } | null,
): WallSegment[] {
  const boundsKey = bounds ? `${bounds.min.x},${bounds.min.y},${bounds.max.x},${bounds.max.y}` : "";
  const cached = boundedWallsCache.get(walls);
  if (cached?.boundsKey === boundsKey) return cached.walls;
  const frame: WallSegment[] = [];
  if (bounds) {
    const { min, max } = bounds;
    frame.push(
      { a: { x: min.x, y: min.y }, b: { x: max.x, y: min.y } },
      { a: { x: max.x, y: min.y }, b: { x: max.x, y: max.y } },
      { a: { x: max.x, y: max.y }, b: { x: min.x, y: max.y } },
      { a: { x: min.x, y: max.y }, b: { x: min.x, y: min.y } },
    );
  }
  const baked = bakeWalkWalls([
    ...walls,
    ...frame,
  ]);
  boundedWallsCache.set(walls, { boundsKey, walls: baked });
  return baked;
}

/** Collinear overlapping/touching segments become one wall. */
export function bakeWalkWalls(walls: readonly WallSegment[]): WallSegment[] {
  type Span = { t0: number; t1: number };
  type Group = { origin: Vec2; ux: number; uy: number; spans: Span[] };
  const groups = new Map<string, Group>();

  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    let ux = dx / len;
    let uy = dy / len;
    if (ux < -EPS || (Math.abs(ux) <= EPS && uy < 0)) {
      ux = -ux;
      uy = -uy;
    }
    const off = wall.a.x * uy - wall.a.y * ux;
    const key = `${ux.toFixed(4)}:${uy.toFixed(4)}:${off.toFixed(4)}`;
    let group = groups.get(key);
    if (!group) {
      group = { origin: { x: wall.a.x, y: wall.a.y }, ux, uy, spans: [] };
      groups.set(key, group);
    }
    const tA = (wall.a.x - group.origin.x) * group.ux + (wall.a.y - group.origin.y) * group.uy;
    const tB = (wall.b.x - group.origin.x) * group.ux + (wall.b.y - group.origin.y) * group.uy;
    group.spans.push({ t0: Math.min(tA, tB), t1: Math.max(tA, tB) });
  }

  const out: WallSegment[] = [];
  for (const group of groups.values()) {
    group.spans.sort((a, b) => a.t0 - b.t0 || a.t1 - b.t1);
    let cur = group.spans[0];
    if (!cur) continue;
    for (let i = 1; i < group.spans.length; i++) {
      const next = group.spans[i]!;
      if (next.t0 <= cur.t1 + 1e-3) {
        cur = { t0: cur.t0, t1: Math.max(cur.t1, next.t1) };
      } else {
        out.push({
          a: { x: group.origin.x + group.ux * cur.t0, y: group.origin.y + group.uy * cur.t0 },
          b: { x: group.origin.x + group.ux * cur.t1, y: group.origin.y + group.uy * cur.t1 },
        });
        cur = next;
      }
    }
    out.push({
      a: { x: group.origin.x + group.ux * cur.t0, y: group.origin.y + group.uy * cur.t0 },
      b: { x: group.origin.x + group.ux * cur.t1, y: group.origin.y + group.uy * cur.t1 },
    });
  }
  return out;
}

const SIDE_EPS = 1e-4;

function pointInRing(p: Vec2, ring: readonly Vec2[]): boolean {
  let n = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (a.y > p.y === b.y > p.y) continue;
    const dy = b.y - a.y;
    if (Math.abs(dy) < EPS) continue;
    const x = a.x + ((p.y - a.y) / dy) * (b.x - a.x);
    if (x > p.x) n += 1;
  }
  return n % 2 === 1;
}

function pointInUnion(p: Vec2, rings: readonly Vec2[][]): boolean {
  return rings.some((ring) => pointInRing(p, ring));
}

function properIntersectT(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) return null;
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS) return t;
  return null;
}

function uniqueTs(ts: number[]): number[] {
  ts.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of ts) {
    if (out.length === 0 || t - out[out.length - 1]! > 1e-8) out.push(t);
  }
  return out;
}

/** Overlapping rings → union outline. Internal edges are dropped. */
export function unionWalkRings(rings: readonly Vec2[][]): WallSegment[] {
  const closed = rings.filter((ring) => ring.length >= 3);
  if (closed.length === 0) return [];
  const frags: WallSegment[] = [];
  for (const ring of closed) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      if (hypot2(a, b) < EPS) continue;
      const ts = [0, 1];
      for (const other of closed) {
        for (let j = 0; j < other.length; j++) {
          const c = other[j]!;
          const d = other[(j + 1) % other.length]!;
          const hit = properIntersectT(a, b, c, d);
          if (hit != null) ts.push(hit);
          const tc = vertexOnOpenSegmentT(a, b, c);
          const td = vertexOnOpenSegmentT(a, b, d);
          if (tc != null) ts.push(tc);
          if (td != null) ts.push(td);
        }
      }
      const uniq = uniqueTs(ts);
      for (let k = 0; k < uniq.length - 1; k++) {
        const t0 = uniq[k]!;
        const t1 = uniq[k + 1]!;
        if (t1 - t0 < 1e-8) continue;
        frags.push({
          a: { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 },
          b: { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 },
        });
      }
    }
  }
  const kept: WallSegment[] = [];
  for (const edge of frags) {
    const dx = edge.b.x - edge.a.x;
    const dy = edge.b.y - edge.a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const mx = (edge.a.x + edge.b.x) / 2;
    const my = (edge.a.y + edge.b.y) / 2;
    const nx = (-dy / len) * SIDE_EPS;
    const ny = (dx / len) * SIDE_EPS;
    const inL = pointInUnion({ x: mx + nx, y: my + ny }, closed);
    const inR = pointInUnion({ x: mx - nx, y: my - ny }, closed);
    if (inL !== inR) kept.push(edge);
  }
  return bakeWalkWalls(kept);
}

/** Proper crossing only — walking along a wall or grazing a corner is allowed. */
function segmentsCrossInterior(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const o1 = cross(sub(p2, p1), sub(p3, p1));
  const o2 = cross(sub(p2, p1), sub(p4, p1));
  const o3 = cross(sub(p4, p3), sub(p1, p3));
  const o4 = cross(sub(p4, p3), sub(p2, p3));
  return o1 * o2 < -EPS && o3 * o4 < -EPS;
}

function alongWall(from: Vec2, to: Vec2, wall: WallSegment): boolean {
  return (
    Math.abs(cross(sub(to, from), sub(wall.a, from))) <= EPS &&
    Math.abs(cross(sub(to, from), sub(wall.b, from))) <= EPS
  );
}

function vertexOnOpenSegmentT(from: Vec2, to: Vec2, p: Vec2): number | null {
  const d = sub(to, from);
  const len2 = d.x * d.x + d.y * d.y;
  if (len2 <= EPS) return null;
  const t = ((p.x - from.x) * d.x + (p.y - from.y) * d.y) / len2;
  if (t <= EPS || t >= 1 - EPS) return null;
  const q = { x: from.x + t * d.x, y: from.y + t * d.y };
  if (Math.hypot(q.x - p.x, q.y - p.y) > 1e-6) return null;
  return t;
}

function firstWalkHitT(from: Vec2, to: Vec2, walls: readonly WallSegment[]): number | null {
  let best = Infinity;
  for (const wall of walls) {
    if (alongWall(from, to, wall)) continue;
    const end = closestPointOnSegment(to, wall);
    if (hypot2(to, end) <= 1e-6) best = Math.min(best, 1);
    if (segmentsCrossInterior(from, to, wall.a, wall.b)) {
      const t = walkHitT(from, to, wall);
      if (t !== null && t < best) best = t;
    }
    for (const p of [wall.a, wall.b]) {
      const t = vertexOnOpenSegmentT(from, to, p);
      if (t !== null && t < best) best = t;
    }
  }
  return Number.isFinite(best) ? best : null;
}

export function hasWalkClear(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[],
): boolean {
  for (const wall of walls) {
    if (alongWall(from, to, wall)) continue;
    // Landing on an edge lets the next move start inside the obstacle.
    if (hypot2(to, closestPointOnSegment(to, wall)) <= 1e-6) return false;
    if (
      segmentsCrossInterior(from, to, wall.a, wall.b) ||
      vertexOnOpenSegmentT(from, to, wall.a) !== null ||
      vertexOnOpenSegmentT(from, to, wall.b) !== null
    ) return false;
  }
  return true;
}

function closestPointOnSegment(p: Vec2, seg: WallSegment): Vec2 {
  const abx = seg.b.x - seg.a.x;
  const aby = seg.b.y - seg.a.y;
  const ab2 = abx * abx + aby * aby;
  const t =
    ab2 <= EPS
      ? 0
      : Math.max(0, Math.min(1, ((p.x - seg.a.x) * abx + (p.y - seg.a.y) * aby) / ab2));
  return { x: seg.a.x + t * abx, y: seg.a.y + t * aby };
}

function onWall(p: Vec2, walls: readonly WallSegment[]): boolean {
  for (const wall of walls) {
    const c = closestPointOnSegment(p, wall);
    if (Math.hypot(p.x - c.x, p.y - c.y) <= 1e-6) return true;
  }
  return false;
}

function walkHitT(from: Vec2, to: Vec2, wall: WallSegment): number | null {
  if (!segmentsCrossInterior(from, to, wall.a, wall.b)) return null;
  const d1 = sub(to, from);
  const d2 = sub(wall.b, wall.a);
  const denom = cross(d1, d2);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(sub(wall.a, from), d2) / denom;
  if (t <= EPS || t >= 1 - EPS) return null;
  return t;
}

/** How far you can walk in `dir` from `from` before a wall, capped at maxMeters. */
export function walkRayReachMeters(
  from: Vec2,
  dir: Vec2,
  walls: readonly WallSegment[],
  maxMeters: number,
): number {
  const maxM = Math.max(0, maxMeters);
  if (maxM <= EPS) return 0;
  const to = { x: from.x + dir.x * maxM, y: from.y + dir.y * maxM };
  const t = firstWalkHitT(from, to, walls);
  if (t === null) return maxM;
  return Math.max(0, t * maxM - 0.05);
}

/** Off-wall anchors near corners. Exact vertices leak through closed rooms. */
function uniqueWalkAnchors(walls: readonly WallSegment[]): Vec2[] {
  const seen = new Set<string>();
  const out: Vec2[] = [];
  const push = (p: Vec2) => {
    const k = keyOf(p);
    if (seen.has(k)) return;
    seen.add(k);
    if (onWall(p, walls)) return;
    out.push(p);
  };
  const e = CORNER_INSET;
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const nx = (-dy / len) * e;
    const ny = (dx / len) * e;
    const tx = (dx / len) * e;
    const ty = (dy / len) * e;
    for (const p of [wall.a, wall.b]) {
      for (const s of [-1, 1] as const) {
        for (const k of [-1, 1] as const) {
          push({ x: p.x + s * tx + k * nx, y: p.y + s * ty + k * ny });
        }
      }
    }
  }
  return out;
}

/** A* for a destination; Dijkstra for a movement budget. Both use the same walk graph. */
function searchWalkGraph(
  origin: Vec2,
  walls: readonly WallSegment[],
  maxMeters: number,
  destination?: Vec2,
): { nodes: Vec2[]; best: number[]; prev: number[] } {
  let graph = walkGraphCache.get(walls);
  if (!graph) {
    const anchors = uniqueWalkAnchors(walls);
    graph = { anchors, visibility: new Int8Array(anchors.length * anchors.length) };
    walkGraphCache.set(walls, graph);
  }
  const seen = new Set<string>([keyOf(origin)]);
  const nodes: Vec2[] = [{ ...origin }];
  const anchorIndices = [-1];
  const push = (p: Vec2, anchorIndex: number) => {
    const k = keyOf(p);
    if (seen.has(k)) return;
    seen.add(k);
    nodes.push({ x: p.x, y: p.y });
    anchorIndices.push(anchorIndex);
  };
  for (let i = 0; i < graph.anchors.length; i++) {
    const p = graph.anchors[i]!;
    const lowerBound = hypot2(origin, p) + (destination ? hypot2(p, destination) : 0);
    if (lowerBound <= maxMeters + EPS) push(p, i);
  }
  if (destination) push(destination, -1);
  const goalKey = destination ? keyOf(destination) : undefined;
  const heuristic = nodes.map((p) => destination ? hypot2(p, destination) : 0);

  const best = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const used = nodes.map(() => false);
  best[0] = 0;

  while (true) {
    let mi = -1;
    let mc = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const estimate = best[i]! + heuristic[i]!;
      if (used[i] || estimate >= mc) continue;
      mc = estimate;
      mi = i;
    }
    if (mi < 0 || mc > maxMeters + EPS) break;
    used[mi] = true;
    const cur = nodes[mi]!;
    if (goalKey !== undefined && keyOf(cur) === goalKey) break;
    const left = maxMeters - best[mi]!;
    for (let j = 0; j < nodes.length; j++) {
      if (used[j]) continue;
      const nxt = nodes[j]!;
      const d = hypot2(cur, nxt);
      const total = best[mi]! + d;
      if (d <= EPS || d > left + EPS || total >= best[j]! || total + heuristic[j]! > maxMeters + EPS) continue;
      const a = anchorIndices[mi]!;
      const b = anchorIndices[j]!;
      if (a >= 0 && b >= 0) {
        const index = a * graph.anchors.length + b;
        let visible = graph.visibility[index]!;
        if (visible === 0) {
          visible = hasWalkClear(cur, nxt, walls) ? 1 : -1;
          graph.visibility[index] = visible;
          graph.visibility[b * graph.anchors.length + a] = visible;
        }
        if (visible < 0) continue;
      } else if (!hasWalkClear(cur, nxt, walls)) continue;
      best[j] = total;
      prev[j] = mi;
    }
  }
  return { nodes, best, prev };
}

function reconstruct(nodes: readonly Vec2[], prev: readonly number[], end: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = end; i >= 0; i = prev[i]!) points.push(nodes[i]!);
  points.reverse();
  return points;
}

/** Visibility-graph Dijkstra: origin plus inset corner anchors. */
export function expandVisibilityWalk(
  origin: Vec2,
  walls: readonly WallSegment[],
  maxMeters: number,
): WalkCostNode[] {
  const maxM = Math.max(0, maxMeters);
  if (maxM <= EPS) return [{ pos: { ...origin }, cost: 0 }];
  const { nodes, best } = searchWalkGraph(origin, walls, maxM);
  const out: WalkCostNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const cost = best[i]!;
    if (cost > maxM + EPS) continue;
    out.push({ pos: nodes[i]!, cost });
  }
  return out;
}

/** Last LOS hop from an already-expanded visibility walk. */
export function walkCostViaNodes(
  from: Vec2,
  to: Vec2,
  nodes: readonly WalkCostNode[],
  walls: readonly WallSegment[],
  maxMeters: number,
): number | null {
  const straight = hypot2(from, to);
  if (straight <= EPS) return 0;
  if (straight > maxMeters + EPS) return null;
  if (hasWalkClear(from, to, walls)) return straight;
  let best = Infinity;
  for (const node of nodes) {
    const rest = hypot2(node.pos, to);
    const total = node.cost + rest;
    if (total > best || total > maxMeters + EPS) continue;
    if (hasWalkClear(node.pos, to, walls)) best = total;
  }
  return Number.isFinite(best) ? best : null;
}

function sampleLosFromNode(
  node: WalkCostNode,
  walls: readonly WallSegment[],
  maxMeters: number,
  cellSize: number,
  rays: number,
): WalkCostNode[] {
  const left = maxMeters - node.cost;
  if (left <= EPS) return [];
  const out: WalkCostNode[] = [];
  const near = Math.min(Math.max(cellSize, 0.5), left);
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const reach = walkRayReachMeters(node.pos, dir, walls, left);
    if (reach <= EPS) continue;
    const dists = [near, reach / 3, (2 * reach) / 3, reach];
    const seen = new Set<string>();
    for (const d of dists) {
      if (d < 0.4 || d > reach + EPS) continue;
      const pos = { x: node.pos.x + dir.x * d, y: node.pos.y + dir.y * d };
      const k = keyOf(pos);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ pos, cost: node.cost + d });
    }
  }
  return out;
}

/**
 * At each visibility-walk waypoint, recast leftover LOS and keep a few points
 * along those rays. `cellSize` only sets the nearest sample spacing.
 */
export function expandWalkCosts(
  origin: Vec2,
  walls: readonly WallSegment[],
  maxMeters: number,
  cellSize = 1,
  rays = 16,
  vis: readonly WalkCostNode[] = expandVisibilityWalk(origin, walls, maxMeters),
): WalkCostNode[] {
  const out: WalkCostNode[] = [...vis];
  for (const node of vis) {
    out.push(...sampleLosFromNode(node, walls, maxMeters, cellSize, rays));
  }
  return out;
}

/** Frontier of leftover LOS disks around each visibility-walk waypoint. */
export function walkReachFrontier(
  origin: Vec2,
  walls: readonly WallSegment[],
  maxMeters: number,
  rays = 36,
): Vec2[] {
  const vis = expandVisibilityWalk(origin, walls, maxMeters);
  const pts: Vec2[] = [];
  for (const node of vis) {
    const left = maxMeters - node.cost;
    if (left <= EPS) continue;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const reach = walkRayReachMeters(node.pos, dir, walls, left);
      if (reach <= EPS) continue;
      pts.push({ x: node.pos.x + dir.x * reach, y: node.pos.y + dir.y * reach });
    }
  }
  return pts;
}

function destIndex(nodes: readonly Vec2[], dest: Vec2, best: readonly number[]): number {
  const k = keyOf(dest);
  let ti = -1;
  let tc = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (keyOf(nodes[i]!) !== k) continue;
    if (best[i]! < tc) {
      tc = best[i]!;
      ti = i;
    }
  }
  return ti;
}

export function walkPath(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[] = [],
  maxMeters?: number,
): WalkRoute | null {
  const straight = hypot2(from, to);
  if (straight <= EPS) return { points: [{ ...from }], meters: 0 };
  const maxM = maxMeters ?? Infinity;
  if (straight > maxM + EPS) return null;
  if (hasWalkClear(from, to, walls)) return { points: [{ ...from }, { ...to }], meters: straight };

  const { nodes, best, prev } = searchWalkGraph(from, walls, maxM, to);
  const ti = destIndex(nodes, to, best);
  if (ti < 0 || best[ti]! > maxM + EPS) return null;
  return { points: reconstruct(nodes, prev, ti), meters: best[ti]! };
}

export function pointAlongPolyline(points: readonly Vec2[], meters: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || meters <= EPS) return { ...points[0]! };
  let left = Math.max(0, meters);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const d = hypot2(a, b);
    if (left <= d + EPS) {
      if (d <= EPS) return { ...b };
      const k = left / d;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= d;
  }
  return { ...points[points.length - 1]! };
}

/** Find the complete route first, then spend this turn's movement along it. */
export function stepAlongWalk(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[],
  meters: number,
): Vec2 {
  if (meters <= EPS) return { ...from };
  const route = walkPath(from, to, walls);
  return route ? pointAlongPolyline(route.points, meters) : { ...from };
}

/** Actual landings after each gait step along the walked path, including origin. */
export function walkStepPositions(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[],
  stepMeters: number,
  opts?: { maxSteps?: number },
): Vec2[] {
  const steps: Vec2[] = [{ ...from }];
  if (stepMeters <= EPS) return steps;
  const maxSteps = Math.max(1, opts?.maxSteps ?? 24);
  const route = walkPath(from, to, walls);
  if (!route) return steps;
  const total = route.meters;
  for (let i = 1; i <= maxSteps; i++) {
    const m = i * stepMeters;
    if (m >= total - EPS) {
      const end = route.points[route.points.length - 1]!;
      if (hypot2(steps[steps.length - 1]!, end) > EPS) steps.push({ ...end });
      break;
    }
    steps.push(pointAlongPolyline(route.points, m));
  }
  return steps;
}

export function walkPathPoints(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[],
  maxMeters?: number,
): Vec2[] {
  return walkPath(from, to, walls, maxMeters)?.points ?? [{ ...from }];
}

/** Actual walk meters around walls, or null if no path fits in maxMeters. */
export function walkPathMeters(
  from: Vec2,
  to: Vec2,
  walls: readonly WallSegment[] = [],
  opts?: { cellSize?: number; maxMeters?: number },
): number | null {
  return walkPath(from, to, walls, opts?.maxMeters)?.meters ?? null;
}
