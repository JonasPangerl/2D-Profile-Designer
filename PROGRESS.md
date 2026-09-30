# PROGRESS - session journal

Not a status tracker. The GitHub board is that. Write a block here when a
session produced a **decision**, a **measurement**, a **dead end**, a
**correction**, or an **assumption the owner must confirm**. Do NOT write a
block for routine work that shipped cleanly and is fully described by its
issue and its commits. *A journal that logs everything is read by nobody.*

Conventions: status words are plain lowercase English (`done`, `fixed`,
`deferred`, `open`, `owner`, `root-caused`), never a glyph. The notes carry
the evidence: measured numbers, test names, commit SHAs. `LESSON:` and
`HONEST CORRECTION:` mark the two kinds of entry most worth re-reading. Two
blocks on the same day get distinct suffixes (`2026-09-30a`, `30b`).

Last updated: 2026-09-30
Updated by: setup session

---

## 2026-09-30a - repository setup and M1 geometry kernel

### Owner decisions

| Topic | Decision | Reason |
|---|---|---|
| Units | Shape normalised to chord 1, physical size in `placement.chord` | A profile can be rescaled without touching an anchor, and gap, overlap and ride height stay meaningful. Recorded as D1 in `docs/spec/10-decisions.md` |
| Licence | deferred, no `LICENSE` file | All rights reserved for now. Must be settled before M7: Pages publishes the built app either way. `BL-01` |
| Session scope | through M1 | Governance, monorepo, CI, geometry kernel with tests. UI is a viewer only |

### Decisions taken while building

**Curvature sign convention.** The curve normal is the tangent rotated by
**-90 degrees**, to the right of travel, not +90.
Reason, and this one is worth remembering: the chain order the spec fixes
(pressure-side trailing edge, over the nose, to the suction-side trailing
edge) traverses a convex profile clockwise. With the normal to the left of
travel, every radius in an ordinary profile comes out negative, `leRadius`
included, and a user would have to type `-0.02` for a 2 percent nose. With
the normal to the right, a convex profile has positive curvature everywhere.
Written into `docs/spec/01-geometry.md` and `vec.ts`.

`LESSON:` the first ladder preset was built before this was noticed. Every
`R` had the wrong sign, and the degree-4 control point construction resolved
that by throwing the third control point far behind the second: the contour
reached back to `x = -0.23` on a chord of 1 and the curvature spiked to 435.
The sign error showed up as a geometry explosion, not as a mirrored curve.

**The tangential part of `P2` is not free at degree 4.** Degree 4 has five
control points, and `P2` is shared by the start and the end curvature
condition, so it is the intersection of two lines, not a choice. At degree 5
and above the two triples separate and the tangential part is taken as the
arm length itself, with the interior points linearly interpolated. Written
into `docs/spec/01-geometry.md`.

**`R = 0` is rejected in Phase 1.** The specification calls it a sharp
corner, but a single stored `phi` per anchor cannot express the two
different tangents a corner needs. `GEOM_SHARP_CORNER_UNSUPPORTED` rather
than a silent approximation. Supporting it is a model change, tracked as
`BL-07` and decision O2. The trailing edge never needs it: it is already two
anchors.

**Arm lengths are bounded by the radius in practice.** The normal offset is
`h = n/(n-1) * L^2 / R`, so a long arm at a small radius throws the control
point past the nose. Measured: with `leRadius = 0.02`, an arm of 0.04 pushes
the contour to `x = -0.017`; 0.02 gives `x = -0.001`; 0.01 gives a clean
nose. The ladder preset now defaults the leading-edge arm to `leRadius / 2`.
This is a property of the model, not a bug, but it is the first thing the
editor will have to guard against interactively (`BL-13`).

### Measurements

| What | Value |
|---|---|
| Geometry tests | 81 passing, 8 files, about 0.5 s |
| Studio production bundle | 154.3 kB raw, 50.7 kB gzipped |
| Cubic circle approximation, endpoint curvature error | 0.14 percent at a 45 degree sweep |

### Dead end

`HONEST CORRECTION:` the curvature test was originally written against a
cubic Bezier approximation of a circular arc, asserting `kappa = 1/R` at the
endpoints to 1e-10. That premise is wrong. The standard cubic arc is exact
in position and tangent at the endpoints but **not** in curvature: it is low
by 0.14 percent at a 45 degree sweep, independent of the radius. The test
failed on its first run and the implementation was correct.
The replacement reference is the parabola `y = a x^2`, which a quadratic
Bezier traces exactly and which degree elevation preserves exactly, so the
expected curvature comes from closed-form calculus and not from this code.
`circleArcControlPoints` is still used where only position, tangent or arc
length matters, and its doc comment now says what it is not good for.

### Assumptions the owner should confirm

1. The ladder preset's arm lengths are tuned for **segment degree 4**. At
   degree 8 the same arms produce a visibly wavy suction side with real
   curvature inflections; continuity is still G2 everywhere and all asserts
   pass, so this is a preset tuning question, not a kernel defect. Tracked
   as `BL-14`. If a degree above 4 is meant to be a first-class default,
   the preset needs degree-dependent arms.
2. The trailing-edge angle convention was written down rather than derived
   from the original specification, which did not state it: both trailing
   edge tangents are defined pointing downstream, so their mean is
   `departureAngle` and their difference is `wedgeAngle`. See
   `docs/spec/01-geometry.md`, "Angle conventions, made explicit".
3. `packages/embed` does not exist yet. The custom element is M7 work and an
   empty package would only have to be rewritten. Tracked as `BL-12`.

### Open, needs the owner

- `gh` is authenticated as `JonasPangerl` but the token lacks the `project`
  scope, so the project board could not be created. One command fixes it:
  `gh auth refresh -s project`. Until then `BL-02` and `BL-03` are blocked
  and there is no board. Per `CONTRIBUTING.md` this was reported rather than
  worked around with a markdown status file.
- `main` protection has to be set in the repository settings by the owner
  (`BL-04`).
