/**
 * Curvature along a chain, the comb, and the continuity report.
 *
 * Everything here is analytic (golden rule G9). See
 * docs/spec/02-curvature.md.
 */

import { curvature, evaluate, unitNormal, unitTangent } from "./bezier.js";
import type { BezierSegment, CurvePoint, Point, ResolvedElement } from "./types.js";
import { addScaled, distance, dot } from "./vec.js";

/** Continuity measured across one anchor, for the G0/G1/G2 assertions. */
export interface ContinuityReport {
  readonly anchorIndex: number;
  /** Distance between the two segment endpoints. G0. */
  readonly positionGap: number;
  /** Distance between the two unit tangents. G1. */
  readonly tangentGap: number;
  /** Absolute difference of the signed curvatures. G2. */
  readonly curvatureGap: number;
  /** The curvature approaching the anchor, used to judge the G2 gap relatively. */
  readonly curvatureIn: number;
  readonly curvatureOut: number;
}

/**
 * Measure G0, G1 and G2 across every interior anchor of an element.
 *
 * The tangents on both sides point in the direction of travel, so G1 holds
 * when they are equal, not when they are antiparallel: the antiparallel pair
 * lives in the construction, not in the traversal.
 *
 * Tolerances for asserting on these numbers are in
 * docs/spec/07-testing.md.
 */
export function continuityReport(element: ResolvedElement): ContinuityReport[] {
  const reports: ContinuityReport[] = [];
  for (let i = 1; i < element.segments.length; i += 1) {
    const before = element.segments[i - 1] as BezierSegment;
    const after = element.segments[i] as BezierSegment;
    const endPoint = evaluate(before, 1);
    const startPoint = evaluate(after, 0);
    const tangentIn = unitTangent(before, 1);
    const tangentOut = unitTangent(after, 0);
    const kIn = curvature(before, 1);
    const kOut = curvature(after, 0);
    reports.push({
      anchorIndex: i,
      positionGap: distance(endPoint, startPoint),
      tangentGap: Math.hypot(tangentIn.x - tangentOut.x, tangentIn.y - tangentOut.y),
      curvatureGap: Math.abs(kIn - kOut),
      curvatureIn: kIn,
      curvatureOut: kOut,
    });
  }
  return reports;
}

/**
 * Evaluate the chain at a global parameter.
 *
 * `u` runs from 0 to `segments.length`; its integer part selects the
 * segment and its fractional part is the parameter within it. `u` equal to
 * the segment count is the very end of the chain.
 */
export function evaluateChain(element: ResolvedElement, u: number): CurvePoint {
  const count = element.segments.length;
  const clamped = Math.min(Math.max(u, 0), count);
  const index = Math.min(Math.floor(clamped), count - 1);
  const t = clamped - index;
  const segment = element.segments[index] as BezierSegment;
  return {
    point: evaluate(segment, t),
    segment: index,
    t,
    // `s` is filled in by the sampler, which is the only place that knows
    // the cumulative arc length. Callers that need it use `sampleElement`.
    s: Number.NaN,
    tangent: unitTangent(segment, t),
    normal: unitNormal(segment, t),
    kappa: curvature(segment, t),
  };
}

export type CombScale = "signed-log" | "linear";

export interface CombOptions {
  /** Default `signed-log`, otherwise the nose dominates the whole picture. */
  readonly scale?: CombScale;
  /** UI zoom factor applied to every tooth. Purely visual. */
  readonly gain?: number;
  /**
   * Reference curvature for the logarithmic scale. Defaults to the median of
   * `abs(kappa)` over the given points, which keeps the comb readable across
   * profiles with very different leading edge radii.
   */
  readonly kappaRef?: number;
}

/** One tooth of the curvature comb. */
export interface CombTooth {
  readonly base: Point;
  readonly tip: Point;
  readonly kappa: number;
}

function medianAbs(values: readonly number[]): number {
  const sorted = values.map(Math.abs).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  const mid = sorted.length >> 1;
  const value =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  return value > 0 ? value : 1;
}

/**
 * Build the curvature comb for a sampled curve.
 *
 * Signed-logarithmic scaling:
 * `toothLength = gain * sign(kappa) * log1p(abs(kappa) / kappaRef)`.
 *
 * Teeth point along the NEGATIVE curve normal, so that positive curvature
 * draws them away from a convex body, which is what every curvature comb
 * does. A sign change in `kappa` flips the tooth to the other side, and
 * that flip is exactly what makes an inflection visible.
 */
export function buildComb(
  points: readonly CurvePoint[],
  options: CombOptions = {},
): CombTooth[] {
  const scale = options.scale ?? "signed-log";
  const gain = options.gain ?? 1;
  const kappaRef = options.kappaRef ?? medianAbs(points.map((p) => p.kappa));

  return points.map((p) => {
    const magnitude =
      scale === "linear" ? p.kappa : Math.sign(p.kappa) * Math.log1p(Math.abs(p.kappa) / kappaRef);
    const toothLength = gain * magnitude;
    return {
      base: p.point,
      tip: addScaled(p.point, p.normal, -toothLength),
      kappa: p.kappa,
    };
  });
}

/** A place where the curvature changes sign, which the UI marks as a warning. */
export interface InflectionMarker {
  readonly point: Point;
  readonly s: number;
  readonly kappaBefore: number;
  readonly kappaAfter: number;
  /** True when the marker lies on the suction side, which is the case that matters. */
  readonly onSuctionSide: boolean;
}

/**
 * Find curvature sign changes along a sampled curve.
 *
 * The suction side is everything after the leading edge in traversal order,
 * because the chain runs pressure side first. Exact zeros are skipped: a
 * curvature that touches zero without crossing is a flat spot, not an
 * inflection.
 *
 * `minKappa` suppresses crossings between two negligible curvatures. The
 * default of 1e-3 corresponds to a radius of 1000 chords, which is straight
 * for every purpose this tool serves; a sign change between two values that
 * small is round-off or a prescribed `R = Infinity` anchor, and marking it
 * would bury the one inflection that matters under a row of false ones.
 */
export function findInflections(
  points: readonly CurvePoint[],
  leadingEdgeSegment: number,
  minKappa = 1e-3,
): InflectionMarker[] {
  const markers: InflectionMarker[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1] as CurvePoint;
    const b = points[i] as CurvePoint;
    if (a.kappa === 0 || b.kappa === 0) continue;
    if (Math.abs(a.kappa) < minKappa && Math.abs(b.kappa) < minKappa) continue;
    if (Math.sign(a.kappa) === Math.sign(b.kappa)) continue;
    // Linear interpolation of the crossing point is enough for a marker:
    // it is a visual cue, not a measurement.
    const w = Math.abs(a.kappa) / (Math.abs(a.kappa) + Math.abs(b.kappa));
    markers.push({
      point: {
        x: a.point.x + (b.point.x - a.point.x) * w,
        y: a.point.y + (b.point.y - a.point.y) * w,
      },
      s: a.s + (b.s - a.s) * w,
      kappaBefore: a.kappa,
      kappaAfter: b.kappa,
      onSuctionSide: b.segment >= leadingEdgeSegment,
    });
  }
  return markers;
}

/**
 * Whether a sampled point lies on the outside of the contour, relative to a
 * reference direction. Used by the comb renderer to decide which way to
 * draw the labels; kept here because it needs the same normal convention.
 */
export function facesOutward(p: CurvePoint, outward: Point): boolean {
  return dot(p.normal, outward) > 0;
}
