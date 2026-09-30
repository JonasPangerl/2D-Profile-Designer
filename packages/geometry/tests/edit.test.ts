/**
 * Document transformations. See docs/proposals/001-m2-svg-editor.md.
 *
 * These are the single door that both dragging and numeric entry go
 * through, so a bug here is a bug in every editing gesture at once.
 */

import { describe, expect, it } from "vitest";
import {
  continuityReport,
  createDocument,
  deleteAnchor,
  duplicateElement,
  evaluateChain,
  insertAnchor,
  ladderElement,
  moveElement,
  parseDocument,
  removeElement,
  resolveElement,
  sampleElement,
  serialiseDocument,
  setAnchor,
  setElementParam,
  setPlacement,
  setSegmentDegree,
  vec,
} from "../src/index.js";
import type { ProfileDocument } from "../src/index.js";
import { expectClose, expectPointClose } from "./helpers.js";

function doc(): ProfileDocument {
  return createDocument([ladderElement()], "Test");
}

const ID = "element-1";

/**
 * Largest distance from any point of `a` to the POLYLINE through `b`.
 *
 * Point-to-point would be wrong here and wrongly reassuring in the other
 * direction: the sampler is density-adaptive, so two contours of the same
 * shape are sampled at different parameters, and the nearest stored point
 * can be half a sample spacing away. That measures the spacing, not the
 * deviation. Measured 2026-09-30: the point-to-point metric reported
 * 1.2e-2 for an insertion whose true deviation is 6e-6.
 */
function maxDeviation(
  a: readonly { x: number; y: number }[],
  b: readonly { x: number; y: number }[],
): number {
  let worst = 0;
  for (const p of a) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 1; i < b.length; i += 1) {
      const d = vec.distanceToSegment(p, b[i - 1]!, b[i]!).distance;
      if (d < best) best = d;
    }
    if (best > worst) worst = best;
  }
  return worst;
}

function contour(d: ProfileDocument, count = 800): { x: number; y: number }[] {
  return sampleElement(resolveElement(d.elements[0]!), { count }).map((p) => p.point);
}

describe("setAnchor", () => {
  it("applies a patch and leaves every other field alone", () => {
    const before = doc();
    const after = setAnchor(before, ID, 1, { x: 0.35 });
    const a = after.elements[0]!.anchors[1]!;
    const b = before.elements[0]!.anchors[1]!;
    expect(a.x).toBe(0.35);
    expect(a.y).toBe(b.y);
    expect(a.phi).toBe(b.phi);
    expect(a.R).toBe(b.R);
    expect(a.Lin).toBe(b.Lin);
    expect(a.Lout).toBe(b.Lout);
  });

  it("never mutates the input document", () => {
    const before = doc();
    const snapshot = JSON.stringify(serialiseDocument(before));
    setAnchor(before, ID, 1, { x: 0.9, y: -0.2 });
    expect(JSON.stringify(serialiseDocument(before))).toBe(snapshot);
  });

  it("rejects a patch to a field the element-level parameters derive", () => {
    const d = doc();
    // The leading edge anchor owns neither its tangent nor its radius.
    expect(() => setAnchor(d, ID, 2, { phi: 1 })).toThrowError(/GEOM_DERIVED_FIELD/);
    expect(() => setAnchor(d, ID, 2, { R: 0.05 })).toThrowError(/GEOM_DERIVED_FIELD/);
    // The trailing edge anchors own neither their position nor their
    // tangent; teThickness, departureAngle and wedgeAngle do.
    expect(() => setAnchor(d, ID, 0, { x: 0.9 })).toThrowError(/GEOM_DERIVED_FIELD/);
    expect(() => setAnchor(d, ID, 0, { y: 0.1 })).toThrowError(/GEOM_DERIVED_FIELD/);
    expect(() => setAnchor(d, ID, 4, { phi: 0.2 })).toThrowError(/GEOM_DERIVED_FIELD/);
  });

  it("allows the fields those anchors do own", () => {
    const d = doc();
    // Arm lengths are free at every anchor, including the derived ones.
    expect(() => setAnchor(d, ID, 2, { Lin: 0.02, Lout: 0.02 })).not.toThrow();
    expect(() => setAnchor(d, ID, 0, { Lout: 0.3 })).not.toThrow();
    // The leading edge anchor may still be moved.
    expect(() => setAnchor(d, ID, 2, { x: 0.01, y: 0.002 })).not.toThrow();
  });

  it("rejects an unknown element or anchor index", () => {
    const d = doc();
    expect(() => setAnchor(d, "nope", 1, { x: 0.5 })).toThrowError(/GEOM_NO_SUCH_ELEMENT/);
    expect(() => setAnchor(d, ID, 99, { x: 0.5 })).toThrowError(/GEOM_NO_SUCH_ANCHOR/);
  });

  it("rejects a non-finite value instead of drawing NaN", () => {
    const d = doc();
    expect(() => setAnchor(d, ID, 1, { x: Number.NaN })).toThrowError(/GEOM_INVALID_NUMBER/);
    // R is the one field where Infinity is meaningful.
    expect(() => setAnchor(d, ID, 1, { R: Infinity })).not.toThrow();
    expect(() => setAnchor(d, ID, 1, { Lin: Infinity })).toThrowError(/GEOM_INVALID_NUMBER/);
  });
});

describe("setElementParam and friends", () => {
  it("changes the parameter and nothing else", () => {
    const after = setElementParam(doc(), ID, "leRadius", 0.03);
    expect(after.elements[0]!.leRadius).toBe(0.03);
    expect(after.elements[0]!.teThickness).toBe(doc().elements[0]!.teThickness);
  });

  it("feeds through to the resolved anchors", () => {
    const after = setElementParam(doc(), ID, "teThickness", 0.02);
    const resolved = resolveElement(after.elements[0]!);
    expectClose(resolved.anchors[0]!.y, -0.01, 0);
    expectClose(resolved.anchors[4]!.y, 0.01, 0);
  });

  it("rejects a non-finite value", () => {
    expect(() => setElementParam(doc(), ID, "leRadius", Number.NaN)).toThrowError(
      /GEOM_INVALID_NUMBER/,
    );
  });

  it("setPlacement patches only the keys it is given", () => {
    const after = setPlacement(doc(), ID, { chord: 0.4 });
    expect(after.elements[0]!.placement.chord).toBe(0.4);
    expect(after.elements[0]!.placement.chordAngle).toBe(0);
  });

  it("setSegmentDegree rejects a degree below 4", () => {
    expect(() => setSegmentDegree(doc(), ID, 0, 3)).toThrowError(/GEOM_DEGREE_TOO_LOW/);
    expect(setSegmentDegree(doc(), ID, 0, 6).elements[0]!.segmentDegrees[0]).toBe(6);
  });
});

describe("insertAnchor", () => {
  it("puts the new anchor exactly on the old curve", () => {
    const before = doc();
    const onCurve = evaluateChain(resolveElement(before.elements[0]!), 1.4);
    const after = insertAnchor(before, ID, 1, 0.4);
    const inserted = after.elements[0]!.anchors[2]!;
    // 1e-12: the inserted position is the evaluated point itself, so only
    // the round trip through the anchor record separates them.
    expectPointClose(inserted, onCurve.point, 1e-12);
    expectClose(inserted.phi, Math.atan2(onCurve.tangent.y, onCurve.tangent.x), 1e-12);
    expectClose(inserted.R, 1 / onCurve.kappa, 0, 1e-10);
  });

  it("adds one anchor and one segment degree", () => {
    const before = doc();
    const after = insertAnchor(before, ID, 1, 0.5);
    expect(after.elements[0]!.anchors.length).toBe(before.elements[0]!.anchors.length + 1);
    expect(after.elements[0]!.segmentDegrees.length).toBe(
      after.elements[0]!.anchors.length - 1,
    );
  });

  it("keeps the contour to within 1e-5 chord, at every segment and parameter", () => {
    const before = doc();
    const reference = contour(before);
    // 1e-5 chord. With the neighbour arms scaled by de Casteljau the
    // deviation measured 3.8e-6 to 7.4e-6 over all four segments at
    // t = 0.25, 0.5 and 0.75 on 2026-09-30. The bound sits just above the
    // worst of those: tight enough that losing the arm scaling fails it by
    // three orders of magnitude, loose enough to survive a retune.
    for (let segment = 0; segment < 4; segment += 1) {
      for (const t of [0.25, 0.5, 0.75]) {
        const after = insertAnchor(before, ID, segment, t);
        expect(
          maxDeviation(contour(after), reference),
          `segment ${segment} at t=${t}`,
        ).toBeLessThan(1e-5);
      }
    }
  });

  it("keeps G0, G1 and G2 at every anchor", () => {
    const after = insertAnchor(doc(), ID, 1, 0.35);
    for (const report of continuityReport(resolveElement(after.elements[0]!))) {
      expectClose(report.positionGap, 0, 1e-12);
      expectClose(report.tangentGap, 0, 1e-10);
      expectClose(report.curvatureGap, 0, 1e-10);
    }
  });

  it("rejects a parameter outside the segment", () => {
    expect(() => insertAnchor(doc(), ID, 1, 0)).toThrowError(/GEOM_INVALID_NUMBER/);
    expect(() => insertAnchor(doc(), ID, 1, 1)).toThrowError(/GEOM_INVALID_NUMBER/);
    expect(() => insertAnchor(doc(), ID, 99, 0.5)).toThrowError(/GEOM_NO_SUCH_SEGMENT/);
  });
});

describe("deleteAnchor", () => {
  it("refuses the leading edge and both trailing edge anchors", () => {
    const d = doc();
    expect(() => deleteAnchor(d, ID, 0)).toThrowError(/GEOM_ANCHOR_REQUIRED/);
    expect(() => deleteAnchor(d, ID, 2)).toThrowError(/GEOM_ANCHOR_REQUIRED/);
    expect(() => deleteAnchor(d, ID, 4)).toThrowError(/GEOM_ANCHOR_REQUIRED/);
  });

  it("removes an ordinary anchor and one segment degree", () => {
    const before = doc();
    const after = deleteAnchor(before, ID, 1);
    expect(after.elements[0]!.anchors.length).toBe(before.elements[0]!.anchors.length - 1);
    expect(after.elements[0]!.segmentDegrees.length).toBe(
      after.elements[0]!.anchors.length - 1,
    );
  });

  it("is the exact inverse of an insert", () => {
    const before = doc();
    const reference = contour(before);
    // 1e-9 chord, which is round-off. deleteAnchor recovers the split
    // parameter from the departing anchor's two arms and scales the
    // neighbours back up, so the round trip returns the original document
    // rather than something merely similar. Measured 2026-09-30: 0 exactly
    // at most parameters, 4.7e-13 at worst. Without the rescale it was
    // 7.9e-3.
    for (let segment = 0; segment < 4; segment += 1) {
      for (const t of [0.25, 0.5, 0.75]) {
        const back = deleteAnchor(insertAnchor(before, ID, segment, t), ID, segment + 1);
        expect(
          maxDeviation(contour(back), reference),
          `segment ${segment} at t=${t}`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("restores the neighbour arms the insert shortened", () => {
    const before = doc();
    const back = deleteAnchor(insertAnchor(before, ID, 1, 0.3), ID, 2);
    const a = back.elements[0]!.anchors;
    const b = before.elements[0]!.anchors;
    for (let i = 0; i < a.length; i += 1) {
      // 1e-12 relative: the arms travel out through a multiplication by t
      // and back through a division by it.
      expectClose(a[i]!.Lin, b[i]!.Lin, 0, 1e-12);
      expectClose(a[i]!.Lout, b[i]!.Lout, 0, 1e-12);
    }
  });
});

describe("element operations", () => {
  it("duplicateElement produces an independent element with a new id", () => {
    const before = doc();
    const after = duplicateElement(before, ID, "element-2");
    expect(after.elements.length).toBe(2);
    expect(after.elements[1]!.id).toBe("element-2");
    const touched = setAnchor(after, "element-2", 1, { x: 0.9 });
    expect(touched.elements[0]!.anchors[1]!.x).toBe(before.elements[0]!.anchors[1]!.x);
  });

  it("duplicateElement rejects an id that is already taken", () => {
    expect(() => duplicateElement(doc(), ID, ID)).toThrowError(/GEOM_DUPLICATE_ID/);
  });

  it("removeElement refuses to empty the document", () => {
    expect(() => removeElement(doc(), ID)).toThrowError(/GEOM_LAST_ELEMENT/);
    const two = duplicateElement(doc(), ID, "element-2");
    expect(removeElement(two, ID).elements.length).toBe(1);
  });

  it("moveElement clamps rather than throwing", () => {
    const two = duplicateElement(doc(), ID, "element-2");
    expect(moveElement(two, ID, 99).elements[1]!.id).toBe(ID);
    expect(moveElement(two, ID, -5).elements[0]!.id).toBe(ID);
  });
});

describe("every transformation leaves the document parseable", () => {
  it("round trips after each one", () => {
    const start = doc();
    const cases: ProfileDocument[] = [
      setAnchor(start, ID, 1, { x: 0.4, y: -0.07 }),
      setElementParam(start, ID, "wedgeAngle", 0.3),
      setPlacement(start, ID, { chordAngle: 0.1 }),
      setSegmentDegree(start, ID, 2, 5),
      insertAnchor(start, ID, 0, 0.6),
      deleteAnchor(start, ID, 3),
      duplicateElement(start, ID, "element-2"),
      moveElement(duplicateElement(start, ID, "element-2"), ID, 1),
    ];
    for (const candidate of cases) {
      const back = parseDocument(serialiseDocument(candidate));
      expect(back).toEqual(candidate);
      // And it must still build.
      for (const element of back.elements) expect(() => resolveElement(element)).not.toThrow();
    }
  });
});
