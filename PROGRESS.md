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

## 2026-09-30c - the independent review of M2, and what it found

The M2 diff (`d8d681b`) went to an independent reviewer in a fresh context,
as high-care work must. It came back with five confirmed defects. Three of
them were exactly the class the diff claimed to be closing, which is the
argument for the review in one sentence: **the author shared the
assumptions that produced the bugs.** Fixed in `edf113d`.

### What it found

**Dragging one anchor could rewrite another.** The leading edge is defined
as the anchor with the smallest `x`, so any `x` drag can hand the role to a
different anchor - and the element-level nose parameters then start
rewriting that anchor's tangent and radius. Reproduced: dragging the nose
from `x = 0` to `x = 0.5` replaced anchor 1's stored `R` of 0.9 with 0.02
and moved the contour by **2.1e-1 chord**, silently. `setAnchor` now
compares the leading edge index before and after and refuses the move with
`GEOM_LEADING_EDGE_MOVED`.

`LESSON:` the guard was written in terms of FIELDS, and the hole was in the
INDEX. A check that names what may not change is not the same as a check
that the result is still the thing you meant.

**The arm regrowth cap broke the inverse it was meant to protect.**
`deleteAnchor` capped the growth FACTOR at 20, so the insert-then-delete
round trip was exact only for split parameters in `[0.05, 0.95]`. Outside
that band it failed quietly: 8.1e-3 chord at `t = 0.02`, 1.6e-3 at
`t = 0.98`. The tests sampled 0.25, 0.5 and 0.75 and could not see it. The
cap is now on the resulting arm LENGTH, which cannot bite on a genuine
inverse because the restored arm is the arm the split shortened and that
was already a legal value. Exact now from `t = 0.001` to `t = 0.999`.

`HONEST CORRECTION:` the previous entry, the commit message of `d8d681b`
and the comment in `constants.ts` all said "delete is the exact inverse of
insert". That was true only over the band the tests happened to sample, and
it was stated as a measurement. It is now true over the whole interval, and
the claim carries the range it was checked over.

**An accepted edit could make the document unrenderable.** `setAnchor`
validated finiteness and nothing else, so a typed `R` of 0 or a negative
arm length was stored happily and then threw out of `resolveElement` - in a
React tree that unmounts the editor with the bad value already committed to
state, so the user cannot even undo. `edit.ts` now rejects at the door, and
a test asserts the property behind it: anything `edit.ts` accepts, the
renderer can build. An `ErrorBoundary` is there as defence in depth, with
undo as the recovery, because the point of a boundary is the case nobody
thought of.

**One slider drag overflowed the undo history.** The parameter panel's
`Apply` type had no `coalesceKey` parameter, so every slider step was its
own entry: 241 from one departure-angle sweep, against a 100-entry cap,
which made the pre-drag document unrecoverable. The store's coalescing was
correct all along; the panel simply never used it.

**Three copies of the derived-field list.** `resolveAnchors`,
`derivedFields` and `derivedAt` each stated which anchor fields the element
parameters own. They agreed, and nothing stopped them drifting. There is
now one `derivedAnchorFields` in `element.ts` and a test that walks
`resolveAnchors` field by field and fails if it changes a field the list
does not declare. Closes `BL-15`.

### Measurements

| What | Before | After |
|---|---|---|
| Insert then delete at `t = 0.02` | 8.1e-3 chord | round-off |
| Insert then delete at `t = 0.98` | 1.6e-3 chord | round-off |
| Nose drag past the next anchor | 2.1e-1 chord, silent | refused |
| Undo entries per slider sweep | 241 | 1 |
| Tests | 119 | 137 |

### Still open

A refused edit is correct but invisible: the handle stops and the reason
goes to the console. `BL-16`, issue #14.

---

## 2026-09-30b - M2, the SVG editor

### Decisions

**The document transformations live in `packages/geometry`, not in the UI.**
The M2 acceptance criterion is that a drag and a typed value produce an
identical document. Asserting that in a test is worth something; making it
impossible to violate is worth more. Both paths call the same function in
`edit.ts`, so there is no second code path to drift.

**Element visibility is not in the document.** Hiding an element is about
looking at a profile, not about the profile, so a hidden element is still
saved and still exported. Tested.

**Zustand enters the dependency list.** `docs/spec/05-architecture.md`
names it, so this is the specification being implemented rather than a new
decision. It replaces hand-rolled context plus reducers; it is 1.2 kB
gzipped and the store is 150 lines.

### Measurements

| What | Value |
|---|---|
| Contour deviation on insert, neighbour arms left alone | 1.2e-2 chord |
| Contour deviation on insert, arms scaled by de Casteljau | 3.8e-6 to 7.4e-6 chord |
| Insert then delete, without the arm rescale | 3.1e-4 to 7.9e-3 chord |
| Insert then delete, with it | 0, worst case 4.7e-13 |
| Tests | 106 geometry, 13 store |

All deviations measured over four segments at t = 0.25, 0.5 and 0.75 on the
ladder preset.

### `LESSON:` splitting a segment is a three-anchor operation

The obvious implementation gives the new anchor sensible arms and leaves its
neighbours alone. That is wrong, and quietly: the neighbours' arms were
sized for the whole original segment and overshoot into the halves. De
Casteljau gives the factors for free - `t` for the arm before the split,
`1 - t` for the arm after - and the deviation drops by a factor of 14.

The same insight makes `deleteAnchor` an exact inverse rather than an
approximation. The split parameter is recoverable from the departing anchor,
because the insert set `Lin = t*s/n` and `Lout = (1-t)*s/n`, so
`t = Lin / (Lin + Lout)` whatever `s` and `n` were.

### `HONEST CORRECTION:` two of them

**The tolerances in the M2 plan were invented.** The plan said the contour
deviation was "measured at 1.4e-3" before anything had been measured. The
real value at the time was 1.2e-2, an order of magnitude worse, and the
number was written in the voice of a measurement. The plan's revision
section now says so and carries the real table.

**The first version of the deviation test measured the wrong thing.** It
took point-to-point distance between two sampled contours. The sampler is
curvature-adaptive, so the same shape sampled twice puts its points in
different places, and the metric reported 1.2e-2 for a contour whose true
deviation is 6e-6. It was measuring sample spacing. Deviation between
contours is point-to-polyline, and the helper in `edit.test.ts` says why.

This one nearly buried the real finding above: the "improvement" from
scaling the neighbour arms was invisible on two of four segments under the
broken metric.

### Found by driving the running app, not by a test

The contour was drawn as a hairline and was therefore almost unclickable,
so selecting a profile by clicking it worked only by luck. A transparent
wide stroke underneath is the hit target now. No unit test would have
caught this; it took opening the app and trying to click the thing.

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
