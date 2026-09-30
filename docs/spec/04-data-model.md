# 04 - Data model

Versioned JSON as the single truth. Saving, loading, comparing and later the
sweep configuration all hang off it.

```ts
{
  schemaVersion: number,
  name: string,
  elements: [
    {
      id: string,
      name: string,
      placement: { le: {x, y}, chord, chordAngle },
      leAxisAngle: number,
      teThickness: number,
      departureAngle: number,
      wedgeAngle: number,
      leRadius: number,
      anchors: [ { x, y, phi, R, Lin, Lout } ],
      segmentDegrees: number[]
    }
  ],
  ground: { enabled: boolean, rideHeight: number },
  meta: { created, modified, notes }
}
```

**A migration function per schema version, from the very beginning.**
Otherwise saved profiles break on every model change. This is golden rule G8:
bumping `schemaVersion` without a migration and a fixture test for every
previous version is not allowed.

## Conventions

`ADDED 2026-09-30`, needed to make the model unambiguous:

- All angles are radians.
- Anchor coordinates are normalised to chord 1. `placement.chord` carries the
  physical chord; `placement.le` is in the same physical units.
- `anchors` is ordered along the chain: trailing edge pressure side, over the
  nose, to the trailing edge suction side. The leading-edge anchor is the one
  flagged by `leRadius` applying to it; its index is derived, never stored
  twice.
- `segmentDegrees` has exactly `anchors.length - 1` entries.
- `R = null` in JSON encodes `Infinity`, because JSON has no infinity
  literal. The loader converts, the writer converts back, and a round-trip
  test covers it.
- `meta.created` and `meta.modified` are ISO 8601 strings in UTC.
