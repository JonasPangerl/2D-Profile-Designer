import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  defaultDocument,
  latestVersion,
  migrateToCurrent,
  parseDocument,
  parseDocumentJson,
  serialiseDocument,
  serialiseDocumentJson,
} from "../src/index.js";

/**
 * A mutable plain-object copy of the on-disk form, for the tests that
 * deliberately break a field. Going through JSON is exactly the path a real
 * file takes, so a test cannot accidentally break something JSON would not
 * have carried anyway.
 */
function raw(): Record<string, unknown> {
  return JSON.parse(serialiseDocumentJson(defaultDocument())) as Record<string, unknown>;
}

describe("round trip", () => {
  it("survives serialise and parse unchanged", () => {
    const doc = defaultDocument("2026-09-30T00:00:00.000Z");
    const back = parseDocumentJson(serialiseDocumentJson(doc));
    expect(back).toEqual(doc);
  });

  it("encodes an infinite radius as null and restores it", () => {
    const doc = defaultDocument();
    const json = serialiseDocument(doc);
    // The ladder preset has R = Infinity at both trailing edge anchors.
    expect(json.elements[0]?.anchors[0]?.R).toBe(null);
    expect(parseDocument(json).elements[0]?.anchors[0]?.R).toBe(Infinity);
  });

  it("writes indented JSON so diffs stay readable", () => {
    expect(serialiseDocumentJson(defaultDocument())).toContain("\n  ");
  });
});

describe("validation", () => {
  it("rejects a non-object", () => {
    expect(() => parseDocument(42)).toThrowError(/SCHEMA_MALFORMED/);
    expect(() => parseDocument(null)).toThrowError(/SCHEMA_MALFORMED/);
    expect(() => parseDocument([])).toThrowError(/SCHEMA_MALFORMED/);
  });

  it("rejects text that is not JSON", () => {
    expect(() => parseDocumentJson("{ not json")).toThrowError(/SCHEMA_MALFORMED/);
  });

  it("names the field that is wrong", () => {
    const doc = raw();
    const elements = doc["elements"] as { anchors: Record<string, unknown>[] }[];
    (elements[0]!.anchors[1] as Record<string, unknown>)["phi"] = "not a number";
    expect(() => parseDocument(doc)).toThrowError(/elements\[0\]\.anchors\[1\]\.phi/);
  });

  it("rejects a missing schemaVersion", () => {
    const doc = raw();
    delete doc["schemaVersion"];
    expect(() => parseDocument(doc)).toThrowError(/SCHEMA_MALFORMED/);
  });
});

describe("migrations", () => {
  it("knows the current version", () => {
    expect(latestVersion()).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("passes a current document through unchanged", () => {
    const doc = raw();
    expect(migrateToCurrent(doc)).toEqual(doc);
  });

  it("refuses a file from a newer build instead of guessing", () => {
    const doc = raw();
    doc["schemaVersion"] = CURRENT_SCHEMA_VERSION + 1;
    expect(() => migrateToCurrent(doc)).toThrowError(/SCHEMA_UNKNOWN_VERSION/);
  });

  it("refuses a version below 1", () => {
    const doc = raw();
    doc["schemaVersion"] = 0;
    expect(() => migrateToCurrent(doc)).toThrowError(/SCHEMA_MALFORMED/);
  });
});
