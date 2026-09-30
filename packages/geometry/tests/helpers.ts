/**
 * Test helpers.
 *
 * Golden rule G3: never compare floats with `===`, and every tolerance
 * carries its reason at the call site.
 */

import { expect } from "vitest";
import type { Point } from "../src/index.js";

/** Assert two numbers are close, with both an absolute and a relative bound. */
export function expectClose(actual: number, expected: number, atol: number, rtol = 0): void {
  const bound = atol + rtol * Math.abs(expected);
  const delta = Math.abs(actual - expected);
  expect(
    delta <= bound,
    `expected ${actual} to be within ${bound} of ${expected} (delta ${delta})`,
  ).toBe(true);
}

/** The same, element by element. */
export function expectAllClose(
  actual: readonly number[],
  expected: readonly number[],
  atol: number,
  rtol = 0,
): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    const bound = atol + rtol * Math.abs(expected[i] as number);
    const delta = Math.abs((actual[i] as number) - (expected[i] as number));
    expect(
      delta <= bound,
      `index ${i}: expected ${actual[i]} to be within ${bound} of ${expected[i]} (delta ${delta})`,
    ).toBe(true);
  }
}

export function expectPointClose(actual: Point, expected: Point, atol: number): void {
  expectClose(actual.x, expected.x, atol);
  expectClose(actual.y, expected.y, atol);
}

/**
 * A degree-`n` Bezier approximating a circular arc of radius `radius`,
 * centred at the origin, from angle 0 to `sweep`.
 *
 * Built by raising the degree of the standard cubic arc approximation. It is
 * exact in position and tangent at both endpoints, and close in arc length,
 * but it is NOT exact in curvature: for a 45 degree sweep the endpoint
 * curvature is about 0.14 percent low. Tests that need an exactly known
 * curvature use `parabolaSegment` instead.
 */
export function circleArcControlPoints(radius: number, sweep: number, n: number): Point[] {
  const k = (4 / 3) * Math.tan(sweep / 4);
  const cubic: Point[] = [
    { x: radius, y: 0 },
    { x: radius, y: radius * k },
    {
      x: radius * (Math.cos(sweep) + k * Math.sin(sweep)),
      y: radius * (Math.sin(sweep) - k * Math.cos(sweep)),
    },
    { x: radius * Math.cos(sweep), y: radius * Math.sin(sweep) },
  ];
  let points = cubic;
  while (points.length - 1 < n) points = elevateDegree(points);
  return points;
}

/** Exact degree elevation of a Bezier control polygon. */
export function elevateDegree(points: readonly Point[]): Point[] {
  const n = points.length - 1;
  const out: Point[] = [points[0] as Point];
  for (let i = 1; i <= n; i += 1) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const w = i / (n + 1);
    out.push({ x: w * a.x + (1 - w) * b.x, y: w * a.y + (1 - w) * b.y });
  }
  out.push(points[n] as Point);
  return out;
}

/**
 * A Bezier that traces the parabola `y = a * x^2` over `x` in [-1, 1],
 * raised to degree `n`.
 *
 * The quadratic Bezier with control points `(-1, a)`, `(0, -a)`, `(1, a)`
 * is exactly that parabola: `x = 2t - 1` and `y = a * (1 - 2t)^2`. Degree
 * elevation is an exact identity, so the curve stays the same parabola at
 * any degree. That makes it an independent analytic reference for the
 * curvature formula: no part of the production code is involved in knowing
 * what the answer should be.
 */
export function parabolaSegment(a: number, n: number): Point[] {
  let points: Point[] = [
    { x: -1, y: a },
    { x: 0, y: -a },
    { x: 1, y: a },
  ];
  while (points.length - 1 < n) points = elevateDegree(points);
  return points;
}

/**
 * Analytic signed curvature of `y = a * x^2` at `x`, in this package's sign
 * convention.
 *
 * Textbook curvature of a graph is `y'' / (1 + y'^2)^(3/2)`, which is
 * positive for an upward-opening parabola because it measures the bend
 * towards the LEFT of travel. The curve normal here points to the right, so
 * the sign flips.
 */
export function parabolaCurvature(a: number, x: number): number {
  const slope = 2 * a * x;
  return -(2 * a) / Math.pow(1 + slope * slope, 1.5);
}
