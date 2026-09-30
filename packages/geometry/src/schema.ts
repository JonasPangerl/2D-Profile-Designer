/**
 * The versioned JSON document: the single truth for saving, loading,
 * comparing, and later the sweep configuration.
 *
 * See docs/spec/04-data-model.md. Golden rule G7: every feature is a
 * transformation of this document, and golden rule G8: a schema change
 * ships with its migration.
 */

import { GeometryError } from "./errors.js";
import { migrateToCurrent } from "./migrations.js";
import type { Anchor, ElementSpec, Placement } from "./types.js";

/** Bump this only together with a migration in `migrations.ts` and its test. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface DocumentMeta {
  /** ISO 8601, UTC. */
  readonly created: string;
  /** ISO 8601, UTC. */
  readonly modified: string;
  readonly notes: string;
}

export interface GroundSettings {
  readonly enabled: boolean;
  /** Distance from the ground plane to the element origin, in physical units. */
  readonly rideHeight: number;
}

export interface ProfileDocument {
  readonly schemaVersion: number;
  readonly name: string;
  readonly elements: readonly ElementSpec[];
  readonly ground: GroundSettings;
  readonly meta: DocumentMeta;
}

/**
 * The on-disk form.
 *
 * It differs from `ProfileDocument` in exactly one way: `R` is `null` where
 * the in-memory value is `Infinity`, because JSON has no infinity literal
 * (decision D4 in docs/spec/10-decisions.md).
 *
 * The on-disk types are declared with `type` rather than `interface` on
 * purpose: a type alias of an object literal is assignable to
 * `Record<string, unknown>`, which is what a caller inspecting raw JSON
 * needs. An interface is not.
 */
export type JsonAnchor = {
  readonly x: number;
  readonly y: number;
  readonly phi: number;
  readonly R: number | null;
  readonly Lin: number;
  readonly Lout: number;
};

/** One element in the on-disk form. */
export type JsonElement = {
  readonly id: string;
  readonly name: string;
  readonly placement: {
    readonly le: { readonly x: number; readonly y: number };
    readonly chord: number;
    readonly chordAngle: number;
  };
  readonly leAxisAngle: number;
  readonly teThickness: number;
  readonly departureAngle: number;
  readonly wedgeAngle: number;
  readonly leRadius: number;
  readonly anchors: readonly JsonAnchor[];
  readonly segmentDegrees: readonly number[];
};

/** The whole document in the on-disk form. */
export type JsonDocument = {
  readonly schemaVersion: number;
  readonly name: string;
  readonly elements: readonly JsonElement[];
  readonly ground: { readonly enabled: boolean; readonly rideHeight: number };
  readonly meta: {
    readonly created: string;
    readonly modified: string;
    readonly notes: string;
  };
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function fail(message: string, detail: Record<string, unknown> = {}): never {
  throw new GeometryError("SCHEMA_MALFORMED", message, detail);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${what} must be an object`, { got: typeof value });
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    fail(`${what} must be a number`, { got: value });
  }
  return value;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== "string") fail(`${what} must be a string`, { got: typeof value });
  return value;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) fail(`${what} must be an array`, { got: typeof value });
  return value;
}

function parseAnchor(value: unknown, where: string): Anchor {
  const raw = asRecord(value, where);
  const r = raw["R"];
  return {
    x: asNumber(raw["x"], `${where}.x`),
    y: asNumber(raw["y"], `${where}.y`),
    phi: asNumber(raw["phi"], `${where}.phi`),
    // null encodes Infinity: a curvature-free transition.
    R: r === null ? Infinity : asNumber(r, `${where}.R`),
    Lin: asNumber(raw["Lin"], `${where}.Lin`),
    Lout: asNumber(raw["Lout"], `${where}.Lout`),
  };
}

function parsePlacement(value: unknown, where: string): Placement {
  const raw = asRecord(value, where);
  const le = asRecord(raw["le"], `${where}.le`);
  return {
    le: { x: asNumber(le["x"], `${where}.le.x`), y: asNumber(le["y"], `${where}.le.y`) },
    chord: asNumber(raw["chord"], `${where}.chord`),
    chordAngle: asNumber(raw["chordAngle"], `${where}.chordAngle`),
  };
}

function parseElement(value: unknown, index: number): ElementSpec {
  const where = `elements[${index}]`;
  const raw = asRecord(value, where);
  const anchors = asArray(raw["anchors"], `${where}.anchors`).map((a, i) =>
    parseAnchor(a, `${where}.anchors[${i}]`),
  );
  const degrees = asArray(raw["segmentDegrees"], `${where}.segmentDegrees`).map((d, i) =>
    asNumber(d, `${where}.segmentDegrees[${i}]`),
  );
  return {
    id: asString(raw["id"], `${where}.id`),
    name: asString(raw["name"], `${where}.name`),
    placement: parsePlacement(raw["placement"], `${where}.placement`),
    leAxisAngle: asNumber(raw["leAxisAngle"], `${where}.leAxisAngle`),
    teThickness: asNumber(raw["teThickness"], `${where}.teThickness`),
    departureAngle: asNumber(raw["departureAngle"], `${where}.departureAngle`),
    wedgeAngle: asNumber(raw["wedgeAngle"], `${where}.wedgeAngle`),
    leRadius: asNumber(raw["leRadius"], `${where}.leRadius`),
    anchors,
    segmentDegrees: degrees,
  };
}

/**
 * Parse an arbitrary value into a document of the current schema version.
 *
 * Migration runs first, so every consumer only ever sees the current shape.
 * Throws `SCHEMA_MALFORMED` for a structurally wrong value and
 * `SCHEMA_UNKNOWN_VERSION` for a version this build does not know.
 */
export function parseDocument(value: unknown): ProfileDocument {
  const migrated = migrateToCurrent(value);
  const raw = asRecord(migrated, "document");
  const meta = asRecord(raw["meta"], "meta");
  const ground = asRecord(raw["ground"], "ground");
  const groundEnabled = ground["enabled"];
  if (typeof groundEnabled !== "boolean") fail("ground.enabled must be a boolean");

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: asString(raw["name"], "name"),
    elements: asArray(raw["elements"], "elements").map(parseElement),
    ground: {
      enabled: groundEnabled,
      rideHeight: asNumber(ground["rideHeight"], "ground.rideHeight"),
    },
    meta: {
      created: asString(meta["created"], "meta.created"),
      modified: asString(meta["modified"], "meta.modified"),
      notes: asString(meta["notes"], "meta.notes"),
    },
  };
}

/** Parse from a JSON string. */
export function parseDocumentJson(text: string): ProfileDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new GeometryError("SCHEMA_MALFORMED", "the file is not valid JSON", {
      cause: String(cause),
    });
  }
  return parseDocument(value);
}

function serialiseAnchor(a: Anchor): JsonAnchor {
  return {
    x: a.x,
    y: a.y,
    phi: a.phi,
    R: Number.isFinite(a.R) ? a.R : null,
    Lin: a.Lin,
    Lout: a.Lout,
  };
}

/** Serialise to the JSON-safe form. `Infinity` becomes `null` again. */
export function serialiseDocument(doc: ProfileDocument): JsonDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: doc.name,
    elements: doc.elements.map((e) => ({
      id: e.id,
      name: e.name,
      placement: {
        le: { x: e.placement.le.x, y: e.placement.le.y },
        chord: e.placement.chord,
        chordAngle: e.placement.chordAngle,
      },
      leAxisAngle: e.leAxisAngle,
      teThickness: e.teThickness,
      departureAngle: e.departureAngle,
      wedgeAngle: e.wedgeAngle,
      leRadius: e.leRadius,
      anchors: e.anchors.map(serialiseAnchor),
      segmentDegrees: [...e.segmentDegrees],
    })),
    ground: { enabled: doc.ground.enabled, rideHeight: doc.ground.rideHeight },
    meta: { created: doc.meta.created, modified: doc.meta.modified, notes: doc.meta.notes },
  };
}

/** Serialise to a JSON string with two-space indentation, so diffs stay readable. */
export function serialiseDocumentJson(doc: ProfileDocument): string {
  return JSON.stringify(serialiseDocument(doc), null, 2);
}
