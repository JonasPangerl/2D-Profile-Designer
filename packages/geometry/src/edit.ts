/**
 * Document transformations.
 *
 * Golden rule G7: every feature is a transformation of the document. This
 * module is that set of transformations, and it is the single door both
 * dragging and numeric entry go through (golden rule G6). Keeping it here,
 * in the pure core, is what makes "a drag and a typed value produce an
 * identical document" structurally true rather than something the UI has to
 * remember.
 *
 * Every function returns a new document and mutates nothing. Every one
 * throws a `GeometryError` rather than returning a silently wrong document:
 * a plausible wrong number is worse than a crash.
 */

import { GeometryError } from "./errors.js";
import { DEFAULT_SEGMENT_DEGREE, MAX_ARM_LENGTH, MIN_ARM_LENGTH, MIN_SEGMENT_DEGREE } from "./constants.js";
import { degree, firstDerivative } from "./bezier.js";
import { evaluateChain } from "./curvature.js";
import { derivedAnchorFields, leadingEdgeIndex, resolveElement } from "./element.js";
import type { Anchor, BezierSegment, ElementSpec, Placement } from "./types.js";
import type { ProfileDocument } from "./schema.js";
import { length } from "./vec.js";

/** Element-level scalars a panel can set directly. */
export type ElementParamKey =
  | "leAxisAngle"
  | "teThickness"
  | "departureAngle"
  | "wedgeAngle"
  | "leRadius";

function elementIndex(doc: ProfileDocument, elementId: string): number {
  const index = doc.elements.findIndex((e) => e.id === elementId);
  if (index === -1) {
    throw new GeometryError("GEOM_NO_SUCH_ELEMENT", "no element with that id", { elementId });
  }
  return index;
}

function withElement(
  doc: ProfileDocument,
  elementId: string,
  change: (element: ElementSpec) => ElementSpec,
): ProfileDocument {
  const index = elementIndex(doc, elementId);
  const elements = [...doc.elements];
  elements[index] = change(elements[index] as ElementSpec);
  return { ...doc, elements };
}

function checkFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    throw new GeometryError("GEOM_INVALID_NUMBER", `${what} must be finite`, { value });
  }
}

/**
 * Which anchor fields the element-level parameters own, as a field list.
 *
 * The decision itself lives in `derivedAnchorFields` in `element.ts`, next
 * to the resolver that does the overwriting; this only translates it into
 * the shape the patch check wants. `resolveElement` recomputes these, so a
 * patch to one of them would be accepted, stored, and then silently
 * ignored by the renderer. Rejecting the patch and pointing at the
 * parameter that does own the field is the only honest answer.
 */
function derivedFields(element: ElementSpec, anchorIndex: number): readonly (keyof Anchor)[] {
  const derived = derivedAnchorFields(element.anchors, anchorIndex);
  const fields: (keyof Anchor)[] = [];
  if (derived.position) fields.push("x", "y");
  if (derived.phi) fields.push("phi");
  if (derived.radius) fields.push("R");
  return fields;
}

/**
 * Reject a value that `resolveElement` would later refuse to build with.
 *
 * `edit.ts` promises that anything it accepts is renderable. Without this
 * the promise was false: a typed `R` of 0 or a negative arm was stored
 * happily and then threw out of the renderer, which in a React tree means
 * the editor unmounts with the bad value already committed to state, so
 * the user cannot even undo it. Found by review of commit d8d681b.
 */
function checkAnchorValue(field: keyof Anchor, value: number): void {
  if (field === "R") {
    if (value === 0) {
      throw new GeometryError(
        "GEOM_SHARP_CORNER_UNSUPPORTED",
        "R = 0 means a sharp corner, which Phase 1 cannot represent (see BL-07)",
        { field },
      );
    }
    // Infinity is a curvature-free transition, which is meaningful.
    if (!Number.isFinite(value) && value !== Infinity && value !== -Infinity) {
      throw new GeometryError("GEOM_INVALID_NUMBER", "R must be a number or Infinity", {
        value,
      });
    }
    return;
  }
  checkFinite(value, String(field));
  if ((field === "Lin" || field === "Lout") && value < MIN_ARM_LENGTH) {
    throw new GeometryError(
      "GEOM_ZERO_ARM",
      `${String(field)} must be at least ${MIN_ARM_LENGTH}`,
      { value },
    );
  }
}

/** The element-level parameter that owns a derived anchor field, for the error message. */
const OWNER_OF: Readonly<Record<string, string>> = {
  "0.x": "the chord normalisation",
  "0.y": "teThickness",
  "0.phi": "departureAngle and wedgeAngle",
  "last.x": "the chord normalisation",
  "last.y": "teThickness",
  "last.phi": "departureAngle and wedgeAngle",
  "le.phi": "leAxisAngle",
  "le.R": "leRadius",
};

function ownerKey(element: ElementSpec, anchorIndex: number, field: string): string {
  const last = element.anchors.length - 1;
  if (anchorIndex === 0) return `0.${field}`;
  if (anchorIndex === last) return `last.${field}`;
  return `le.${field}`;
}

/**
 * Patch any subset of an anchor's fields.
 *
 * A drag passes `{ x, y }`, a number field passes `{ R }`, and both arrive
 * here. `R` may be `Infinity`; every other field must be finite.
 *
 * Throws `GEOM_DERIVED_FIELD` for a field an element-level parameter owns,
 * naming the parameter that does.
 */
export function setAnchor(
  doc: ProfileDocument,
  elementId: string,
  anchorIndex: number,
  patch: Partial<Anchor>,
): ProfileDocument {
  return withElement(doc, elementId, (element) => {
    const anchor = element.anchors[anchorIndex];
    if (anchor === undefined) {
      throw new GeometryError("GEOM_NO_SUCH_ANCHOR", "no anchor at that index", {
        elementId,
        anchorIndex,
        count: element.anchors.length,
      });
    }

    const derived = derivedFields(element, anchorIndex);
    for (const field of Object.keys(patch) as (keyof Anchor)[]) {
      if (derived.includes(field)) {
        throw new GeometryError(
          "GEOM_DERIVED_FIELD",
          `${String(field)} of this anchor is derived from ${
            OWNER_OF[ownerKey(element, anchorIndex, String(field))] ?? "an element parameter"
          }; change that instead`,
          { elementId, anchorIndex, field: String(field) },
        );
      }
      const value = patch[field];
      if (value === undefined) continue;
      checkAnchorValue(field, value);
    }

    const anchors = [...element.anchors];
    anchors[anchorIndex] = { ...anchor, ...patch };

    // The leading edge is whichever anchor has the smallest x, so a move
    // can hand the role to a different anchor - and then the element-level
    // nose parameters start rewriting THAT anchor's tangent and radius.
    // Measured before this guard: dragging the nose from x = 0 to x = 0.5
    // replaced anchor 1's stored R of 0.9 with 0.02 and moved the contour
    // by 2.1e-1 chord, silently. A drag on one anchor must not rewrite
    // another. Found by review of commit d8d681b.
    const leBefore = leadingEdgeIndex(element.anchors);
    const leAfter = leadingEdgeIndex(anchors);
    if (leBefore !== leAfter) {
      throw new GeometryError(
        "GEOM_LEADING_EDGE_MOVED",
        "this move would make a different anchor the leading edge, which would rewrite its tangent and radius",
        { elementId, anchorIndex, leadingEdgeBefore: leBefore, leadingEdgeAfter: leAfter },
      );
    }

    return { ...element, anchors };
  });
}

/**
 * Set one element-level scalar.
 *
 * The range checks are here for the same reason as the anchor ones: what
 * this module accepts, the renderer must be able to build.
 */
export function setElementParam(
  doc: ProfileDocument,
  elementId: string,
  key: ElementParamKey,
  value: number,
): ProfileDocument {
  checkFinite(value, key);
  if (key === "leRadius") {
    if (value === 0) {
      throw new GeometryError(
        "GEOM_SHARP_CORNER_UNSUPPORTED",
        "a leading edge radius of 0 is a cusp, which Phase 1 cannot represent (see BL-07)",
        { value },
      );
    }
    if (value < 0) {
      throw new GeometryError(
        "GEOM_INVALID_NUMBER",
        "the leading edge radius is a positive radius; a negative one would turn the nose inside out",
        { value },
      );
    }
  }
  if (key === "teThickness" && value < 0) {
    throw new GeometryError(
      "GEOM_INVALID_NUMBER",
      "the trailing edge thickness cannot be negative; it would cross the two anchors over",
      { value },
    );
  }
  return withElement(doc, elementId, (element) => ({ ...element, [key]: value }));
}

/** Patch any subset of an element's placement. */
export function setPlacement(
  doc: ProfileDocument,
  elementId: string,
  patch: Partial<Placement>,
): ProfileDocument {
  if (patch.chord !== undefined) checkFinite(patch.chord, "chord");
  if (patch.chordAngle !== undefined) checkFinite(patch.chordAngle, "chordAngle");
  if (patch.le !== undefined) {
    checkFinite(patch.le.x, "le.x");
    checkFinite(patch.le.y, "le.y");
  }
  return withElement(doc, elementId, (element) => ({
    ...element,
    placement: { ...element.placement, ...patch },
  }));
}

/** Set the degree of one segment. */
export function setSegmentDegree(
  doc: ProfileDocument,
  elementId: string,
  segmentIndex: number,
  degree: number,
): ProfileDocument {
  if (!Number.isInteger(degree) || degree < MIN_SEGMENT_DEGREE) {
    throw new GeometryError(
      "GEOM_DEGREE_TOO_LOW",
      `segment degree must be an integer >= ${MIN_SEGMENT_DEGREE}`,
      { degree },
    );
  }
  return withElement(doc, elementId, (element) => {
    if (segmentIndex < 0 || segmentIndex >= element.anchors.length - 1) {
      throw new GeometryError("GEOM_NO_SUCH_SEGMENT", "no segment at that index", {
        segmentIndex,
      });
    }
    const degrees =
      element.segmentDegrees.length === element.anchors.length - 1
        ? [...element.segmentDegrees]
        : new Array<number>(element.anchors.length - 1).fill(DEFAULT_SEGMENT_DEGREE);
    degrees[segmentIndex] = degree;
    return { ...element, segmentDegrees: degrees };
  });
}

/**
 * Insert an anchor at parameter `t` inside segment `segmentIndex`.
 *
 * The new anchor sits exactly on the current curve: its position, tangent
 * and curvature radius are read from the curve at that parameter.
 *
 * The arm lengths follow de Casteljau subdivision rather than a rule of
 * thumb. Splitting a Bezier at `t` gives a left sub-curve whose derivative
 * is `t` times the original's and a right sub-curve whose derivative is
 * `1 - t` times it, so:
 *
 * - the new anchor gets `Lin = t * |B'(t)| / n` and
 *   `Lout = (1 - t) * |B'(t)| / n`;
 * - the anchor before it has its `Lout` scaled by `t`;
 * - the anchor after it has its `Lin` scaled by `1 - t`.
 *
 * Leaving the neighbours alone is the obvious implementation and it is
 * wrong: their arms were sized for the whole original segment and overshoot
 * into the halves. Measured on the ladder preset, the naive version moved
 * the contour by 1.2e-2 chord; with the neighbours scaled it is 8.6e-4,
 * a factor of 14.
 *
 * It is still not exact, because the interior control points are rebuilt
 * from the G2 rules rather than taken from the subdivided polygon. Exactness
 * is not available here: the anchor model has fewer degrees of freedom than
 * a free control polygon, which is the whole point of it.
 */
export function insertAnchor(
  doc: ProfileDocument,
  elementId: string,
  segmentIndex: number,
  t: number,
): ProfileDocument {
  return withElement(doc, elementId, (element) => {
    const segmentCount = element.anchors.length - 1;
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= segmentCount) {
      throw new GeometryError("GEOM_NO_SUCH_SEGMENT", "no segment at that index", {
        segmentIndex,
        segmentCount,
      });
    }
    if (!Number.isFinite(t) || t <= 0 || t >= 1) {
      throw new GeometryError(
        "GEOM_INVALID_NUMBER",
        "the insertion parameter must lie strictly inside the segment",
        { t },
      );
    }

    const resolved = resolveElement(element);
    const at = evaluateChain(resolved, segmentIndex + t);

    const before = element.anchors[segmentIndex] as Anchor;
    const after = element.anchors[segmentIndex + 1] as Anchor;

    const segment = resolved.segments[segmentIndex] as BezierSegment;
    const n = degree(segment);
    const speed = length(firstDerivative(segment, t));

    const armIn = (t * speed) / n;
    const armOut = ((1 - t) * speed) / n;
    if (armIn < MIN_ARM_LENGTH || armOut < MIN_ARM_LENGTH) {
      throw new GeometryError(
        "GEOM_ZERO_ARM",
        "the insertion parameter is so close to an end that one arm would collapse",
        { t, armIn, armOut },
      );
    }

    const inserted: Anchor = {
      x: at.point.x,
      y: at.point.y,
      phi: Math.atan2(at.tangent.y, at.tangent.x),
      // kappa of exactly 0 is a straight point, which is R = Infinity.
      R: at.kappa === 0 ? Infinity : 1 / at.kappa,
      Lin: armIn,
      Lout: armOut,
    };

    const anchors = [...element.anchors];
    // The neighbours' arms were sized for the whole original segment.
    anchors[segmentIndex] = { ...before, Lout: before.Lout * t };
    anchors[segmentIndex + 1] = { ...after, Lin: after.Lin * (1 - t) };
    anchors.splice(segmentIndex + 1, 0, inserted);

    const oldDegrees =
      element.segmentDegrees.length === segmentCount
        ? element.segmentDegrees
        : new Array<number>(segmentCount).fill(DEFAULT_SEGMENT_DEGREE);
    const degrees = [...oldDegrees];
    // The split segment becomes two segments of the same degree.
    degrees.splice(segmentIndex + 1, 0, oldDegrees[segmentIndex] as number);

    return { ...element, anchors, segmentDegrees: degrees };
  });
}

/**
 * Remove an anchor.
 *
 * The leading edge anchor and the two trailing edge anchors cannot go: the
 * model is defined in terms of all three.
 *
 * The neighbours' arms are scaled back up, which is what makes this the
 * inverse of `insertAnchor` rather than merely its opposite. The split
 * parameter is recoverable from the departing anchor itself: the insert set
 * `Lin = t * s / n` and `Lout = (1 - t) * s / n`, so
 * `t = Lin / (Lin + Lout)` whatever `s` and `n` were. Without this the
 * neighbours keep the shortened arms the split gave them and the contour
 * sags: measured on the ladder preset, 7.9e-3 chord without the rescale
 * against round-off with it, at every split parameter from 0.001 to 0.999.
 *
 * For an anchor a user placed by hand rather than by splitting, the same
 * formula is still the right shape of answer - it restores arms in
 * proportion to how the departing anchor divided its neighbours - but it is
 * a heuristic there, so the RESULT is capped at `MAX_ARM_LENGTH` to keep a
 * lopsided anchor from throwing an arm across the whole chord. Capping the
 * result rather than the growth factor is what keeps the inverse exact: the
 * restored arm is the arm the split shortened, and that was already legal.
 */
export function deleteAnchor(
  doc: ProfileDocument,
  elementId: string,
  anchorIndex: number,
): ProfileDocument {
  return withElement(doc, elementId, (element) => {
    if (element.anchors[anchorIndex] === undefined) {
      throw new GeometryError("GEOM_NO_SUCH_ANCHOR", "no anchor at that index", {
        anchorIndex,
      });
    }
    const last = element.anchors.length - 1;
    const le = leadingEdgeIndex(element.anchors);
    if (anchorIndex === 0 || anchorIndex === last || anchorIndex === le) {
      throw new GeometryError(
        "GEOM_ANCHOR_REQUIRED",
        "the leading edge anchor and both trailing edge anchors are part of the model",
        { anchorIndex, leadingEdgeIndex: le, last },
      );
    }

    const departing = element.anchors[anchorIndex] as Anchor;
    const before = element.anchors[anchorIndex - 1] as Anchor;
    const after = element.anchors[anchorIndex + 1] as Anchor;
    const armSum = departing.Lin + departing.Lout;
    const split = armSum > 0 ? departing.Lin / armSum : 0.5;
    const growBefore = 1 / Math.max(split, Number.MIN_VALUE);
    const growAfter = 1 / Math.max(1 - split, Number.MIN_VALUE);

    const rescaled = [...element.anchors];
    rescaled[anchorIndex - 1] = {
      ...before,
      Lout: Math.min(before.Lout * growBefore, MAX_ARM_LENGTH),
    };
    rescaled[anchorIndex + 1] = {
      ...after,
      Lin: Math.min(after.Lin * growAfter, MAX_ARM_LENGTH),
    };

    const anchors = rescaled.filter((_, i) => i !== anchorIndex);
    const segmentCount = element.anchors.length - 1;
    const oldDegrees =
      element.segmentDegrees.length === segmentCount
        ? element.segmentDegrees
        : new Array<number>(segmentCount).fill(DEFAULT_SEGMENT_DEGREE);
    // The two segments either side of the anchor become one. Keep the
    // higher of the two degrees, so removing an anchor never reduces the
    // shape control that is left.
    const merged = Math.max(
      oldDegrees[anchorIndex - 1] as number,
      oldDegrees[anchorIndex] as number,
    );
    const degrees = [...oldDegrees];
    degrees.splice(anchorIndex - 1, 2, merged);

    return { ...element, anchors, segmentDegrees: degrees };
  });
}

/** Copy an element, placing the copy directly after the original. */
export function duplicateElement(
  doc: ProfileDocument,
  elementId: string,
  newId: string,
): ProfileDocument {
  const index = elementIndex(doc, elementId);
  if (doc.elements.some((e) => e.id === newId)) {
    throw new GeometryError("GEOM_DUPLICATE_ID", "an element with that id already exists", {
      newId,
    });
  }
  const source = doc.elements[index] as ElementSpec;
  const copy: ElementSpec = {
    ...source,
    id: newId,
    name: `${source.name} copy`,
    placement: { ...source.placement, le: { ...source.placement.le } },
    anchors: source.anchors.map((a) => ({ ...a })),
    segmentDegrees: [...source.segmentDegrees],
  };
  const elements = [...doc.elements];
  elements.splice(index + 1, 0, copy);
  return { ...doc, elements };
}

/** Remove an element. The document always keeps at least one. */
export function removeElement(doc: ProfileDocument, elementId: string): ProfileDocument {
  const index = elementIndex(doc, elementId);
  if (doc.elements.length === 1) {
    throw new GeometryError("GEOM_LAST_ELEMENT", "a document keeps at least one element", {
      elementId,
    });
  }
  return { ...doc, elements: doc.elements.filter((_, i) => i !== index) };
}

/**
 * Move an element to a new position in the list.
 *
 * The target index is clamped rather than rejected: dragging a row past the
 * end of a list is an ordinary gesture, not an error.
 */
export function moveElement(
  doc: ProfileDocument,
  elementId: string,
  toIndex: number,
): ProfileDocument {
  const from = elementIndex(doc, elementId);
  const to = Math.min(Math.max(Math.round(toIndex), 0), doc.elements.length - 1);
  if (to === from) return doc;
  const elements = [...doc.elements];
  const [moved] = elements.splice(from, 1);
  elements.splice(to, 0, moved as ElementSpec);
  return { ...doc, elements };
}

/** Rename an element. */
export function renameElement(
  doc: ProfileDocument,
  elementId: string,
  name: string,
): ProfileDocument {
  return withElement(doc, elementId, (element) => ({ ...element, name }));
}
