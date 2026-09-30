# Logging conventions

This is a browser tool with no backend. Logging exists for two readers: the
developer with the console open, and the owner pasting a console dump into a
bug report. Nothing is sent anywhere.

## Levels

| Level | When |
|---|---|
| `error` | The operation failed and the user sees a failure. Always carries an error code. |
| `warn` | The operation continued but the result may not be what the user wanted (a fit that hit the iteration cap, a curvature sign change on the suction side, a `.dat` file whose format detection was ambiguous). |
| `info` | A state change worth reconstructing later: a document loaded, a fit started and finished, a schema migration ran. |
| `debug` | Off by default. Turned on with `?log=debug` in the URL. |

`console.log` does not appear in committed code. Use the logger.

## The logger

`packages/ui/src/log.ts` exports one logger. `packages/geometry` does **not**
log at all: it is pure (golden rule G4) and reports problems by returning a
result or throwing a typed error. The caller decides whether that is worth a
log line.

## Structured fields

Every line is a message plus one flat object. No string interpolation of
values into the message, because that makes the lines ungreppable.

```ts
log.warn("fit hit the iteration cap", {
  code: "FIT_MAX_ITER",
  elementId,
  iterations: 200,
  residual: 3.1e-3,
});
```

Standard fields, used whenever they apply: `code`, `elementId`, `anchorIndex`,
`schemaVersion`, `durationMs`.

## Error codes

Stable, greppable, `SCREAMING_SNAKE`, prefixed by area. A code is never
reused for a different meaning and never renamed once it has shipped.

| Code | Meaning |
|---|---|
| `GEOM_ZERO_ARM` | An arm length of 0 was passed to the chain builder |
| `GEOM_DEGREE_TOO_LOW` | A segment degree below 4 was requested where both ends need curvature control |
| `GEOM_OPEN_CHAIN` | The chain did not close at the trailing edge |
| `SCHEMA_UNKNOWN_VERSION` | `schemaVersion` is newer than this build knows |
| `SCHEMA_MIGRATION_FAILED` | A migration function threw |
| `DAT_AMBIGUOUS_FORMAT` | Selig and Lednicer detection disagreed |
| `DAT_MALFORMED` | A coordinate line could not be parsed |
| `FIT_MAX_ITER` | Levenberg-Marquardt hit the iteration cap |
| `FIT_DIVERGED` | The residual grew over a whole restart cycle |

Adding a code means adding a row here in the same commit.

## What is never logged

- Full document contents. Log the element id and the schema version, not the
  anchors.
- Anything in a tight loop. A per-iteration line in the fit is `debug` only,
  and the summary line at the end is `info`.
- The name of any third-party product (golden rule G12).
