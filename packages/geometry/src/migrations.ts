/**
 * Schema migrations.
 *
 * Golden rule G8: bumping `CURRENT_SCHEMA_VERSION` without adding a step
 * here and a fixture test for the previous version is not allowed. Saved
 * profiles must never break.
 *
 * The machinery exists from version 1 on purpose, even though there is
 * nothing to migrate yet. Retrofitting it after the first stored file in
 * the wild is what breaks profiles.
 */

import { GeometryError } from "./errors.js";

/** One step, from `version` to `version + 1`. */
export type MigrationStep = (input: Record<string, unknown>) => Record<string, unknown>;

/**
 * Steps keyed by the version they migrate FROM.
 *
 * A step is append-only: once it has shipped it is never edited, because a
 * file written by an old build still has to travel through exactly the same
 * path it was designed for.
 */
export const MIGRATIONS: ReadonlyMap<number, MigrationStep> = new Map<number, MigrationStep>([
  // 1 -> 2 goes here when the schema first changes. Example shape:
  // [1, (input) => ({ ...input, schemaVersion: 2, newField: defaultValue })],
]);

/** The highest version this build understands. Derived, never hand-maintained. */
export function latestVersion(): number {
  let highest = 1;
  for (const from of MIGRATIONS.keys()) {
    if (from + 1 > highest) highest = from + 1;
  }
  return highest;
}

/**
 * Migrate a raw parsed value up to the current version.
 *
 * Throws `SCHEMA_UNKNOWN_VERSION` when the file is newer than this build,
 * because guessing at a shape we do not know is how a plausible wrong
 * profile gets drawn. Throws `SCHEMA_MIGRATION_FAILED` when a step itself
 * throws, with the step that failed in the detail.
 */
export function migrateToCurrent(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GeometryError("SCHEMA_MALFORMED", "a document must be an object", {
      got: typeof value,
    });
  }
  let current = { ...(value as Record<string, unknown>) };
  const target = latestVersion();

  const rawVersion = current["schemaVersion"];
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw new GeometryError("SCHEMA_MALFORMED", "schemaVersion must be a positive integer", {
      got: rawVersion,
    });
  }
  if (rawVersion > target) {
    throw new GeometryError(
      "SCHEMA_UNKNOWN_VERSION",
      "this file was written by a newer build",
      { fileVersion: rawVersion, supported: target },
    );
  }

  let version = rawVersion;
  while (version < target) {
    const step = MIGRATIONS.get(version);
    if (step === undefined) {
      throw new GeometryError("SCHEMA_MIGRATION_FAILED", "no migration step for this version", {
        from: version,
        to: version + 1,
      });
    }
    try {
      current = step(current);
    } catch (cause) {
      throw new GeometryError("SCHEMA_MIGRATION_FAILED", "a migration step threw", {
        from: version,
        to: version + 1,
        cause: String(cause),
      });
    }
    version += 1;
    current["schemaVersion"] = version;
  }

  return current;
}
