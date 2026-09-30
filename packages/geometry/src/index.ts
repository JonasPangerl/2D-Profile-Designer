/**
 * The public API of the geometry core.
 *
 * Golden rule G6: this is the only import surface. A consumer that imports
 * from a deeper path is reaching around the interface, and the lint config
 * forbids it.
 */

export type {
  Anchor,
  BezierSegment,
  CurvePoint,
  ElementSpec,
  GapOverlap,
  Placement,
  Point,
  ResolvedElement,
} from "./types.js";

export { GeometryError, assertFinite } from "./errors.js";
export type { GeometryErrorCode } from "./errors.js";

export {
  CLUSTER_SIN_FLOOR,
  DEFAULT_CURVATURE_WEIGHT,
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_SEGMENT_DEGREE,
  MAX_ARM_LENGTH,
  MIN_ARM_LENGTH,
  MIN_SEGMENT_DEGREE,
  MIN_SPEED,
  PARALLEL_EPS,
  POSITION_EPS,
} from "./constants.js";

export * as vec from "./vec.js";

export {
  arcLength,
  curvature,
  degree,
  derivativeSegment,
  evaluate,
  firstDerivative,
  secondDerivative,
  unitNormal,
  unitTangent,
} from "./bezier.js";

export { buildSegment, offsetFromRadius, radiusFromOffset } from "./anchors.js";

export {
  derivedAnchorFields,
  leadingEdgeIndex,
  resolveAnchors,
  resolveElement,
  trailingEdgeTangents,
  validateElement,
} from "./element.js";
export type { DerivedAnchorFields, ValidationIssue } from "./element.js";

export {
  buildComb,
  continuityReport,
  evaluateChain,
  facesOutward,
  findInflections,
} from "./curvature.js";
export type {
  CombOptions,
  CombScale,
  CombTooth,
  ContinuityReport,
  InflectionMarker,
} from "./curvature.js";

export {
  deleteAnchor,
  duplicateElement,
  insertAnchor,
  moveElement,
  removeElement,
  renameElement,
  setAnchor,
  setElementParam,
  setPlacement,
  setSegmentDegree,
} from "./edit.js";
export type { ElementParamKey } from "./edit.js";

export { chainLength, sampleElement } from "./sampling.js";
export type { SampleOptions } from "./sampling.js";

export {
  contourToWorld,
  gapAndOverlap,
  mirrorAtGround,
  offsetContour,
  toLocal,
  toWorld,
  trailingEdgePoint,
} from "./placement.js";

export {
  CURRENT_SCHEMA_VERSION,
  parseDocument,
  parseDocumentJson,
  serialiseDocument,
  serialiseDocumentJson,
} from "./schema.js";
export type {
  DocumentMeta,
  GroundSettings,
  JsonAnchor,
  JsonDocument,
  JsonElement,
  JsonValue,
  ProfileDocument,
} from "./schema.js";

export { MIGRATIONS, latestVersion, migrateToCurrent } from "./migrations.js";
export type { MigrationStep } from "./migrations.js";

export {
  nacaCamber,
  nacaCamberSlope,
  nacaCoordinates,
  nacaDepartureAngle,
  nacaLeadingEdgeRadius,
  nacaThickness,
  nacaWedgeAngle,
  parseNaca4,
} from "./naca.js";
export type { Naca4 } from "./naca.js";

export { createDocument, defaultDocument, ladderElement, ladderFromNaca } from "./presets.js";
export type { LadderOptions } from "./presets.js";
