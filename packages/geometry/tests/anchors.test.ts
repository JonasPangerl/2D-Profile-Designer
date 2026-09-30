import { describe, expect, it } from "vitest";
import {
  buildSegment,
  curvature,
  evaluate,
  offsetFromRadius,
  radiusFromOffset,
  unitTangent,
} from "../src/index.js";
import type { Anchor } from "../src/index.js";
import { expectClose, expectPointClose } from "./helpers.js";

function anchor(overrides: Partial<Anchor> = {}): Anchor {
  return { x: 0, y: 0, phi: 0, R: Infinity, Lin: 0.2, Lout: 0.2, ...overrides };
}

describe("offsetFromRadius and radiusFromOffset", () => {
  it("invert each other", () => {
    for (const n of [4, 5, 6, 7, 8]) {
      for (const L of [0.05, 0.2, 1.3]) {
        for (const R of [0.01, 0.5, 12]) {
          const h = offsetFromRadius(n, L, R);
          // 1e-12 relative: two multiplications and a division round trip.
          expectClose(radiusFromOffset(n, L, h), R, 0, 1e-12);
        }
      }
    }
  });

  it("maps an infinite radius to a zero offset and back", () => {
    expect(offsetFromRadius(4, 0.3, Infinity)).toBe(0);
    expect(radiusFromOffset(4, 0.3, 0)).toBe(Infinity);
  });

  it("rejects a sharp corner", () => {
    expect(() => offsetFromRadius(4, 0.3, 0)).toThrowError(/GEOM_SHARP_CORNER_UNSUPPORTED/);
  });
});

describe("buildSegment", () => {
  it("reproduces the requested curvature at both ends, for degrees 4 to 8", () => {
    const start = anchor({ x: 0, y: 0, phi: 0.3, R: 0.4, Lout: 0.25 });
    const end = anchor({ x: 1, y: 0.2, phi: -0.2, R: 1.6, Lin: 0.3 });
    for (let n = 4; n <= 8; n += 1) {
      const segment = buildSegment(start, end, n);
      expect(segment.points.length).toBe(n + 1);
      // 1e-9 relative, per docs/spec/07-testing.md: the curvature formula
      // divides by a cubed length, so it loses about three digits.
      expectClose(curvature(segment, 0), 1 / start.R, 0, 1e-9);
      expectClose(curvature(segment, 1), 1 / end.R, 0, 1e-9);
    }
  });

  it("reproduces the anchor positions and tangents exactly", () => {
    const start = anchor({ x: 0.1, y: -0.05, phi: 2.9, R: 0.7, Lout: 0.2 });
    const end = anchor({ x: 0.9, y: 0.12, phi: 0.4, R: Infinity, Lin: 0.2 });
    for (let n = 4; n <= 8; n += 1) {
      const segment = buildSegment(start, end, n);
      expectPointClose(evaluate(segment, 0), { x: start.x, y: start.y }, 1e-15);
      expectPointClose(evaluate(segment, 1), { x: end.x, y: end.y }, 1e-15);
      const t0 = unitTangent(segment, 0);
      expectClose(t0.x, Math.cos(start.phi), 1e-12);
      expectClose(t0.y, Math.sin(start.phi), 1e-12);
      const t1 = unitTangent(segment, 1);
      expectClose(t1.x, Math.cos(end.phi), 1e-12);
      expectClose(t1.y, Math.sin(end.phi), 1e-12);
    }
  });

  it("gives zero curvature where the radius is infinite", () => {
    const start = anchor({ x: 0, y: 0, phi: 0, R: Infinity, Lout: 0.3 });
    const end = anchor({ x: 1, y: 0.3, phi: 0.5, R: 2, Lin: 0.3 });
    for (let n = 4; n <= 8; n += 1) {
      const segment = buildSegment(start, end, n);
      expectClose(curvature(segment, 0), 0, 1e-12);
    }
  });

  it("rejects a degree below 4", () => {
    expect(() => buildSegment(anchor(), anchor({ x: 1 }), 3)).toThrowError(
      /GEOM_DEGREE_TOO_LOW/,
    );
  });

  it("rejects a collapsed arm", () => {
    expect(() => buildSegment(anchor({ Lout: 0 }), anchor({ x: 1 }), 4)).toThrowError(
      /GEOM_ZERO_ARM/,
    );
    expect(() => buildSegment(anchor(), anchor({ x: 1, Lin: 0 }), 4)).toThrowError(
      /GEOM_ZERO_ARM/,
    );
  });

  it("reports a degenerate degree-4 segment instead of drawing something wrong", () => {
    // Parallel tangents at both ends leave the two curvature lines parallel,
    // so no P2 satisfies both conditions.
    const start = anchor({ x: 0, y: 0, phi: 0, R: 1, Lout: 0.2 });
    const end = anchor({ x: 1, y: 0, phi: 0, R: 1, Lin: 0.2 });
    expect(() => buildSegment(start, end, 4)).toThrowError(/GEOM_DEGENERATE_SEGMENT/);
    // Degree 5 has room for both conditions, so it must still work.
    expect(() => buildSegment(start, end, 5)).not.toThrow();
  });
});
