/**
 * The G2 construction: anchors to Bezier control polygons.
 *
 * Both segments meeting at an anchor get the same `R` and antiparallel
 * tangents, so G0, G1 and G2 continuity are structural rather than enforced
 * afterwards. See docs/spec/01-geometry.md sections 1.2 and "The tangential
 * part, made explicit".
 */

import { MIN_ARM_LENGTH, MIN_SEGMENT_DEGREE, PARALLEL_EPS } from "./constants.js";
import { GeometryError } from "./errors.js";
import type { Anchor, BezierSegment, Point } from "./types.js";
import { addScaled, cross, curveNormal, fromAngle, lerp, sub } from "./vec.js";

/**
 * Normal offset of the third control point for a given radius.
 *
 * `h = n/(n-1) * L^2 / R`. `R = Infinity` gives `h = 0`, a curvature-free
 * transition. `R = 0` is a sharp corner and is rejected: a single stored
 * `phi` per anchor cannot represent the two tangents a corner needs.
 */
export function offsetFromRadius(n: number, L: number, R: number): number {
  if (R === 0) {
    throw new GeometryError(
      "GEOM_SHARP_CORNER_UNSUPPORTED",
      "R = 0 means a sharp corner, which Phase 1 cannot represent (see BL-07)",
      { n, L },
    );
  }
  if (!Number.isFinite(R)) return 0;
  return ((n / (n - 1)) * (L * L)) / R;
}

/**
 * The inverse of `offsetFromRadius`: `R = n/(n-1) * L^2 / h`.
 *
 * `h = 0` gives `Infinity`, which is the curvature-free transition again.
 */
export function radiusFromOffset(n: number, L: number, h: number): number {
  if (h === 0) return Infinity;
  return ((n / (n - 1)) * (L * L)) / h;
}

function checkArm(L: number, which: string): void {
  if (!Number.isFinite(L) || L < MIN_ARM_LENGTH) {
    throw new GeometryError("GEOM_ZERO_ARM", `${which} arm length must be positive`, { L });
  }
}

/**
 * Build the control polygon of one segment from its two anchors.
 *
 * The curvature at each end depends only on the three control points at that
 * end, so the returned segment reproduces `start.R` at `t = 0` and `end.R`
 * at `t = 1` exactly.
 *
 * Throws `GEOM_DEGREE_TOO_LOW` below degree 4, `GEOM_ZERO_ARM` for a
 * collapsed arm, `GEOM_SHARP_CORNER_UNSUPPORTED` for `R = 0`, and
 * `GEOM_DEGENERATE_SEGMENT` when the degree-4 construction has no solution.
 */
export function buildSegment(start: Anchor, end: Anchor, n: number): BezierSegment {
  if (!Number.isInteger(n) || n < MIN_SEGMENT_DEGREE) {
    throw new GeometryError(
      "GEOM_DEGREE_TOO_LOW",
      `segment degree must be an integer >= ${MIN_SEGMENT_DEGREE}`,
      { n },
    );
  }
  checkArm(start.Lout, "outgoing");
  checkArm(end.Lin, "incoming");

  const p0: Point = { x: start.x, y: start.y };
  const pn: Point = { x: end.x, y: end.y };

  // Direction of travel at each end. The incoming tangent at `end` points
  // forward, so walking back from `pn` uses the negative of it.
  const tStart = fromAngle(start.phi);
  const nStart = curveNormal(tStart);
  const tEnd = fromAngle(end.phi);
  const nEnd = curveNormal(tEnd);

  const hStart = offsetFromRadius(n, start.Lout, start.R);
  const hEnd = offsetFromRadius(n, end.Lin, end.R);

  const p1 = addScaled(p0, tStart, start.Lout);
  const pPrev = addScaled(pn, tEnd, -end.Lin);

  const points: Point[] = new Array<Point>(n + 1);
  points[0] = p0;
  points[1] = p1;
  points[n] = pn;
  points[n - 1] = pPrev;

  if (n === 4) {
    // P2 is shared by both curvature conditions, so it is the intersection
    // of the two admissible lines rather than a free choice.
    const baseA = addScaled(p1, nStart, hStart);
    const baseB = addScaled(pPrev, nEnd, hEnd);
    const denominator = cross(tStart, tEnd);
    if (Math.abs(denominator) < PARALLEL_EPS) {
      throw new GeometryError(
        "GEOM_DEGENERATE_SEGMENT",
        "the two curvature conditions are parallel at degree 4; raise the degree or change a tangent",
        { denominator },
      );
    }
    const a = cross(sub(baseB, baseA), tEnd) / denominator;
    points[2] = addScaled(baseA, tStart, a);
    return { points };
  }

  // Degree >= 5: the two triples do not overlap. The tangential part is the
  // arm length itself, which keeps the control polygon evenly spaced.
  const p2 = addScaled(addScaled(p1, tStart, start.Lout), nStart, hStart);
  const pPrev2 = addScaled(addScaled(pPrev, tEnd, -end.Lin), nEnd, hEnd);
  points[2] = p2;
  points[n - 2] = pPrev2;

  const interiorCount = n - 5;
  for (let k = 0; k < interiorCount; k += 1) {
    const i = 3 + k;
    points[i] = lerp(p2, pPrev2, (i - 2) / (n - 4));
  }

  return { points };
}
