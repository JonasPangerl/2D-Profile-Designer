/**
 * Placement: mapping a chord-normalised shape into the world, and the gap
 * and overlap between neighbouring elements.
 *
 * Placement is strictly separate from shape (docs/spec/01-geometry.md 1.4).
 * A profile can be scaled or rotated without touching a single anchor.
 */

import type { GapOverlap, Placement, Point } from "./types.js";
import {
  addScaled,
  curveNormal,
  distanceToSegment,
  dot,
  fromAngle,
  rotate,
  scale,
  sub,
} from "./vec.js";

/**
 * Map a chord-normalised point into world coordinates.
 *
 * `p_world = le + rotate(chordAngle) * (p_norm * chord)`. The leading edge
 * of the normalised shape sits at the origin by convention, so
 * `placement.le` is where it lands.
 */
export function toWorld(p: Point, placement: Placement): Point {
  const scaled = scale(p, placement.chord);
  const rotated = rotate(scaled, placement.chordAngle);
  return { x: placement.le.x + rotated.x, y: placement.le.y + rotated.y };
}

/** The inverse of `toWorld`. */
export function toLocal(p: Point, placement: Placement): Point {
  const shifted = sub(p, placement.le);
  const rotated = rotate(shifted, -placement.chordAngle);
  return scale(rotated, 1 / placement.chord);
}

/** Map a whole contour. */
export function contourToWorld(points: readonly Point[], placement: Placement): Point[] {
  return points.map((p) => toWorld(p, placement));
}

/** World position of the trailing edge midpoint of a placed element. */
export function trailingEdgePoint(placement: Placement): Point {
  return toWorld({ x: 1, y: 0 }, placement);
}

/**
 * Gap and overlap of `element` relative to the element in front of it.
 *
 * Both contours are given as world-space polylines, which is what the
 * sampler produces after `contourToWorld`.
 *
 * - **Gap** is the shortest distance between the two contours. It is
 *   computed point-to-segment in both directions, because a point-to-point
 *   minimum over two polylines overestimates the gap whenever the sampling
 *   is coarse on one side.
 * - **Overlap** is measured along the preceding element's chord direction,
 *   from that element's trailing edge to this element's leading edge.
 *   Positive means this element's leading edge sits upstream of the
 *   preceding trailing edge, which is the usual sign convention.
 *
 * Both are returned in physical units and as a fraction of the preceding
 * element's chord, because practitioners use both.
 */
export function gapAndOverlap(
  contour: readonly Point[],
  placement: Placement,
  frontContour: readonly Point[],
  frontPlacement: Placement,
): GapOverlap {
  if (contour.length < 2 || frontContour.length < 2) {
    throw new RangeError("both contours need at least two points");
  }

  let best = Number.POSITIVE_INFINITY;
  let bestFrom: Point = contour[0] as Point;
  let bestTo: Point = frontContour[0] as Point;

  const consider = (p: Point, a: Point, b: Point, flipped: boolean): void => {
    const hit = distanceToSegment(p, a, b);
    if (hit.distance >= best) return;
    best = hit.distance;
    bestFrom = flipped ? hit.closest : p;
    bestTo = flipped ? p : hit.closest;
  };

  for (const p of contour) {
    for (let i = 1; i < frontContour.length; i += 1) {
      consider(p, frontContour[i - 1] as Point, frontContour[i] as Point, false);
    }
  }
  for (const p of frontContour) {
    for (let i = 1; i < contour.length; i += 1) {
      consider(p, contour[i - 1] as Point, contour[i] as Point, true);
    }
  }

  const frontChordDirection = fromAngle(frontPlacement.chordAngle);
  const frontTe = trailingEdgePoint(frontPlacement);
  const overlap = -dot(sub(placement.le, frontTe), frontChordDirection);

  return {
    gap: best,
    gapFraction: best / frontPlacement.chord,
    overlap,
    overlapFraction: overlap / frontPlacement.chord,
    gapFrom: bestFrom,
    gapTo: bestTo,
  };
}

/**
 * Mirror a world-space contour at the ground plane `y = 0`.
 *
 * Phase 2 uses the image method for ground effect. It lives here because it
 * is placement, not shape, and because having it now keeps the ride-height
 * plumbing honest from the start.
 */
export function mirrorAtGround(points: readonly Point[]): Point[] {
  return points.map((p) => ({ x: p.x, y: -p.y }));
}

/** Offset a contour along its own normals. Used for the ghost reference outline. */
export function offsetContour(points: readonly Point[], amount: number): Point[] {
  return points.map((p, i) => {
    const previous = points[Math.max(i - 1, 0)] as Point;
    const next = points[Math.min(i + 1, points.length - 1)] as Point;
    const direction = sub(next, previous);
    const len = Math.hypot(direction.x, direction.y);
    if (len === 0) return p;
    const normal = curveNormal({ x: direction.x / len, y: direction.y / len });
    return addScaled(p, normal, amount);
  });
}
