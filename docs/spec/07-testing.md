# 07 - Testing

- Golden tests against analytic NACA 4-digit profiles; the fit must land
  under a defined tolerance
- Assertions on G0, G1 and G2 at every anchor, across all segment degrees
- Round trip: JSON -> geometry -> `.dat` -> fit -> JSON, deviation under
  tolerance
- Schema migration from every previous version

## Tolerances

`ADDED 2026-09-30`. A tolerance that is not written down gets chosen to make
the test pass, which is golden rule G3 being violated.

| Check | Tolerance | Why |
|---|---|---|
| G0 at an anchor | `1e-12` absolute | The endpoints are the same stored number; only floating point sums differ |
| G1 at an anchor | `1e-10` on the unit tangent components | One normalisation of a difference of order 1 |
| G2 at an anchor | `1e-8` relative on `kappa`, and absolute `1e-10` when `abs(kappa) < 1` | The curvature formula divides by a cubed length |
| NACA 4-digit fit | max normal distance `< 1e-4` chord | Below the plotting resolution and below manufacturing tolerance |
| `.dat` round trip | `1e-6` chord | The written file carries 6 decimals |
| Sampling density | no gap larger than 3x the local mean spacing | Guards the adaptive resampler against clustering artefacts |

Every tolerance in a test carries a comment naming the reason. A test that
changes a tolerance in order to pass is a bug being hidden.
