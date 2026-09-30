# 01 - Geometry kernel

## 1.1 Model

Every element is a closed chain of Bezier segments. The chain runs from the
trailing edge on the pressure side, over the nose, to the trailing edge on
the suction side. **Anchor points** sit at the joints.

Each anchor has:

| Field | Meaning |
|---|---|
| `x`, `y` | Position, normalised to chord length 1 |
| `phi` | Tangent angle at the anchor, radians, measured from the chord direction |
| `R` | Curvature radius. `Infinity` means a curvature-free transition, `0` means a sharp corner |
| `Lin` | Arm length of the incoming segment |
| `Lout` | Arm length of the outgoing segment |

The arm lengths are **free shape parameters** and must be adjustable in the
UI. `R` does not determine them.

Sign convention (`ADDED 2026-09-30`, the original spec left it implicit):
the chain is traversed in the order given and `phi` is the direction of
travel. The **curve normal is `phi` rotated by -90 degrees**, to the right
of travel, and a positive `R` bends the curve towards it. Curvature
`kappa = 1 / R` with the same sign.

The minus sign is not a coin toss. Running from the pressure-side trailing
edge over the nose to the suction-side trailing edge traverses a convex
profile clockwise, so with the normal to the *left* of travel every radius
in an ordinary profile would come out negative, including `leRadius`. With
the normal to the right, a convex profile has positive curvature everywhere
and `R` at the nose is the plain positive number a user expects to type.
The curvature comb draws its teeth along the *negative* normal, so positive
curvature points away from the body as every comb does.

## 1.2 Core formula (G2 construction)

For a Bezier segment of degree `n` starting at an anchor `P0` with tangent
direction `t`:

```
P1 = P0 + L * t
P2 = P1 + (tangential part) + h * normal(t)

h = n/(n-1) * L^2 / R
```

Conversely the curvature radius at the segment start is:

```
R = n/(n-1) * L^2 / h
```

The two segments meeting at an anchor get **the same `R`** and antiparallel
tangents. G0, G1 and G2 continuity are therefore structurally guaranteed and
do not have to be enforced afterwards.

Segment degree: default 4 per segment, configurable. Degree >= 4 is required
so that tangent and curvature can be set independently at both ends.

### The tangential part, made explicit

`ADDED 2026-09-30`. The formula above leaves the tangential part of
`P2 - P1` free; it does not affect the curvature at the segment end, because
only the normal component enters the cross product. It is still a real shape
parameter and it has to be pinned down, otherwise two implementations of this
specification produce different curves. The rule is:

- **Degree 4.** Five control points. `P0`, `P1`, `P3` and `P4` are fixed by
  the two anchor positions, the two tangents and the two arm lengths. `P2` is
  then shared by the start curvature condition and the end curvature
  condition, so it is not free: it is the intersection of the two lines
  `P1 + a * t_start + h_start * n_start` and
  `P3 - b * t_end + h_end * n_end`. If those lines are parallel the segment
  is degenerate and the builder reports `GEOM_DEGENERATE_SEGMENT`.
- **Degree >= 5.** The start triple `P0, P1, P2` and the end triple
  `Pn-2, Pn-1, Pn` no longer overlap. The tangential part is then taken as
  the arm length itself (`a = L`), which keeps the control polygon evenly
  spaced. Any remaining interior control points are placed by uniform linear
  interpolation between `P2` and `Pn-2`.

Either way the curvature at both segment ends is exactly the requested one,
because it depends only on the first three and the last three control points.

### Degenerate cases

`ADDED 2026-09-30`, required by golden rule G3.

- `R = Infinity` gives `h = 0`; the third control point lies on the tangent
  line.
- `L = 0` collapses the arm. It is rejected with `GEOM_ZERO_ARM`, not
  silently clamped.
- A segment degree below 4 is rejected with `GEOM_DEGREE_TOO_LOW`.
- `R = 0` is specified above as a sharp corner. **Phase 1 rejects it** with
  `GEOM_SHARP_CORNER_UNSUPPORTED`, because a single stored `phi` per anchor
  cannot represent the two different tangents a real corner needs. Supporting
  corners is a model change (a `phiIn` and a `phiOut`, or an explicit corner
  flag), tracked as `BL-07` and as open decision O2. The trailing edge does
  not need it: it is already two separate anchors.

## 1.3 Special cases

**Leading edge.** A single anchor, the shared endpoint of the pressure side
and the suction side. Its tangent is perpendicular to the `leAxis` (below) and
`R = R_LE` for both sides. The nose is therefore curvature-continuous by
construction.

**leAxis.** The reference axis to which the leading-edge tangent is
perpendicular is its own parameter, `leAxisAngle`, relative to the chord.
Default `0`, so the leading-edge tangent is perpendicular to the chord. This
allows the nose to be tilted without changing the chord angle. Collapsed by
default in the UI.

**Trailing edge.** Two separate anchors, offset vertically by `teThickness`.
The UI does not expose the two individual tangents but:

- `departureAngle` - the mean of the two trailing-edge tangents
- `wedgeAngle` - the difference between the two trailing-edge tangents

The individual tangents are computed from those two.

### Angle conventions, made explicit

`ADDED 2026-09-30`. `phi` is the direction of travel along the chain, so the
element-level trailing-edge parameters have to be converted, and the
conversion has to be written down once.

Both trailing-edge tangents are defined as the **downstream-pointing**
surface directions:

```
tSuction  = departureAngle - wedgeAngle / 2
tPressure = departureAngle + wedgeAngle / 2
```

so their mean is `departureAngle` and their difference is `wedgeAngle`. In
the traversal frame that gives:

```
anchors[0].phi        = tPressure + pi     (leaving the TE towards the nose)
anchors[last].phi     = tSuction            (arriving at the TE)
anchors[leIndex].phi  = leAxisAngle + pi/2  (rounding the nose upwards)
```

### Derived fields win over stored ones

`ADDED 2026-09-30`. Some anchor fields are also expressed by element-level
parameters, which makes them redundant in the stored document. One door per
concern (golden rule): `resolveElement` computes them and ignores what is
stored, and `validateElement` reports any stored value that disagrees.

| Anchor | Derived from |
|---|---|
| `anchors[0]` | position `(1, -teThickness/2)`, `phi` from `departureAngle` and `wedgeAngle` |
| `anchors[last]` | position `(1, +teThickness/2)`, `phi` from `departureAngle` and `wedgeAngle` |
| the leading-edge anchor | `phi` from `leAxisAngle`, `R` from `leRadius` |

The leading-edge anchor is the one with the smallest `x`. Its index is
derived, never stored twice.

## 1.4 Placement

Strictly separate from the shape:

```ts
placement = { le: { x, y }, chord, chordAngle }
```

For multi-element configurations, additionally computed and displayed live:

- **Gap** - the shortest distance to the contour of the preceding element
- **Overlap** - the projection onto the chord direction of the preceding
  element

These are the quantities practitioners actually adjust.

Both are reported as a fraction of the preceding element's chord and in
physical units. (Owner decision 2026-09-30: the shape is normalised to chord
1 and `placement.chord` carries the physical size. See
[`10-decisions.md`](10-decisions.md).)

## 1.5 Sampling

Curvature-adaptive resampling of the curve with additional cosine clustering
at the leading and trailing edges. It produces the point sequence for export
and, later, the panelisation for the solver directly. The point count is
configurable, default 200 per element.
