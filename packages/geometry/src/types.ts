/**
 * Core geometry types.
 *
 * Units and conventions used throughout this package:
 * - Angles are radians. Degrees exist only at the UI boundary.
 * - Shape coordinates are normalised to chord length 1. Physical size lives
 *   in `Placement.chord`.
 * - `phi` is the direction of travel along the chain. The curve normal is
 *   `phi` rotated by -90 degrees, to the right of travel, and a positive
 *   `R` bends the curve towards it. That makes the curvature of a convex
 *   profile positive everywhere in the chain order below, so `R` at the
 *   nose is the plain positive radius a user expects. See `curveNormal`.
 * - The chain runs from the trailing edge on the pressure side, over the
 *   nose, to the trailing edge on the suction side.
 *
 * See docs/spec/01-geometry.md.
 */

/** A point in the plane. Chord-normalised inside a shape, physical after placement. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A joint between two Bezier segments.
 *
 * `R` is the curvature radius shared by both adjacent segments.
 * `Infinity` means a curvature-free transition. `0` means a sharp corner and
 * is rejected in Phase 1 (see docs/spec/01-geometry.md, degenerate cases).
 *
 * `Lin` and `Lout` are the arm lengths of the incoming and the outgoing
 * segment. They are free shape parameters; `R` does not determine them.
 */
export interface Anchor {
  readonly x: number;
  readonly y: number;
  readonly phi: number;
  readonly R: number;
  readonly Lin: number;
  readonly Lout: number;
}

/** Where a chord-normalised shape sits in the world. */
export interface Placement {
  readonly le: Point;
  readonly chord: number;
  readonly chordAngle: number;
}

/**
 * One element of a profile, as stored in the document.
 *
 * Some anchor fields are redundant with the element-level parameters. They
 * are recomputed by `resolveElement` and the stored values are ignored;
 * `validateElement` reports any that disagree. See docs/spec/01-geometry.md,
 * "Derived fields win over stored ones".
 */
export interface ElementSpec {
  readonly id: string;
  readonly name: string;
  readonly placement: Placement;
  /** Tilt of the reference axis the leading-edge tangent is perpendicular to. */
  readonly leAxisAngle: number;
  /** Vertical offset between the two trailing-edge anchors, chord-normalised. */
  readonly teThickness: number;
  /** Mean of the two downstream-pointing trailing-edge tangents. */
  readonly departureAngle: number;
  /** Difference between the two downstream-pointing trailing-edge tangents. */
  readonly wedgeAngle: number;
  /** Curvature radius at the leading-edge anchor, chord-normalised. */
  readonly leRadius: number;
  readonly anchors: readonly Anchor[];
  /** Exactly `anchors.length - 1` entries. */
  readonly segmentDegrees: readonly number[];
}

/** A single Bezier segment, as its control polygon. Degree is `points.length - 1`. */
export interface BezierSegment {
  readonly points: readonly Point[];
}

/** An element after the derived fields have been applied and the chain built. */
export interface ResolvedElement {
  readonly spec: ElementSpec;
  /** Anchors with the derived fields applied. */
  readonly anchors: readonly Anchor[];
  /** Index of the leading-edge anchor: the one with the smallest `x`. */
  readonly leIndex: number;
  readonly segments: readonly BezierSegment[];
}

/** A point on the curve together with everything the UI needs to draw it. */
export interface CurvePoint {
  readonly point: Point;
  /** Index into `ResolvedElement.segments`. */
  readonly segment: number;
  /** Parameter within that segment, in [0, 1]. */
  readonly t: number;
  /** Cumulative arc length from the start of the chain, chord-normalised. */
  readonly s: number;
  /** Unit tangent, direction of travel. */
  readonly tangent: Point;
  /** Unit curve normal, the tangent rotated by -90 degrees (right of travel). */
  readonly normal: Point;
  /** Signed curvature. Positive bends towards `normal`. */
  readonly kappa: number;
}

/** Gap and overlap between an element and the one in front of it. */
export interface GapOverlap {
  /** Shortest distance between the two contours, in physical units. */
  readonly gap: number;
  /** The same, as a fraction of the preceding element's chord. */
  readonly gapFraction: number;
  /**
   * Projection onto the preceding element's chord direction. Positive means
   * this element's leading edge sits upstream of the preceding element's
   * trailing edge, which is the usual sign convention for an overlap.
   */
  readonly overlap: number;
  /** The same, as a fraction of the preceding element's chord. */
  readonly overlapFraction: number;
  /** The point on this element's contour where the gap is measured. */
  readonly gapFrom: Point;
  /** The point on the preceding element's contour where the gap is measured. */
  readonly gapTo: Point;
}
