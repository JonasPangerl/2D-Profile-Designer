/**
 * Assembling a whole element: derived fields, then the chain of segments.
 *
 * The chain runs from the trailing edge on the pressure side, over the nose,
 * to the trailing edge on the suction side. See docs/spec/01-geometry.md.
 */

import { DEFAULT_SEGMENT_DEGREE, POSITION_EPS } from "./constants.js";
import { GeometryError } from "./errors.js";
import { buildSegment } from "./anchors.js";
import type { Anchor, BezierSegment, ElementSpec, ResolvedElement } from "./types.js";

/**
 * Index of the leading-edge anchor: the one with the smallest `x`.
 *
 * Derived rather than stored, so it cannot drift out of step with the
 * anchors. Ties go to the first, which only happens on a degenerate chain.
 */
export function leadingEdgeIndex(anchors: readonly Anchor[]): number {
  if (anchors.length < 3) {
    throw new GeometryError(
      "GEOM_TOO_FEW_ANCHORS",
      "an element needs at least a trailing edge pair and a leading edge anchor",
      { count: anchors.length },
    );
  }
  let best = 0;
  for (let i = 1; i < anchors.length; i += 1) {
    if ((anchors[i] as Anchor).x < (anchors[best] as Anchor).x) best = i;
  }
  return best;
}

/** Which of an anchor's fields the element-level parameters own. */
export interface DerivedAnchorFields {
  /** `x` and `y` are fixed by the chord normalisation and `teThickness`. */
  readonly position: boolean;
  /** `phi` is fixed by `leAxisAngle`, or by `departureAngle` and `wedgeAngle`. */
  readonly phi: boolean;
  /** `R` is fixed by `leRadius`. */
  readonly radius: boolean;
}

/**
 * The single declaration of which anchor fields are derived.
 *
 * `resolveAnchors` below recomputes exactly these; `edit.ts` refuses to
 * patch them; the UI draws their handles as not draggable. All three ask
 * this function rather than restating the rule, because three copies of one
 * decision drift, and the drift is silent: a field a user can set, that is
 * stored, and that the renderer then ignores.
 *
 * `tests/edit-guards.test.ts` walks `resolveAnchors` field by field and
 * fails if it changes a field this function does not declare.
 */
export function derivedAnchorFields(
  anchors: readonly Anchor[],
  anchorIndex: number,
): DerivedAnchorFields {
  const last = anchors.length - 1;
  if (anchorIndex === 0 || anchorIndex === last) {
    return { position: true, phi: true, radius: false };
  }
  if (anchorIndex === leadingEdgeIndex(anchors)) {
    return { position: false, phi: true, radius: true };
  }
  return { position: false, phi: false, radius: false };
}

/**
 * The two downstream-pointing trailing-edge tangents, from the element-level
 * parameters. Their mean is `departureAngle`, their difference is
 * `wedgeAngle`.
 */
export function trailingEdgeTangents(
  departureAngle: number,
  wedgeAngle: number,
): { suction: number; pressure: number } {
  return {
    suction: departureAngle - wedgeAngle / 2,
    pressure: departureAngle + wedgeAngle / 2,
  };
}

/**
 * Apply the derived fields to the stored anchors.
 *
 * One door per concern: the trailing-edge positions and tangents, and the
 * leading-edge tangent and radius, are computed from the element-level
 * parameters and the stored values are ignored. `validateElement` reports
 * any stored value that disagrees.
 */
export function resolveAnchors(spec: ElementSpec): {
  anchors: Anchor[];
  leIndex: number;
} {
  const stored = spec.anchors;
  const leIndex = leadingEdgeIndex(stored);
  const last = stored.length - 1;
  const te = trailingEdgeTangents(spec.departureAngle, spec.wedgeAngle);

  const anchors = stored.map((a, i) => {
    if (i === 0) {
      // Leaving the trailing edge towards the nose: the travel direction is
      // the downstream tangent turned around.
      return { ...a, x: 1, y: -spec.teThickness / 2, phi: te.pressure + Math.PI };
    }
    if (i === last) {
      return { ...a, x: 1, y: spec.teThickness / 2, phi: te.suction };
    }
    if (i === leIndex) {
      return { ...a, phi: spec.leAxisAngle + Math.PI / 2, R: spec.leRadius };
    }
    return { ...a };
  });

  return { anchors, leIndex };
}

/** A disagreement between a stored anchor field and the element-level parameter it duplicates. */
export interface ValidationIssue {
  readonly anchorIndex: number;
  readonly field: string;
  readonly stored: number;
  readonly derived: number;
}

/**
 * Report stored anchor fields that disagree with the derived ones.
 *
 * This never throws and never changes anything. It exists so the UI can
 * surface a document that was hand-edited into an inconsistent state,
 * instead of silently redrawing something else.
 */
export function validateElement(spec: ElementSpec): ValidationIssue[] {
  const { anchors } = resolveAnchors(spec);
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < anchors.length; i += 1) {
    const derived = anchors[i] as Anchor;
    const stored = spec.anchors[i] as Anchor;
    for (const field of ["x", "y", "phi", "R"] as const) {
      const a = stored[field];
      const b = derived[field];
      if (a === b) continue;
      if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= POSITION_EPS) continue;
      issues.push({ anchorIndex: i, field, stored: a, derived: b });
    }
  }
  return issues;
}

/**
 * Build the full chain of Bezier segments for an element.
 *
 * `segmentDegrees` must have exactly `anchors.length - 1` entries; an empty
 * array is accepted and means "the default degree everywhere", which keeps
 * hand-written fixtures short.
 */
export function resolveElement(spec: ElementSpec): ResolvedElement {
  const { anchors, leIndex } = resolveAnchors(spec);
  const segmentCount = anchors.length - 1;

  let degrees: readonly number[];
  if (spec.segmentDegrees.length === 0) {
    degrees = new Array<number>(segmentCount).fill(DEFAULT_SEGMENT_DEGREE);
  } else if (spec.segmentDegrees.length === segmentCount) {
    degrees = spec.segmentDegrees;
  } else {
    throw new GeometryError(
      "GEOM_DEGREE_MISMATCH",
      "segmentDegrees must have exactly anchors.length - 1 entries",
      { expected: segmentCount, got: spec.segmentDegrees.length },
    );
  }

  const segments: BezierSegment[] = [];
  for (let i = 0; i < segmentCount; i += 1) {
    segments.push(
      buildSegment(anchors[i] as Anchor, anchors[i + 1] as Anchor, degrees[i] as number),
    );
  }

  return { spec, anchors, leIndex, segments };
}
