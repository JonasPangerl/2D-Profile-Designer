/**
 * Built-in starting points.
 *
 * The ladder preset is the one the specification names: a leading edge
 * anchor, one mid anchor per side, and the trailing edge pair. It is the
 * shape of the classic r / p1..p5 parametrisation.
 */

import { DEFAULT_SEGMENT_DEGREE } from "./constants.js";
import {
  nacaDepartureAngle,
  nacaLeadingEdgeRadius,
  nacaWedgeAngle,
  parseNaca4,
} from "./naca.js";
import { CURRENT_SCHEMA_VERSION } from "./schema.js";
import type { ProfileDocument } from "./schema.js";
import type { Anchor, ElementSpec } from "./types.js";

export interface LadderOptions {
  readonly id?: string;
  readonly name?: string;
  /** Curvature radius at the nose, chord-normalised. */
  readonly leRadius?: number;
  /** Vertical offset of the two trailing edge anchors. */
  readonly teThickness?: number;
  /** Mean of the two trailing edge tangents, radians. */
  readonly departureAngle?: number;
  /** Difference of the two trailing edge tangents, radians. */
  readonly wedgeAngle?: number;
  /** Chordwise position of the two mid anchors. */
  readonly midPosition?: number;
  /** Half thickness at the mid anchors. */
  readonly midHalfThickness?: number;
  /** Curvature radius at the mid anchors. */
  readonly midRadius?: number;
  /** Arm length used at the mid and trailing edge anchors. */
  readonly arm?: number;
  /**
   * Arm length at the leading edge anchor. Defaults to half the nose
   * radius, because the normal offset grows as `L^2 / R`: an arm that is
   * long compared with the radius throws the third control point past the
   * nose and the contour loops back on itself.
   */
  readonly leArm?: number;
  readonly segmentDegree?: number;
}

/**
 * A symmetric five-anchor element.
 *
 * The mid anchors get a horizontal tangent, which is the usual starting
 * point: the surface is at its thickest there, so the slope is zero. Every
 * value is a plausible default, not a fitted one; the editor exists to
 * change them.
 */
export function ladderElement(options: LadderOptions = {}): ElementSpec {
  const leRadius = options.leRadius ?? 0.02;
  const teThickness = options.teThickness ?? 0.004;
  const departureAngle = options.departureAngle ?? 0;
  const wedgeAngle = options.wedgeAngle ?? 0.22;
  const midPosition = options.midPosition ?? 0.3;
  const midHalfThickness = options.midHalfThickness ?? 0.06;
  const midRadius = options.midRadius ?? 0.9;
  const arm = options.arm ?? 0.18;
  const leArm = options.leArm ?? leRadius / 2;
  const degree = options.segmentDegree ?? DEFAULT_SEGMENT_DEGREE;

  // The trailing edge anchors are overwritten by `resolveAnchors` from the
  // element-level parameters; the values here are the same ones, so that a
  // stored document and its resolved form agree and `validateElement`
  // reports nothing.
  const tePressure = departureAngle + wedgeAngle / 2;
  const teSuction = departureAngle - wedgeAngle / 2;

  const anchors: Anchor[] = [
    {
      x: 1,
      y: -teThickness / 2,
      phi: tePressure + Math.PI,
      R: Infinity,
      Lin: arm,
      Lout: arm,
    },
    // Travelling towards the nose along the pressure side: phi points in -x.
    { x: midPosition, y: -midHalfThickness, phi: Math.PI, R: midRadius, Lin: arm, Lout: arm },
    { x: 0, y: 0, phi: Math.PI / 2, R: leRadius, Lin: leArm, Lout: leArm },
    // Travelling away from the nose along the suction side: phi points in +x.
    { x: midPosition, y: midHalfThickness, phi: 0, R: midRadius, Lin: arm, Lout: arm },
    { x: 1, y: teThickness / 2, phi: teSuction, R: Infinity, Lin: arm, Lout: arm },
  ];

  return {
    id: options.id ?? "element-1",
    name: options.name ?? "Element 1",
    placement: { le: { x: 0, y: 0 }, chord: 1, chordAngle: 0 },
    leAxisAngle: 0,
    teThickness,
    departureAngle,
    wedgeAngle,
    leRadius,
    anchors,
    segmentDegrees: new Array<number>(anchors.length - 1).fill(degree),
  };
}

/**
 * A ladder element whose edge parameters come from a NACA 4-digit code.
 *
 * This is a starting estimate, not a fit. The fit (M5) is what makes a
 * Bezier chain match a published profile to tolerance; this only gets the
 * nose radius and the trailing edge angles right, which is exactly what the
 * fit wants as its initial guess.
 */
export function ladderFromNaca(code: string, options: LadderOptions = {}): ElementSpec {
  const spec = parseNaca4(code);
  return ladderElement({
    ...options,
    name: options.name ?? `NACA ${code}`,
    leRadius: options.leRadius ?? nacaLeadingEdgeRadius(spec.thickness),
    wedgeAngle: options.wedgeAngle ?? nacaWedgeAngle(spec),
    departureAngle: options.departureAngle ?? nacaDepartureAngle(spec),
    midHalfThickness: options.midHalfThickness ?? spec.thickness / 2,
    midPosition: options.midPosition ?? 0.3,
  });
}

/** Wrap elements into a document with sensible metadata. */
export function createDocument(
  elements: readonly ElementSpec[],
  name = "Untitled",
  now = "1970-01-01T00:00:00.000Z",
): ProfileDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    elements,
    ground: { enabled: false, rideHeight: 0.1 },
    meta: { created: now, modified: now, notes: "" },
  };
}

/** The default document a fresh editor session starts from. */
export function defaultDocument(now?: string): ProfileDocument {
  return createDocument([ladderElement()], "Untitled", now);
}
