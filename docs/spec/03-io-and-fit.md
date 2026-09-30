# 03 - Import, export, fit

## Import

`.dat` in Selig and Lednicer format, with auto-detection.

Auto-detection rule (`ADDED 2026-09-30`, the original spec did not state it):
a Lednicer file begins with a header line whose two numbers are the point
counts of the two surfaces and whose values are greater than 1; a Selig file
begins with a name line followed immediately by coordinate pairs that start
at the trailing edge, run to the leading edge and back. When the detection is
ambiguous the reader reports the ambiguity instead of guessing.

## Fit

Levenberg-Marquardt on the normal distance between the raw points and the
Bezier contour. Initial estimate from the leading-edge radius and the
trailing-edge angle of the raw profile. Analytic gradients.
Target: seconds, not minutes.

The reference profile stays visible as a ghost contour after the fit, with a
deviation plot over the arclength.

## Export

`.dat` (Selig), plus the internal JSON.
