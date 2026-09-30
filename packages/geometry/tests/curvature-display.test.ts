import { describe, expect, it } from "vitest";
import {
  buildComb,
  findInflections,
  ladderElement,
  resolveElement,
  sampleElement,
} from "../src/index.js";
import type { CurvePoint } from "../src/index.js";
import { expectClose } from "./helpers.js";

function fakePoint(kappa: number, x: number): CurvePoint {
  return {
    point: { x, y: 0 },
    segment: 0,
    t: x,
    s: x,
    tangent: { x: 1, y: 0 },
    // The curve normal is the tangent rotated by -90 degrees, so a tangent
    // pointing in +x has a normal pointing in -y. Comb teeth are drawn
    // along the negative normal, so positive curvature points in +y here.
    normal: { x: 0, y: -1 },
    kappa,
  };
}

describe("buildComb", () => {
  it("draws a tooth on the opposite side when the curvature flips sign", () => {
    const teeth = buildComb([fakePoint(5, 0), fakePoint(-5, 1)], { kappaRef: 1 });
    expect(teeth[0]!.tip.y).toBeGreaterThan(0);
    expect(teeth[1]!.tip.y).toBeLessThan(0);
    // Symmetric magnitudes for symmetric curvatures.
    expectClose(teeth[0]!.tip.y, -teeth[1]!.tip.y, 1e-15);
  });

  it("compresses a large curvature in signed-log mode but not in linear mode", () => {
    const points = [fakePoint(1, 0), fakePoint(1000, 1)];
    const log = buildComb(points, { kappaRef: 1, scale: "signed-log" });
    const linear = buildComb(points, { kappaRef: 1, scale: "linear" });
    const logRatio = log[1]!.tip.y / log[0]!.tip.y;
    const linearRatio = linear[1]!.tip.y / linear[0]!.tip.y;
    expectClose(linearRatio, 1000, 1e-9);
    // log1p(1000)/log1p(1) is about 10, which is the whole point: the nose
    // no longer dominates the picture.
    expect(logRatio).toBeLessThan(15);
    expect(logRatio).toBeGreaterThan(5);
  });

  it("uses the gain as a plain multiplier", () => {
    const one = buildComb([fakePoint(3, 0)], { kappaRef: 1, gain: 1 });
    const two = buildComb([fakePoint(3, 0)], { kappaRef: 1, gain: 2 });
    expectClose(two[0]!.tip.y, 2 * one[0]!.tip.y, 1e-15);
  });

  it("defaults kappaRef to the median of the magnitudes", () => {
    const teeth = buildComb([fakePoint(2, 0), fakePoint(4, 1), fakePoint(6, 2)]);
    // With kappaRef = 4 the middle tooth is log1p(1) = 0.6931.
    expectClose(teeth[1]!.tip.y, Math.log1p(1), 1e-12);
  });
});

describe("findInflections", () => {
  it("finds the crossing and interpolates its position", () => {
    const markers = findInflections([fakePoint(1, 0), fakePoint(-1, 1)], 0);
    expect(markers.length).toBe(1);
    expectClose(markers[0]!.point.x, 0.5, 1e-12);
    expect(markers[0]!.onSuctionSide).toBe(true);
  });

  it("ignores a curvature that touches zero without crossing", () => {
    expect(findInflections([fakePoint(1, 0), fakePoint(0, 1), fakePoint(1, 2)], 0)).toEqual([]);
  });

  it("marks the suction side only after the leading edge segment", () => {
    const before: CurvePoint = { ...fakePoint(1, 0), segment: 0 };
    const after: CurvePoint = { ...fakePoint(-1, 1), segment: 1 };
    expect(findInflections([before, after], 2)[0]?.onSuctionSide).toBe(false);
    expect(findInflections([before, after], 1)[0]?.onSuctionSide).toBe(true);
  });

  it("reports no inflection on a plain symmetric preset", () => {
    // Regression guard: this has been true since the preset was written. It
    // is here so that a change to the preset or to the construction that
    // introduces a wobble shows up immediately.
    const element = resolveElement(ladderElement());
    const points = sampleElement(element, { count: 300 });
    const markers = findInflections(points, element.leIndex);
    expect(markers.filter((m) => m.onSuctionSide)).toEqual([]);
  });
});
