/**
 * Curvature-adaptive resampling with cosine clustering at the leading and
 * trailing edges.
 *
 * The result is the point sequence used for export and, in Phase 2, the
 * panelisation handed to the solver. See docs/spec/01-geometry.md 1.5.
 *
 * Method: build a fine table over the chain, give every table entry a
 * sampling density, integrate that density along the arc length, then place
 * the output points at equal increments of the integral. Both density terms
 * are multiplicative, so neither can switch the other off.
 */

import {
  CLUSTER_SIN_FLOOR,
  DEFAULT_CURVATURE_WEIGHT,
  DEFAULT_SAMPLE_COUNT,
  SEGMENT_SUBSAMPLES,
} from "./constants.js";
import { curvature, evaluate, unitNormal, unitTangent } from "./bezier.js";
import type { BezierSegment, CurvePoint, ResolvedElement } from "./types.js";
import { distance } from "./vec.js";

export interface SampleOptions {
  /** Points per element. Default 200, per the specification. */
  readonly count?: number;
  /** How strongly curvature attracts points. 0 disables the adaptive term. */
  readonly curvatureWeight?: number;
  /** Set to false to switch off the cosine clustering at the edges. */
  readonly cosineClustering?: boolean;
}

interface TableRow {
  /** Global chain parameter: integer part is the segment, fraction is `t`. */
  readonly u: number;
  readonly s: number;
  readonly kappa: number;
}

function buildTable(element: ResolvedElement): TableRow[] {
  const rows: TableRow[] = [];
  let s = 0;
  let previous = evaluate(element.segments[0] as BezierSegment, 0);
  for (let i = 0; i < element.segments.length; i += 1) {
    const segment = element.segments[i] as BezierSegment;
    const first = i === 0 ? 0 : 1;
    for (let k = first; k <= SEGMENT_SUBSAMPLES; k += 1) {
      const t = k / SEGMENT_SUBSAMPLES;
      const p = evaluate(segment, t);
      s += distance(previous, p);
      previous = p;
      rows.push({ u: i + t, s, kappa: curvature(segment, t) });
    }
  }
  return rows;
}

function medianAbs(values: readonly number[]): number {
  const sorted = values.map(Math.abs).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const value =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return value > 0 ? value : 1;
}

/**
 * Cosine clustering density inside one surface.
 *
 * Classic cosine spacing places points at `x = (1 - cos(theta)) / 2`, whose
 * density is `1 / sin(theta)`. That is infinite at both ends, so it is
 * floored at `CLUSTER_SIN_FLOOR`; without the floor every point collapses
 * onto the leading and trailing edges.
 */
function clusterDensity(u: number): number {
  return 1 / Math.max(Math.sin(Math.PI * Math.min(Math.max(u, 0), 1)), CLUSTER_SIN_FLOOR);
}

/**
 * Sample an element into `count` points.
 *
 * The first and the last returned point are exactly the two trailing edge
 * anchors, so the caller can close the contour with a straight base line of
 * length `teThickness`.
 *
 * Every returned point lies on the curve by construction: it is
 * `evaluate(segment, t)` for its own `segment` and `t`, never an
 * interpolation between samples.
 */
export function sampleElement(
  element: ResolvedElement,
  options: SampleOptions = {},
): CurvePoint[] {
  const count = options.count ?? DEFAULT_SAMPLE_COUNT;
  const curvatureWeight = options.curvatureWeight ?? DEFAULT_CURVATURE_WEIGHT;
  const clustering = options.cosineClustering ?? true;

  if (!Number.isInteger(count) || count < 3) {
    throw new RangeError("sample count must be an integer >= 3");
  }

  const table = buildTable(element);
  const total = (table[table.length - 1] as TableRow).s;
  const kappaRef = medianAbs(table.map((r) => r.kappa));

  // The leading edge splits the chain into the two surfaces that are
  // clustered independently.
  const leRow = table.reduce((best, row) =>
    Math.abs(row.u - element.leIndex) < Math.abs(best.u - element.leIndex) ? row : best,
  );
  const sLe = leRow.s;

  const density = table.map((row) => {
    const adaptive = 1 + curvatureWeight * Math.sqrt(Math.abs(row.kappa) / kappaRef);
    if (!clustering) return adaptive;
    const local = row.s <= sLe ? row.s / Math.max(sLe, 1e-12) : (row.s - sLe) / Math.max(total - sLe, 1e-12);
    return adaptive * clusterDensity(local);
  });

  // Cumulative integral of the density with respect to arc length.
  const cumulative: number[] = new Array<number>(table.length);
  cumulative[0] = 0;
  for (let i = 1; i < table.length; i += 1) {
    const ds = (table[i] as TableRow).s - (table[i - 1] as TableRow).s;
    const mean = ((density[i] as number) + (density[i - 1] as number)) / 2;
    cumulative[i] = (cumulative[i - 1] as number) + mean * ds;
  }
  const totalDensity = cumulative[cumulative.length - 1] as number;

  const out: CurvePoint[] = [];
  for (let k = 0; k < count; k += 1) {
    const target = (totalDensity * k) / (count - 1);
    const { u, s } = invert(table, cumulative, target);
    out.push(pointAt(element, u, s));
  }
  return out;
}

/** Binary search plus linear interpolation inside the bracketing table interval. */
function invert(
  table: readonly TableRow[],
  cumulative: readonly number[],
  target: number,
): { u: number; s: number } {
  const last = table.length - 1;
  if (target <= 0) return { u: (table[0] as TableRow).u, s: (table[0] as TableRow).s };
  if (target >= (cumulative[last] as number)) {
    return { u: (table[last] as TableRow).u, s: (table[last] as TableRow).s };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] as number) <= target) lo = mid;
    else hi = mid;
  }
  const c0 = cumulative[lo] as number;
  const c1 = cumulative[hi] as number;
  const w = c1 === c0 ? 0 : (target - c0) / (c1 - c0);
  const r0 = table[lo] as TableRow;
  const r1 = table[hi] as TableRow;
  return { u: r0.u + (r1.u - r0.u) * w, s: r0.s + (r1.s - r0.s) * w };
}

function pointAt(element: ResolvedElement, u: number, s: number): CurvePoint {
  const count = element.segments.length;
  const index = Math.min(Math.floor(u), count - 1);
  const t = u - index;
  const segment = element.segments[index] as BezierSegment;
  return {
    point: evaluate(segment, t),
    segment: index,
    t,
    s,
    tangent: unitTangent(segment, t),
    normal: unitNormal(segment, t),
    kappa: curvature(segment, t),
  };
}

/** Total arc length of the chain, from the same table the sampler uses. */
export function chainLength(element: ResolvedElement): number {
  const table = buildTable(element);
  return (table[table.length - 1] as TableRow).s;
}
