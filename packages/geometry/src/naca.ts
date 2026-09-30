/**
 * Analytic NACA 4-digit profiles.
 *
 * They are here for two reasons: they are the reference the golden fit
 * tests measure against (docs/spec/07-testing.md), and they are the
 * cheapest source of sensible presets. Everything is closed form, so a test
 * comparing against them is comparing against maths, not against a previous
 * run of this code.
 */

import { GeometryError } from "./errors.js";
import type { Point } from "./types.js";

export interface Naca4 {
  /** Maximum camber as a fraction of chord. */
  readonly maxCamber: number;
  /** Chordwise position of the maximum camber, as a fraction of chord. */
  readonly camberPosition: number;
  /** Maximum thickness as a fraction of chord. */
  readonly thickness: number;
}

/** Parse a four-character code such as `2412` or `0012`. */
export function parseNaca4(code: string): Naca4 {
  if (!/^\d{4}$/.test(code)) {
    throw new GeometryError("GEOM_INVALID_NUMBER", "a NACA 4-digit code is four digits", {
      code,
    });
  }
  return {
    maxCamber: Number(code.slice(0, 1)) / 100,
    camberPosition: Number(code.slice(1, 2)) / 10,
    thickness: Number(code.slice(2, 4)) / 100,
  };
}

/**
 * The standard thickness distribution.
 *
 * `closedTrailingEdge` swaps the last coefficient from -0.1015 to -0.1036,
 * which is the usual modification that brings the thickness to exactly zero
 * at `x = 1`. Default is closed, because an open trailing edge here would
 * fight the `teThickness` parameter of the element model.
 */
export function nacaThickness(x: number, thickness: number, closedTrailingEdge = true): number {
  const lastCoefficient = closedTrailingEdge ? -0.1036 : -0.1015;
  return (
    5 *
    thickness *
    (0.2969 * Math.sqrt(x) -
      0.126 * x -
      0.3516 * x * x +
      0.2843 * x * x * x +
      lastCoefficient * x * x * x * x)
  );
}

/** Camber line ordinate. Zero everywhere for a symmetric profile. */
export function nacaCamber(x: number, spec: Naca4): number {
  const { maxCamber: m, camberPosition: p } = spec;
  if (m === 0 || p === 0) return 0;
  if (x < p) return (m / (p * p)) * (2 * p * x - x * x);
  return (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
}

/** Slope of the camber line. */
export function nacaCamberSlope(x: number, spec: Naca4): number {
  const { maxCamber: m, camberPosition: p } = spec;
  if (m === 0 || p === 0) return 0;
  if (x < p) return ((2 * m) / (p * p)) * (p - x);
  return ((2 * m) / ((1 - p) * (1 - p))) * (p - x);
}

/**
 * Leading edge radius of a NACA 4-digit profile: `1.1019 * t^2`.
 *
 * Used as the starting estimate for a fit, and as the `leRadius` of a
 * preset built from a code.
 */
export function nacaLeadingEdgeRadius(thickness: number): number {
  return 1.1019 * thickness * thickness;
}

/**
 * Coordinates in chain order: trailing edge pressure side, over the nose,
 * to the trailing edge suction side.
 *
 * `count` is the number of points per surface, so the result has
 * `2 * count - 1` points; the leading edge is shared. Chordwise positions
 * use cosine spacing, which is what every published table does and what
 * makes the nose resolvable at all.
 */
export function nacaCoordinates(spec: Naca4, count = 100, closedTrailingEdge = true): Point[] {
  if (!Number.isInteger(count) || count < 3) {
    throw new RangeError("count must be an integer >= 3");
  }
  const upper: Point[] = [];
  const lower: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const beta = (Math.PI * i) / (count - 1);
    const x = (1 - Math.cos(beta)) / 2;
    const yt = nacaThickness(x, spec.thickness, closedTrailingEdge);
    const yc = nacaCamber(x, spec);
    const theta = Math.atan(nacaCamberSlope(x, spec));
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    upper.push({ x: x - yt * sin, y: yc + yt * cos });
    lower.push({ x: x + yt * sin, y: yc - yt * cos });
  }
  // Chain order: the pressure (lower) surface from the trailing edge to the
  // nose, then the suction (upper) surface back out.
  const chain: Point[] = [];
  for (let i = count - 1; i >= 0; i -= 1) chain.push(lower[i] as Point);
  for (let i = 1; i < count; i += 1) chain.push(upper[i] as Point);
  return chain;
}

/**
 * Trailing edge wedge angle of a NACA 4-digit profile, in radians.
 *
 * Computed from the analytic slopes at `x = 1` rather than from a
 * difference of the last two coordinates, which would depend on the point
 * count.
 */
export function nacaWedgeAngle(spec: Naca4, closedTrailingEdge = true): number {
  const eps = 1e-6;
  const x = 1 - eps;
  const ytHere = nacaThickness(x, spec.thickness, closedTrailingEdge);
  const ytEnd = nacaThickness(1, spec.thickness, closedTrailingEdge);
  const dyt = (ytEnd - ytHere) / eps;
  const dyc = nacaCamberSlope(1, spec);
  const upperSlope = dyc + dyt;
  const lowerSlope = dyc - dyt;
  return Math.atan(lowerSlope) - Math.atan(upperSlope);
}

/** Mean of the two trailing edge tangents, in radians. */
export function nacaDepartureAngle(spec: Naca4, closedTrailingEdge = true): number {
  const eps = 1e-6;
  const x = 1 - eps;
  const ytHere = nacaThickness(x, spec.thickness, closedTrailingEdge);
  const ytEnd = nacaThickness(1, spec.thickness, closedTrailingEdge);
  const dyt = (ytEnd - ytHere) / eps;
  const dyc = nacaCamberSlope(1, spec);
  return (Math.atan(dyc - dyt) + Math.atan(dyc + dyt)) / 2;
}
