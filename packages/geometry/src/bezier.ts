/**
 * Bezier segment evaluation and analytic differential geometry.
 *
 * Curvature comes from the analytic derivatives, never from finite
 * differences of sampled points (golden rule G9). Finite differences hide
 * exactly the discontinuities this tool exists to reveal.
 */

import { MIN_SPEED } from "./constants.js";
import { GeometryError } from "./errors.js";
import type { BezierSegment, Point } from "./types.js";
import { cross, curveNormal, length, normalize } from "./vec.js";

/** Degree of a segment: one less than its control point count. */
export function degree(segment: BezierSegment): number {
  return segment.points.length - 1;
}

function controlPoints(segment: BezierSegment): readonly Point[] {
  const { points } = segment;
  if (points.length < 2) {
    throw new GeometryError("GEOM_DEGREE_TOO_LOW", "a segment needs at least 2 control points", {
      count: points.length,
    });
  }
  return points;
}

/**
 * Evaluate the segment at parameter `t` in [0, 1] by de Casteljau.
 *
 * De Casteljau rather than the Bernstein sum because it is numerically
 * stable at the high degrees the configurable segment degree allows.
 * Values of `t` outside [0, 1] extrapolate; nothing here clamps them,
 * because the sampler relies on exact endpoints.
 */
export function evaluate(segment: BezierSegment, t: number): Point {
  const points = controlPoints(segment);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  for (let k = 1; k < points.length; k += 1) {
    for (let i = 0; i < points.length - k; i += 1) {
      xs[i] = (xs[i] as number) * (1 - t) + (xs[i + 1] as number) * t;
      ys[i] = (ys[i] as number) * (1 - t) + (ys[i + 1] as number) * t;
    }
  }
  return { x: xs[0] as number, y: ys[0] as number };
}

/**
 * Control polygon of the derivative curve: `n * (P[i+1] - P[i])`.
 *
 * Returns a degree-0 segment at the origin for a single-point input, so that
 * repeated differentiation terminates instead of throwing.
 */
export function derivativeSegment(segment: BezierSegment): BezierSegment {
  const points = segment.points;
  const n = points.length - 1;
  if (n < 1) return { points: [{ x: 0, y: 0 }] };
  const out: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    out.push({ x: n * (b.x - a.x), y: n * (b.y - a.y) });
  }
  return { points: out };
}

/** First derivative with respect to `t`. Not a unit vector. */
export function firstDerivative(segment: BezierSegment, t: number): Point {
  return evaluate(derivativeSegment(segment), t);
}

/** Second derivative with respect to `t`. */
export function secondDerivative(segment: BezierSegment, t: number): Point {
  return evaluate(derivativeSegment(derivativeSegment(segment)), t);
}

/**
 * Signed curvature at `t`.
 *
 * `kappa = (y' x'' - x' y'') / (x'^2 + y'^2)^(3/2)`. Positive means the
 * curve bends towards the curve normal, which is the tangent rotated by
 * -90 degrees, so a convex profile traversed in chain order has positive
 * curvature everywhere and `R` is a plain positive radius. See
 * `curveNormal` in vec.ts for why the sign is that way round.
 *
 * Returns 0 where the speed drops below `MIN_SPEED`. That is a genuine
 * degeneracy (a cusp or a repeated control point), and reporting 0 rather
 * than Infinity keeps the comb finite; the chain builder is the place that
 * refuses to create such a segment in the first place.
 */
export function curvature(segment: BezierSegment, t: number): number {
  const d1 = firstDerivative(segment, t);
  const d2 = secondDerivative(segment, t);
  const speed = length(d1);
  if (speed < MIN_SPEED) return 0;
  return -cross(d1, d2) / (speed * speed * speed);
}

/** Unit tangent, the direction of travel. `(0, 0)` at a degenerate point. */
export function unitTangent(segment: BezierSegment, t: number): Point {
  return normalize(firstDerivative(segment, t));
}

/** Unit curve normal: the unit tangent rotated by -90 degrees. */
export function unitNormal(segment: BezierSegment, t: number): Point {
  return curveNormal(unitTangent(segment, t));
}

/**
 * Arc length of the whole segment, by 8-point Gauss-Legendre on `n`
 * sub-intervals.
 *
 * 8-point Gauss-Legendre is exact for polynomials up to degree 15. The
 * integrand here is a square root, not a polynomial, so it is not exact;
 * with the default 16 sub-intervals the error on a unit-scale segment stays
 * below 1e-12, which is well under every tolerance in
 * docs/spec/07-testing.md.
 */
export function arcLength(segment: BezierSegment, subdivisions = 16): number {
  const derivative = derivativeSegment(segment);
  const half = 1 / (2 * subdivisions);
  let total = 0;
  for (let i = 0; i < subdivisions; i += 1) {
    const mid = (i + 0.5) / subdivisions;
    for (let g = 0; g < GAUSS_NODES.length; g += 1) {
      const t = mid + half * (GAUSS_NODES[g] as number);
      total += (GAUSS_WEIGHTS[g] as number) * length(evaluate(derivative, t));
    }
  }
  return total * half;
}

/** 8-point Gauss-Legendre nodes on [-1, 1]. */
const GAUSS_NODES: readonly number[] = [
  -0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498,
  0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363,
];

/** The matching weights. They sum to 2. */
const GAUSS_WEIGHTS: readonly number[] = [
  0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];
