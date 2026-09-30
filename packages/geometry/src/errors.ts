/**
 * Typed errors. The geometry core does not log (golden rule G4); it throws a
 * `GeometryError` carrying a stable code and lets the caller decide whether
 * that is worth a log line.
 *
 * Codes are listed in LOGGING.md. A code is never reused for a different
 * meaning and never renamed once it has shipped.
 */

export type GeometryErrorCode =
  | "GEOM_ZERO_ARM"
  | "GEOM_DEGREE_TOO_LOW"
  | "GEOM_DEGREE_MISMATCH"
  | "GEOM_SHARP_CORNER_UNSUPPORTED"
  | "GEOM_DEGENERATE_SEGMENT"
  | "GEOM_TOO_FEW_ANCHORS"
  | "GEOM_INVALID_NUMBER"
  | "SCHEMA_UNKNOWN_VERSION"
  | "SCHEMA_MIGRATION_FAILED"
  | "SCHEMA_MALFORMED";

export class GeometryError extends Error {
  readonly code: GeometryErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(
    code: GeometryErrorCode,
    message: string,
    detail: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "GeometryError";
    this.code = code;
    this.detail = detail;
  }
}

/** Throws unless `value` is a finite number. Infinity is rejected here on purpose. */
export function assertFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) {
    throw new GeometryError("GEOM_INVALID_NUMBER", `${what} must be finite`, { value });
  }
}
