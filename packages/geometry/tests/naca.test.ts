import { describe, expect, it } from "vitest";
import {
  nacaCamber,
  nacaCamberSlope,
  nacaCoordinates,
  nacaLeadingEdgeRadius,
  nacaThickness,
  parseNaca4,
} from "../src/index.js";
import { expectClose } from "./helpers.js";

describe("parseNaca4", () => {
  it("reads the three parameters out of the code", () => {
    expect(parseNaca4("2412")).toEqual({
      maxCamber: 0.02,
      camberPosition: 0.4,
      thickness: 0.12,
    });
    expect(parseNaca4("0012")).toEqual({
      maxCamber: 0,
      camberPosition: 0,
      thickness: 0.12,
    });
  });

  it("rejects anything that is not four digits", () => {
    expect(() => parseNaca4("241")).toThrowError(/GEOM_INVALID_NUMBER/);
    expect(() => parseNaca4("24a2")).toThrowError(/GEOM_INVALID_NUMBER/);
  });
});

describe("nacaThickness", () => {
  it("is zero at the nose", () => {
    expectClose(nacaThickness(0, 0.12), 0, 0);
  });

  it("closes at the trailing edge with the closed-edge coefficient", () => {
    // 1e-16: the closed coefficients are chosen so the five terms cancel at
    // x = 1; what is left is the round-off of that sum.
    expectClose(nacaThickness(1, 0.12, true), 0, 1e-16);
    // The open form leaves the published finite thickness there.
    expect(Math.abs(nacaThickness(1, 0.12, false))).toBeGreaterThan(1e-4);
  });

  it("reaches the nominal half thickness near x = 0.3", () => {
    // The NACA 4-digit maximum thickness sits at x = 0.3 by construction.
    const half = nacaThickness(0.3, 0.12);
    // 1e-3 absolute: the published distribution peaks at 0.0600 for t=0.12,
    // to the four decimals the coefficients themselves carry.
    expectClose(half, 0.06, 1e-3);
  });
});

describe("nacaCamber", () => {
  it("is zero everywhere for a symmetric profile", () => {
    for (let i = 0; i <= 10; i += 1) {
      expectClose(nacaCamber(i / 10, parseNaca4("0012")), 0, 0);
    }
  });

  it("peaks at the camber position with the nominal value", () => {
    const spec = parseNaca4("2412");
    // 1e-15: at x = p both branches reduce to m exactly.
    expectClose(nacaCamber(spec.camberPosition, spec), spec.maxCamber, 1e-15);
    expectClose(nacaCamberSlope(spec.camberPosition, spec), 0, 1e-15);
  });

  it("is continuous across the camber position", () => {
    const spec = parseNaca4("4412");
    const eps = 1e-9;
    const p = spec.camberPosition;
    expectClose(nacaCamber(p - eps, spec), nacaCamber(p + eps, spec), 1e-12);
    expectClose(nacaCamberSlope(p - eps, spec), nacaCamberSlope(p + eps, spec), 1e-8);
  });
});

describe("nacaLeadingEdgeRadius", () => {
  it("follows 1.1019 t squared", () => {
    expectClose(nacaLeadingEdgeRadius(0.12), 1.1019 * 0.0144, 1e-15);
  });
});

describe("nacaCoordinates", () => {
  it("returns 2n-1 points in chain order, pressure side first", () => {
    const points = nacaCoordinates(parseNaca4("2412"), 50);
    expect(points.length).toBe(99);
    // The chain starts at the trailing edge, runs to the nose, and comes
    // back out: x falls, then rises.
    expectClose(points[0]!.x, 1, 1e-12);
    expectClose(points[49]!.x, 0, 1e-12);
    expectClose(points[98]!.x, 1, 1e-12);
    // Pressure side first means the first half sits below the camber line.
    expect(points[25]!.y).toBeLessThan(points[73]!.y);
  });

  it("rejects a point count below 3", () => {
    expect(() => nacaCoordinates(parseNaca4("0012"), 2)).toThrowError(RangeError);
  });
});
