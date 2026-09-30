# 02 - Curvature analysis

Analytic, from the Bezier parametrisation, **not** by finite differences:

```
kappa(t) = (x' * y'' - y' * x'') / (x'^2 + y'^2)^(3/2)
```

This is golden rule G9. Finite differences hide exactly the discontinuities
the tool exists to reveal.

## Display

- **Comb** along the curve normal, length proportional to `kappa`. The
  scaling is **signed-logarithmic** by default, otherwise the nose dominates
  the whole picture. A linear mode is available as an option.
- **A separate curvature-over-arclength plot.** Kinks are visible there that
  are lost visually in the comb.
- **Warning markers** where `kappa` changes sign on the suction side.

## Scaling detail

`ADDED 2026-09-30`. The original spec names signed-logarithmic scaling
without fixing the form. The implementation uses

```
combLength(kappa) = scale * sign(kappa) * log1p(abs(kappa) / kappaRef)
```

with `kappaRef` defaulting to the median of `abs(kappa)` over the sampled
curve, so the comb stays readable across profiles of very different leading
edge radii. `scale` is a UI zoom factor. Both are exposed; neither changes
the geometry.
