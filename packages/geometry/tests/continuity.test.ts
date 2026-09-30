/**
 * The M1 gate: G0, G1 and G2 at every anchor, over every segment degree the
 * model allows. See docs/spec/07-testing.md for the tolerances and why they
 * are what they are.
 */

import { describe, expect, it } from "vitest";
import {
  continuityReport,
  ladderElement,
  ladderFromNaca,
  resolveElement,
  validateElement,
} from "../src/index.js";
import { expectClose } from "./helpers.js";

const DEGREES = [4, 5, 6, 7, 8];

describe("G0, G1 and G2 at every anchor", () => {
  for (const degree of DEGREES) {
    it(`holds for the ladder preset at segment degree ${degree}`, () => {
      const element = resolveElement(ladderElement({ segmentDegree: degree }));
      const reports = continuityReport(element);
      expect(reports.length).toBe(element.segments.length - 1);
      for (const report of reports) {
        // G0, 1e-12 absolute: the two endpoints are the same stored anchor
        // position, so only floating point summation separates them.
        expectClose(report.positionGap, 0, 1e-12);
        // G1, 1e-10 absolute on the unit tangent difference: one
        // normalisation of a difference of order 1.
        expectClose(report.tangentGap, 0, 1e-10);
        // G2, 1e-8 relative on kappa with an absolute floor of 1e-10: the
        // curvature formula divides by a cubed speed.
        const reference = Math.max(Math.abs(report.curvatureIn), 1);
        expectClose(report.curvatureGap, 0, 1e-10, 0);
        expectClose(report.curvatureOut, report.curvatureIn, 1e-10, 1e-8 * reference);
      }
    });
  }

  it("holds for a cambered profile built from a NACA code", () => {
    for (const degree of DEGREES) {
      const element = resolveElement(ladderFromNaca("2412", { segmentDegree: degree }));
      for (const report of continuityReport(element)) {
        expectClose(report.positionGap, 0, 1e-12);
        expectClose(report.tangentGap, 0, 1e-10);
        expectClose(report.curvatureGap, 0, 1e-10);
      }
    }
  });

  it("holds when the segment degrees differ from one segment to the next", () => {
    const base = ladderElement();
    const mixed = { ...base, segmentDegrees: [4, 6, 5, 8] };
    const element = resolveElement(mixed);
    for (const report of continuityReport(element)) {
      expectClose(report.positionGap, 0, 1e-12);
      expectClose(report.tangentGap, 0, 1e-10);
      expectClose(report.curvatureGap, 0, 1e-10);
    }
  });
});

describe("resolveElement", () => {
  it("places the trailing edge anchors from teThickness", () => {
    const spec = ladderElement({ teThickness: 0.01 });
    const element = resolveElement(spec);
    const first = element.anchors[0];
    const last = element.anchors[element.anchors.length - 1];
    expect(first?.x).toBe(1);
    expect(last?.x).toBe(1);
    expectClose(first?.y ?? Number.NaN, -0.005, 0);
    expectClose(last?.y ?? Number.NaN, 0.005, 0);
  });

  it("derives the leading edge index from the smallest x", () => {
    expect(resolveElement(ladderElement()).leIndex).toBe(2);
  });

  it("puts the leading edge tangent perpendicular to the leAxis", () => {
    const element = resolveElement(ladderElement());
    expectClose(element.anchors[element.leIndex]?.phi ?? Number.NaN, Math.PI / 2, 0);
    const tilted = resolveElement({ ...ladderElement(), leAxisAngle: 0.15 });
    expectClose(tilted.anchors[tilted.leIndex]?.phi ?? Number.NaN, Math.PI / 2 + 0.15, 1e-15);
  });

  it("reports a stored anchor that disagrees with its derived value", () => {
    const base = ladderElement();
    // A hand-edited document with the wrong trailing edge y.
    const broken = {
      ...base,
      anchors: base.anchors.map((a, i) => (i === 0 ? { ...a, y: -0.5 } : a)),
    };
    const issues = validateElement(broken);
    expect(issues.length).toBe(1);
    expect(issues[0]?.field).toBe("y");
    expect(issues[0]?.anchorIndex).toBe(0);
  });

  it("finds nothing to report on a preset", () => {
    expect(validateElement(ladderElement())).toEqual([]);
    expect(validateElement(ladderFromNaca("0012"))).toEqual([]);
  });

  it("rejects a segmentDegrees array of the wrong length", () => {
    const base = ladderElement();
    expect(() => resolveElement({ ...base, segmentDegrees: [4, 4] })).toThrowError(
      /GEOM_DEGREE_MISMATCH/,
    );
  });

  it("accepts an empty segmentDegrees array as the default degree everywhere", () => {
    const base = ladderElement();
    const element = resolveElement({ ...base, segmentDegrees: [] });
    for (const segment of element.segments) {
      expect(segment.points.length).toBe(5);
    }
  });
});
