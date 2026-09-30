/** Minimal 2D vector helpers. Every function is pure and allocates a new point. */

import type { Point } from "./types.js";

export function point(x: number, y: number): Point {
  return { x, y };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k };
}

/** `a + k * b`. The workhorse of the control point construction. */
export function addScaled(a: Point, b: Point, k: number): Point {
  return { x: a.x + b.x * k, y: a.y + b.y * k };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** The z component of the 3D cross product. Positive when `b` is to the left of `a`. */
export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

export function length(a: Point): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Unit vector. Returns `(0, 0)` for the zero vector rather than NaN. */
export function normalize(a: Point): Point {
  const len = Math.hypot(a.x, a.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

/** Rotation by +90 degrees. For the curve normal use `curveNormal` below. */
export function perp(a: Point): Point {
  return { x: -a.y, y: a.x };
}

export function fromAngle(angle: number): Point {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function rotate(a: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Shortest distance from `p` to the segment `a`-`b`, plus the closest point.
 * Used by the gap computation, which works on sampled polylines.
 */
export function distanceToSegment(
  p: Point,
  a: Point,
  b: Point,
): { distance: number; closest: Point } {
  const ab = sub(b, a);
  const lengthSquared = dot(ab, ab);
  if (lengthSquared === 0) return { distance: distance(p, a), closest: a };
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / lengthSquared));
  const closest = addScaled(a, ab, t);
  return { distance: distance(p, closest), closest };
}

/**
 * The curve normal: the tangent rotated by -90 degrees, so it points to the
 * RIGHT of the direction of travel.
 *
 * This is the convention the whole package uses, and it is not arbitrary.
 * The chain runs from the trailing edge on the pressure side, over the
 * nose, to the trailing edge on the suction side, which traverses a convex
 * profile clockwise. With the normal to the right of travel, a convex
 * profile has positive curvature everywhere, so `R` at the nose is the
 * plain positive radius a user expects to type. With the other convention
 * every radius in a normal profile would be negative.
 */
export function curveNormal(tangent: Point): Point {
  return { x: tangent.y, y: -tangent.x };
}
