/**
 * Phase 2 seam: the worker interface, as a stub.
 *
 * Nothing here computes anything yet. It exists so that the shape of the
 * boundary is fixed while the geometry side is still cheap to change, and
 * so that the sampler's output is already the panelisation the solver will
 * consume (docs/spec/README.md, "the interface for it is provided for now").
 *
 * The clean physics reference for the implementation is the MIT-licensed one
 * named in docs/spec/11-references.md. The GPL one named there must not be
 * used.
 */

import type { CurvePoint, ProfileDocument } from "@foil/geometry";

/** One panelised element handed to the solver. */
export interface PanelisedElement {
  readonly elementId: string;
  /** World-space contour, in the order the sampler produced it. */
  readonly points: readonly CurvePoint[];
}

/** Everything the solver needs for one operating point. */
export interface SolveRequest {
  readonly doc: ProfileDocument;
  readonly panels: readonly PanelisedElement[];
  /** Angle of attack, radians. */
  readonly alpha: number;
  /** Reynolds number. Ignored while only the inviscid part exists. */
  readonly reynolds: number;
  /** Ground plane handling, from `doc.ground`, resolved to a distance. */
  readonly rideHeight: number | null;
}

/** What comes back. Every field is optional until the matching physics exists. */
export interface SolveResult {
  readonly elementId: string;
  /** Pressure coefficient per panel, in the same order as the request. */
  readonly cp?: readonly number[];
  readonly cl?: number;
  readonly cd?: number;
  readonly cm?: number;
  /** Set when the result is inviscid only, so the UI can say drag is not physical. */
  readonly inviscidOnly: boolean;
}

/** The message a worker receives. */
export type SolverMessage = { readonly kind: "solve"; readonly request: SolveRequest };

/** The message a worker sends back. */
export type SolverReply =
  | { readonly kind: "result"; readonly results: readonly SolveResult[] }
  | { readonly kind: "error"; readonly code: string; readonly message: string };

/**
 * Placeholder. Throws rather than returning zeros, because a plausible wrong
 * number is worse than a crash.
 */
export function solve(_request: SolveRequest): never {
  throw new Error("SOLVER_NOT_IMPLEMENTED: the solver is Phase 2 and not built yet");
}
