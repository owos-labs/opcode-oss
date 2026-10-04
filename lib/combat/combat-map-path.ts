export type SvgPoint = { x: number; y: number };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Parse M/L path commands used in combat map SVGs. */
export function parsePathD(d: string): SvgPoint[] {
  const pts: SvgPoint[] = [];
  const re = /([ML])\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    pts.push({ x: Number(m[2]), y: Number(m[3]) });
  }
  return pts;
}

export function pathIsClosed(d: string): boolean {
  return /z\s*$/i.test(d.trim());
}

export function formatPathD(points: readonly SvgPoint[], closed = false): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const head = `M${round1(first!.x)} ${round1(first!.y)}`;
  const lines = rest.map((p) => `L${round1(p.x)} ${round1(p.y)}`).join("");
  return closed ? `${head}${lines}Z` : `${head}${lines}`;
}

export function translatePathD(d: string, dx: number, dy: number): string {
  const closed = pathIsClosed(d);
  const points = parsePathD(d).map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return formatPathD(points, closed);
}

export function setPathVertex(d: string, index: number, x: number, y: number): string {
  const closed = pathIsClosed(d);
  const points = parsePathD(d);
  if (index < 0 || index >= points.length) return d;
  points[index] = { x, y };
  return formatPathD(points, closed);
}
