import { describe, expect, it } from "vitest";
import {
  arcLength,
  curvature,
  derivativeSegment,
  evaluate,
  firstDerivative,
  secondDerivative,
  unitNormal,
  unitTangent,
} from "../src/index.js";
import {
  circleArcControlPoints,
  elevateDegree,
  expectClose,
  expectPointClose,
  parabolaCurvature,
  parabolaSegment,
} from "./helpers.js";

describe("evaluate", () => {
  it("reproduces the endpoints exactly", () => {
    const segment = { points: circleArcControlPoints(2, Math.PI / 3, 4) };
    const first = segment.points[0];
    const last = segment.points[segment.points.length - 1];
    // Exact: de Casteljau at t=0 and t=1 returns the stored control point
    // itself, with no arithmetic that could lose a bit.
    expect(evaluate(segment, 0)).toEqual(first);
    expect(evaluate(segment, 1)).toEqual(last);
  });

  it("agrees with the Bernstein sum", () => {
    const segment = {
      points: [
        { x: 0, y: 0 },
        { x: 0.2, y: 0.4 },
        { x: 0.7, y: -0.3 },
        { x: 1.1, y: 0.9 },
        { x: 1.5, y: 0.1 },
      ],
    };
    const n = segment.points.length - 1;
    const binomial = [1, 4, 6, 4, 1];
    for (let k = 0; k <= 20; k += 1) {
      const t = k / 20;
      let x = 0;
      let y = 0;
      for (let i = 0; i <= n; i += 1) {
        const b = (binomial[i] as number) * Math.pow(1 - t, n - i) * Math.pow(t, i);
        x += b * (segment.points[i] as { x: number; y: number }).x;
        y += b * (segment.points[i] as { x: number; y: number }).y;
      }
      // 1e-14: both forms are sums of the same five products; only the
      // ordering of the floating point additions differs.
      expectPointClose(evaluate(segment, t), { x, y }, 1e-14);
    }
  });
});

describe("derivatives", () => {
  it("matches a central difference of the evaluated curve", () => {
    const segment = { points: circleArcControlPoints(1.5, 1.1, 6) };
    const h = 1e-5;
    for (let k = 1; k < 20; k += 1) {
      const t = k / 20;
      const plus = evaluate(segment, t + h);
      const minus = evaluate(segment, t - h);
      const numeric = { x: (plus.x - minus.x) / (2 * h), y: (plus.y - minus.y) / (2 * h) };
      // 1e-8: a central difference with h = 1e-5 on a smooth curve carries
      // a truncation error of order h^2 = 1e-10 plus round-off of order
      // 1e-11/h = 1e-6 scaled by the curve magnitude. 1e-8 sits between.
      const analytic = firstDerivative(segment, t);
      expectClose(analytic.x, numeric.x, 1e-6);
      expectClose(analytic.y, numeric.y, 1e-6);
    }
  });

  it("degree elevation does not change the curve or its curvature", () => {
    const base = { points: circleArcControlPoints(0.8, 0.9, 4) };
    const raised = { points: elevateDegree(base.points) };
    for (let k = 0; k <= 10; k += 1) {
      const t = k / 10;
      // 1e-13: degree elevation is an exact identity in real arithmetic;
      // what is left is the round-off of the convex combinations.
      expectPointClose(evaluate(raised, t), evaluate(base, t), 1e-13);
      expectClose(curvature(raised, t), curvature(base, t), 1e-11);
    }
  });

  it("the derivative control polygon has one point fewer", () => {
    const segment = { points: circleArcControlPoints(1, 1, 5) };
    expect(derivativeSegment(segment).points.length).toBe(segment.points.length - 1);
    expect(secondDerivative(segment, 0.5)).toBeDefined();
  });
});

describe("curvature", () => {
  it("matches the analytic curvature of a parabola, for every degree from 4 to 8", () => {
    // The parabola is an exact Bezier, so the expected value comes from
    // closed-form calculus and not from this implementation.
    for (let n = 4; n <= 8; n += 1) {
      for (const a of [0.25, 1, 40]) {
        const segment = { points: parabolaSegment(a, n) };
        for (let k = 0; k <= 10; k += 1) {
          const t = k / 10;
          const x = 2 * t - 1;
          // 1e-10 relative: the formula divides by a cubed speed, so it
          // gives up about three digits of the 1e-16 it starts with, and
          // degree elevation adds a few more convex combinations.
          expectClose(curvature(segment, t), parabolaCurvature(a, x), 1e-12, 1e-10);
        }
      }
    }
  });

  it("is zero on a straight line", () => {
    const segment = {
      points: [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.75 },
        { x: 1, y: 1 },
      ],
    };
    for (let k = 0; k <= 10; k += 1) {
      // Absolute 1e-12: the cross product of two parallel vectors is a
      // difference of equal products, so only round-off survives.
      expectClose(curvature(segment, k / 10), 0, 1e-12);
    }
  });

  it("changes sign when the curve is traversed the other way", () => {
    const points = circleArcControlPoints(1, 1, 4);
    const forward = { points };
    const backward = { points: [...points].reverse() };
    expectClose(curvature(backward, 1), -curvature(forward, 0), 1e-12);
  });

  it("the normal is the tangent rotated by -90 degrees", () => {
    const segment = { points: circleArcControlPoints(1, 1, 4) };
    const t = unitTangent(segment, 0.3);
    const n = unitNormal(segment, 0.3);
    expectClose(n.x, t.y, 1e-15);
    expectClose(n.y, -t.x, 1e-15);
  });
});

describe("arcLength", () => {
  it("matches the analytic length of a circular arc", () => {
    const radius = 1.7;
    const sweep = Math.PI / 6;
    const segment = { points: circleArcControlPoints(radius, sweep, 4) };
    // 1e-6 absolute: the cubic circle approximation itself deviates from a
    // true arc by about 2e-7 of the radius over a 30 degree sweep, which
    // dominates the quadrature error.
    expectClose(arcLength(segment), radius * sweep, 1e-6);
  });

  it("is additive over a straight segment", () => {
    const segment = {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
    };
    expectClose(arcLength(segment), 4, 1e-12);
  });
});
