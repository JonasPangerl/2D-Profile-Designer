import { describe, expect, it } from "vitest";
import {
  chainLength,
  curvature,
  evaluate,
  ladderElement,
  resolveElement,
  sampleElement,
} from "../src/index.js";
import { expectClose, expectPointClose } from "./helpers.js";

const element = resolveElement(ladderElement());

describe("sampleElement", () => {
  it("returns the requested number of points", () => {
    expect(sampleElement(element, { count: 200 }).length).toBe(200);
    expect(sampleElement(element, { count: 37 }).length).toBe(37);
  });

  it("starts and ends exactly on the two trailing edge anchors", () => {
    const points = sampleElement(element, { count: 50 });
    const first = points[0];
    const last = points[points.length - 1];
    const teThickness = element.spec.teThickness;
    // 1e-15: these are the stored anchor coordinates themselves.
    expectPointClose(first?.point ?? { x: 0, y: 0 }, { x: 1, y: -teThickness / 2 }, 1e-15);
    expectPointClose(last?.point ?? { x: 0, y: 0 }, { x: 1, y: teThickness / 2 }, 1e-15);
  });

  it("puts every point exactly on the curve", () => {
    for (const p of sampleElement(element, { count: 60 })) {
      const onCurve = evaluate(element.segments[p.segment]!, p.t);
      // Exactly on the curve by construction: the sampler evaluates, it
      // never interpolates between samples. 1e-15 is pure round-off.
      expectPointClose(p.point, onCurve, 1e-15);
      expectClose(p.kappa, curvature(element.segments[p.segment]!, p.t), 1e-12);
    }
  });

  it("produces a monotone arc length", () => {
    const points = sampleElement(element, { count: 120 });
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]!.s).toBeGreaterThan(points[i - 1]!.s);
    }
    // The last sampled s is the chain length, up to the polyline error of
    // the internal table. 1e-4 absolute on a chain of order 2 is the
    // polyline shortcut of 256 sub-samples per segment.
    expectClose(points[points.length - 1]!.s, chainLength(element), 1e-4);
  });

  it("leaves no gap larger than three times the mean of its neighbours", () => {
    const points = sampleElement(element, { count: 200 });
    const gaps: number[] = [];
    for (let i = 1; i < points.length; i += 1) {
      gaps.push(points[i]!.s - points[i - 1]!.s);
    }
    for (let i = 1; i < gaps.length - 1; i += 1) {
      const neighbourMean = ((gaps[i - 1] as number) + (gaps[i + 1] as number)) / 2;
      expect(
        (gaps[i] as number) <= 3 * neighbourMean,
        `gap ${i} is ${gaps[i]}, neighbours average ${neighbourMean}`,
      ).toBe(true);
    }
  });

  it("clusters more points near the nose than a uniform spacing would", () => {
    const clustered = sampleElement(element, { count: 200 });
    const uniform = sampleElement(element, {
      count: 200,
      cosineClustering: false,
      curvatureWeight: 0,
    });
    const nearNose = (points: typeof clustered): number =>
      points.filter((p) => p.point.x < 0.05).length;
    expect(nearNose(clustered)).toBeGreaterThan(nearNose(uniform));
  });

  it("spaces points evenly in arc length when both density terms are off", () => {
    const points = sampleElement(element, {
      count: 100,
      cosineClustering: false,
      curvatureWeight: 0,
    });
    const gaps: number[] = [];
    for (let i = 1; i < points.length; i += 1) gaps.push(points[i]!.s - points[i - 1]!.s);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    for (const gap of gaps) {
      // 2 percent of the mean: the inversion is linear inside one table
      // interval, and the table has 256 sub-samples per segment.
      expectClose(gap, mean, 0.02 * mean);
    }
  });

  it("rejects a point count below 3", () => {
    expect(() => sampleElement(element, { count: 2 })).toThrowError(RangeError);
  });
});
