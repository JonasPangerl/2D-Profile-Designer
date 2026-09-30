/**
 * Guards found by the independent review of the M2 diff (commit d8d681b).
 *
 * Each block names the finding it closes. Every one of these was an edit
 * that `edit.ts` accepted and stored, and that then either changed the
 * shape behind the user's back or made the document unrenderable.
 */

import { describe, expect, it } from "vitest";
import {
  createDocument,
  deleteAnchor,
  derivedAnchorFields,
  insertAnchor,
  ladderElement,
  leadingEdgeIndex,
  resolveAnchors,
  resolveElement,
  sampleElement,
  setAnchor,
  setElementParam,
  setSegmentDegree,
  vec,
} from "../src/index.js";
import type { Anchor, ProfileDocument } from "../src/index.js";

const ID = "element-1";

function doc(degrees?: number[]): ProfileDocument {
  const base = ladderElement();
  return createDocument([degrees ? { ...base, segmentDegrees: degrees } : base], "Test");
}

function contour(d: ProfileDocument): { x: number; y: number }[] {
  return sampleElement(resolveElement(d.elements[0]!), { count: 800 }).map((p) => p.point);
}

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

describe("C1 - delete inverts insert at every parameter, not only in the middle", () => {
  it("round trips to round-off across the whole open interval", () => {
    const before = doc();
    const reference = contour(before);
    // The old growth cap of 20 made this fail outside t in [0.05, 0.95]:
    // 8.1e-3 chord at t = 0.02 and 1.6e-3 at t = 0.98, silently. Capping
    // the resulting arm LENGTH instead of the growth FACTOR cannot bite on
    // a genuine inverse, because the restored arm is exactly the arm the
    // split shortened, and that arm was already legal.
    for (const t of [0.001, 0.02, 0.05, 0.25, 0.5, 0.75, 0.95, 0.98, 0.999]) {
      const back = deleteAnchor(insertAnchor(before, ID, 1, t), ID, 2);
      expect(maxDeviation(contour(back), reference), `t=${t}`).toBeLessThan(1e-9);
    }
  });

  it("restores the neighbour arms exactly at an extreme parameter", () => {
    const before = doc();
    const back = deleteAnchor(insertAnchor(before, ID, 1, 0.01), ID, 2);
    const a = back.elements[0]!.anchors;
    const b = before.elements[0]!.anchors;
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]!.Lin).toBeCloseTo(b[i]!.Lin, 12);
      expect(a[i]!.Lout).toBeCloseTo(b[i]!.Lout, 12);
    }
  });

  it("still refuses to grow a hand-placed lopsided anchor without limit", () => {
    // An anchor whose arms were never produced by a split: the ratio
    // heuristic would ask for an arm many times the chord.
    const lopsided = setAnchor(doc(), ID, 1, { Lin: 0.0011, Lout: 0.4 });
    const after = deleteAnchor(lopsided, ID, 1);
    for (const anchor of after.elements[0]!.anchors) {
      expect(anchor.Lout).toBeLessThanOrEqual(2);
      expect(anchor.Lin).toBeLessThanOrEqual(2);
    }
  });

  it("refuses an insertion parameter that would collapse an arm", () => {
    expect(() => insertAnchor(doc(), ID, 1, 1e-12)).toThrowError(/GEOM_ZERO_ARM/);
  });
});

describe("C2 - an edit may not hand the leading edge role to another anchor", () => {
  it("refuses a move that would make a different anchor the leading edge", () => {
    const d = doc([5, 5, 5, 5]);
    expect(leadingEdgeIndex(d.elements[0]!.anchors)).toBe(2);
    // Anchor 1's x is not derived, so the patch used to be accepted. The
    // role then moved, and anchor 1's stored phi = pi and R = 0.9 were
    // resolved to pi/2 and 0.02, moving the contour by 2.1e-1 chord with
    // no warning anywhere.
    expect(() => setAnchor(d, ID, 1, { x: -0.001 })).toThrowError(/GEOM_LEADING_EDGE_MOVED/);
  });

  it("refuses dragging the nose past another anchor", () => {
    const d = doc([5, 5, 5, 5]);
    // Anchor 2's position IS free, and dragging it used to hand the role
    // to anchor 1 and replace anchor 1's radius. A drag on one anchor must
    // not rewrite another.
    expect(() => setAnchor(d, ID, 2, { x: 0.5, y: 0 })).toThrowError(
      /GEOM_LEADING_EDGE_MOVED/,
    );
  });

  it("still allows a move that keeps the same anchor in front", () => {
    const d = doc();
    expect(() => setAnchor(d, ID, 2, { x: 0.02, y: 0.004 })).not.toThrow();
    expect(() => setAnchor(d, ID, 1, { x: 0.45 })).not.toThrow();
  });
});

describe("C3 - an accepted edit may not leave the document unrenderable", () => {
  const cases: Array<[string, () => ProfileDocument, RegExp]> = [
    ["a zero radius", () => setAnchor(doc(), ID, 1, { R: 0 }), /GEOM_SHARP_CORNER_UNSUPPORTED/],
    ["a negative arm", () => setAnchor(doc(), ID, 1, { Lout: -0.2 }), /GEOM_ZERO_ARM/],
    ["a zero arm", () => setAnchor(doc(), ID, 1, { Lin: 0 }), /GEOM_ZERO_ARM/],
    [
      "a zero leading edge radius",
      () => setElementParam(doc(), ID, "leRadius", 0),
      /GEOM_SHARP_CORNER_UNSUPPORTED/,
    ],
    [
      "a negative leading edge radius",
      () => setElementParam(doc(), ID, "leRadius", -0.02),
      /GEOM_INVALID_NUMBER/,
    ],
    [
      "a negative trailing edge thickness",
      () => setElementParam(doc(), ID, "teThickness", -0.01),
      /GEOM_INVALID_NUMBER/,
    ],
  ];

  for (const [name, change, code] of cases) {
    it(`rejects ${name} at the door rather than at the renderer`, () => {
      expect(change).toThrowError(code);
    });
  }

  it("leaves every reachable edit renderable", () => {
    // The property behind the cases above: anything edit.ts accepts, the
    // renderer can build.
    const edits: Array<() => ProfileDocument> = [
      () => setAnchor(doc(), ID, 1, { R: 0.001 }),
      () => setAnchor(doc(), ID, 1, { R: Infinity }),
      () => setAnchor(doc(), ID, 1, { Lin: 1e-6, Lout: 1e-6 }),
      () => setElementParam(doc(), ID, "leRadius", 1e-4),
      () => setElementParam(doc(), ID, "teThickness", 0),
      () => setElementParam(doc(), ID, "wedgeAngle", 1.2),
      () => setSegmentDegree(doc(), ID, 1, 8),
      () => insertAnchor(doc(), ID, 2, 0.5),
    ];
    for (const edit of edits) {
      expect(() => resolveElement(edit().elements[0]!)).not.toThrow();
    }
  });
});

describe("C5 - the empty segmentDegrees default agrees with resolveElement", () => {
  it("fills with the default degree, not the minimum", () => {
    const d = doc([]);
    const inserted = insertAnchor(d, ID, 1, 0.5);
    const viaResolve = resolveElement(d.elements[0]!).segments.map((s) => s.points.length - 1);
    for (const degree of inserted.elements[0]!.segmentDegrees) {
      expect(degree).toBe(viaResolve[0]);
    }
  });
});

describe("S1 - one door for the derived field list", () => {
  it("names exactly the fields resolveAnchors overwrites", () => {
    // Walk the resolver field by field. A field it changes but the list
    // does not declare is a field a user can set, store, and never see
    // again: the silent failure the list exists to prevent.
    const spec = ladderElement();
    const probe = {
      ...spec,
      anchors: spec.anchors.map((a) => ({
        ...a,
        x: a.x + 0.001,
        y: a.y + 0.001,
        phi: a.phi + 0.001,
        R: Number.isFinite(a.R) ? a.R + 0.001 : a.R,
      })),
    };
    const resolved = resolveAnchors(probe).anchors;

    for (let i = 0; i < probe.anchors.length; i += 1) {
      const declared = derivedAnchorFields(probe.anchors, i);
      const stored = probe.anchors[i] as Anchor;
      const out = resolved[i] as Anchor;
      const changed = (field: keyof Anchor): boolean => stored[field] !== out[field];

      if (changed("x") || changed("y")) {
        expect(declared.position, `anchor ${i} position`).toBe(true);
      }
      if (changed("phi")) expect(declared.phi, `anchor ${i} phi`).toBe(true);
      if (changed("R")) expect(declared.radius, `anchor ${i} R`).toBe(true);
      // Arm lengths are free at every anchor and must never be rewritten.
      expect(changed("Lin"), `anchor ${i} Lin`).toBe(false);
      expect(changed("Lout"), `anchor ${i} Lout`).toBe(false);
    }
  });
});
