/**
 * Tolerances and defaults, in one place.
 *
 * Golden rule G3 says a tolerance must be explicit and must carry its
 * reason. Every constant here does.
 */

/**
 * Two positions closer than this are the same point. Chosen at 1e-12 because
 * anchor endpoints are literally the same stored number and only floating
 * point summation separates them.
 */
export const POSITION_EPS = 1e-12;

/**
 * Below this arm length a segment has no usable tangent direction. It is an
 * error rather than a clamp, because a clamped arm silently changes the
 * shape the user asked for.
 */
export const MIN_ARM_LENGTH = 1e-9;

/**
 * Two direction vectors whose cross product is below this are parallel. Used
 * for the degree-4 control point intersection, where parallel lines mean the
 * segment cannot satisfy both curvature conditions.
 */
export const PARALLEL_EPS = 1e-10;

/**
 * Speeds below this make the curvature formula meaningless, because it
 * divides by the cubed speed. Reported as curvature 0 rather than infinity,
 * and the caller is told through the segment builder, not here.
 */
export const MIN_SPEED = 1e-12;

/** The lowest segment degree at which tangent and curvature are independent at both ends. */
export const MIN_SEGMENT_DEGREE = 4;

/** Default segment degree, per docs/spec/01-geometry.md. */
export const DEFAULT_SEGMENT_DEGREE = 4;

/** Default number of sampled points per element, per docs/spec/01-geometry.md 1.5. */
export const DEFAULT_SAMPLE_COUNT = 200;

/**
 * Sub-samples per segment used to build the arc length and density tables
 * the resampler inverts. 256 keeps the inversion error below the 1e-6 chord
 * tolerance the `.dat` round trip needs, at negligible cost.
 */
export const SEGMENT_SUBSAMPLES = 256;

/**
 * Lower bound on `sin` in the cosine clustering density. Without it the
 * density is infinite at the leading and trailing edge and all points
 * collapse there.
 */
export const CLUSTER_SIN_FLOOR = 0.05;

/**
 * How strongly curvature pulls sample points towards itself, relative to the
 * cosine clustering. 1 means a region of curvature equal to the reference
 * gets twice the density.
 */
export const DEFAULT_CURVATURE_WEIGHT = 1;

/**
 * Largest arm length `deleteAnchor` may leave behind, in chord units.
 *
 * Deleting an anchor scales its neighbours' arms back up, and for a
 * lopsided anchor the ratio heuristic would ask for an arm many times the
 * chord. So the result is capped.
 *
 * The cap is on the resulting LENGTH, not on the growth factor, and that
 * distinction matters: an earlier version capped the factor at 20, which
 * silently broke the insert-then-delete round trip for every split
 * parameter outside [0.05, 0.95] - 8.1e-3 chord at t = 0.02. Capping the
 * length cannot bite on a genuine inverse, because the restored arm is
 * exactly the arm the split shortened, and that arm was already a legal
 * value. Found by review of commit d8d681b.
 *
 * 2 chords is far beyond any sane arm and well inside the range where the
 * curve construction stays numerically sound.
 */
export const MAX_ARM_LENGTH = 2;
