import { describe, expect, it } from "vitest";
import {
  contourToWorld,
  gapAndOverlap,
  ladderElement,
  mirrorAtGround,
  resolveElement,
  sampleElement,
  toLocal,
  toWorld,
} from "../src/index.js";
import type { Placement } from "../src/index.js";
import { expectClose, expectPointClose } from "./helpers.js";

const identity: Placement = { le: { x: 0, y: 0 }, chord: 1, chordAngle: 0 };

describe("toWorld and toLocal", () => {
  it("are inverses", () => {
    const placement: Placement = { le: { x: 3, y: -1 }, chord: 0.4, chordAngle: -0.25 };
    for (const p of [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.3, y: 0.07 },
    ]) {
      // 1e-15: two rotations and a scale, all order 1.
      expectPointClose(toLocal(toWorld(p, placement), placement), p, 1e-14);
    }
  });

  it("puts the normalised leading edge exactly at placement.le", () => {
    const placement: Placement = { le: { x: 2, y: 5 }, chord: 0.7, chordAngle: 1.1 };
    expectPointClose(toWorld({ x: 0, y: 0 }, placement), placement.le, 0);
  });

  it("scales the chord to the physical length", () => {
    const placement: Placement = { le: { x: 0, y: 0 }, chord: 250, chordAngle: 0 };
    expectPointClose(toWorld({ x: 1, y: 0 }, placement), { x: 250, y: 0 }, 1e-12);
  });
});

describe("gapAndOverlap", () => {
  it("measures the gap between two parallel plates", () => {
    // Two horizontal lines 0.25 apart, both of chord 1.
    const front = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const frontPlacement: Placement = { le: { x: 0, y: 0 }, chord: 1, chordAngle: 0 };
    const behind = [
      { x: 0.5, y: 0.25 },
      { x: 1.5, y: 0.25 },
    ];
    const behindPlacement: Placement = { le: { x: 0.5, y: 0.25 }, chord: 1, chordAngle: 0 };
    const result = gapAndOverlap(behind, behindPlacement, front, frontPlacement);
    // 1e-12: the closest approach is exactly the vertical offset.
    expectClose(result.gap, 0.25, 1e-12);
    expectClose(result.gapFraction, 0.25, 1e-12);
    // The rear leading edge sits at x = 0.5, the front trailing edge at
    // x = 1, so the rear element overlaps the front one by 0.5.
    expectClose(result.overlap, 0.5, 1e-12);
    expectClose(result.overlapFraction, 0.5, 1e-12);
  });

  it("reports a negative overlap when the elements are separated", () => {
    const front = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const frontPlacement: Placement = { le: { x: 0, y: 0 }, chord: 1, chordAngle: 0 };
    const behind = [
      { x: 1.2, y: 0.1 },
      { x: 2.2, y: 0.1 },
    ];
    const behindPlacement: Placement = { le: { x: 1.2, y: 0.1 }, chord: 1, chordAngle: 0 };
    const result = gapAndOverlap(behind, behindPlacement, front, frontPlacement);
    expectClose(result.overlap, -0.2, 1e-12);
  });

  it("finds a gap that falls between two sampled points of the front contour", () => {
    // A single long front segment: a point-to-point minimum would report
    // 0.5 here, a point-to-segment minimum reports 0.1.
    const front = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const frontPlacement: Placement = { le: { x: 0, y: 0 }, chord: 1, chordAngle: 0 };
    const behind = [
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.2 },
    ];
    const behindPlacement: Placement = { le: { x: 0.5, y: 0.1 }, chord: 1, chordAngle: 0 };
    const result = gapAndOverlap(behind, behindPlacement, front, frontPlacement);
    expectClose(result.gap, 0.1, 1e-12);
  });

  it("works on a real sampled contour", () => {
    const element = resolveElement(ladderElement());
    const contour = sampleElement(element, { count: 80 }).map((p) => p.point);
    const front = contourToWorld(contour, identity);
    const behindPlacement: Placement = { le: { x: 0.9, y: 0.05 }, chord: 0.4, chordAngle: -0.3 };
    const behind = contourToWorld(contour, behindPlacement);
    const result = gapAndOverlap(behind, behindPlacement, front, identity);
    expect(result.gap).toBeGreaterThan(0);
    expect(Number.isFinite(result.overlap)).toBe(true);
    expectClose(result.overlap, 0.1, 1e-12);
  });

  it("rejects a contour with fewer than two points", () => {
    expect(() => gapAndOverlap([{ x: 0, y: 0 }], identity, [], identity)).toThrowError(
      RangeError,
    );
  });
});

describe("mirrorAtGround", () => {
  it("flips y and leaves x alone", () => {
    expect(mirrorAtGround([{ x: 2, y: 3 }])).toEqual([{ x: 2, y: -3 }]);
  });
});
