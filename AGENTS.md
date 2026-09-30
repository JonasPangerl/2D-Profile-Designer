# AGENTS.md - the long build instructions

`CLAUDE.md` is the law and is read automatically. This file is the reference
you open on demand: architecture in detail, the phases with their gate tests,
and how work is tracked on GitHub.

---

## 1. Architecture in detail

```
2D-Profile-Designer/
  packages/
    geometry/            @foil/geometry - pure TypeScript, zero dependencies
      src/
        types.ts         Anchor, Element, Placement, Point, and friends
        constants.ts     tolerances and defaults, one place
        vec.ts           2D vector helpers
        bezier.ts        de Casteljau, derivatives, curvature of one segment
        anchors.ts       the G2 construction: anchors -> control polygons
        element.ts       a whole element: chain assembly, LE and TE handling
        curvature.ts     analytic curvature along a chain, comb data
        sampling.ts      curvature-adaptive resampling with cosine clustering
        placement.ts     transform, gap and overlap between elements
        schema.ts        the versioned JSON document, parse and serialise
        migrations.ts    one migration function per schema version
        naca.ts          analytic NACA 4-digit, for presets and golden tests
        index.ts         the public API - the only import surface
      tests/
        helpers.ts       expectAllClose and friends
        *.test.ts
    ui/                  @foil/ui - React editor components
    solver/              @foil/solver - Phase 2, worker interface stub only
    embed/               @foil/embed - <foil-designer> custom element
  apps/
    studio/              the standalone app for GitHub Pages
  docs/
    spec/                the specification - truth
    proposals/           one build plan per high-care task
    agent-workflow.md    process
  scripts/               one check script per checkable golden rule
  .github/workflows/     CI, running exactly the self-verification list
```

### Package boundaries

```
studio  ->  ui  ->  geometry
embed   ->  ui  ->  geometry
solver  ->  geometry          (Phase 2)
```

Nothing points the other way, and `geometry` depends on nothing at all. The
check script `scripts/check-geometry-purity.mjs` fails the build if
`packages/geometry` gains a dependency, touches `window`, `document`,
`fetch`, `localStorage`, `process` or `require`, or holds module-level
mutable state.

### The public API of `@foil/geometry`

Everything a consumer needs is re-exported from `src/index.ts`. A consumer
that imports from a deeper path is violating golden rule G6; the lint config
forbids it.

---

## 2. Phases and gate tests

A milestone is reached when its gate passes, not when it feels done.

### M1 - geometry kernel, no UI

Build, in this order:

1. `types.ts`, `constants.ts`, `vec.ts` - no logic worth testing on its own.
2. `bezier.ts` - de Casteljau evaluation, first and second derivative,
   analytic curvature. Tests: a degree-4 Bezier that traces an exact circle
   arc reproduces `kappa = 1/R` to `1e-10`; derivatives match a
   high-precision reference at 50 parameter values.
3. `anchors.ts` - the G2 construction from section 1.2 of the spec.
   Tests: `R = n/(n-1) * L^2 / h` inverts exactly; `R = Infinity` gives a
   straight start; `L = 0` throws.
4. `element.ts` - chain assembly including the leading edge special case and
   the trailing edge departure/wedge decomposition.
   Tests: G0, G1 and G2 at every anchor for segment degrees 4 to 8.
5. `curvature.ts`, `sampling.ts` - analytic curvature along the chain,
   adaptive sampling.
   Tests: the sampled contour is closed; no gap exceeds three times the
   local mean spacing; the sampler does not move a point off the curve.
6. `schema.ts`, `migrations.ts`, `naca.ts`.
   Tests: JSON round trip including `R = Infinity` as `null`; migration from
   every fixture; the NACA generator matches the closed-form thickness
   distribution.

**Gate:** `pnpm --filter @foil/geometry test` green, with the G0/G1/G2
asserts present for degrees 4 to 8, and a closed contour round trip through
the sampler.

### M2 - SVG editor

**Gate:** a profile can be changed both by dragging and by typing a number,
and the two paths produce an identical document. Undo and redo cover both.

### M3 - curvature comb and arclength plot

**Gate:** a deliberately introduced curvature kink is visible in the
arclength plot and flagged by a warning marker.

### M4 - multi-element, placement, gap and overlap

**Gate:** a two-element configuration reports gap and overlap matching a
hand calculation to `1e-9`.

### M5 - `.dat` I/O and fit

**Gate:** a downloaded NACA 2412 `.dat` loads, fits under `1e-4` chord, and
exports back within `1e-6`. The fit finishes in seconds, and the timing is
recorded in `PROGRESS.md`.

### M6 - save, compare, presets

**Gate:** two configurations shown overlaid, and a saved file from every
earlier schema version still loads.

### M7 - web component and Pages deploy

**Gate:** the custom element renders correctly inside a page with hostile
CSS, and the Pages deploy is reachable.

---

## 3. GitHub task tracking

**The board is the single source of truth for where work stands**, not a
markdown checklist.

| Item | Value |
|---|---|
| Repository | `JonasPangerl/2D-Profile-Designer` |
| Working branch | `dev` |
| Protected branch | `main` |
| Board title | `2D Profile Designer` |
| Board number | 2 |
| Board ID | `PVT_kwHOCYSVB84BlOpQ` |
| Board URL | https://github.com/users/JonasPangerl/projects/2 |
| Visibility | public |

Do not confuse it with board 1, `FlowLense Board`, which belongs to a
different project under the same owner.

### If the board ever has to be recreated

The `gh` token needs the `project` scope, which it does not have by
default:

```bash
gh auth refresh -s project
gh project create --owner JonasPangerl --title "2D Profile Designer"
gh project list --owner JonasPangerl
```

Then record the number and the ID in the table above in the same commit.

### Creating an issue

Always with the board attached in one command. Auto-add covers only one
repository on the free plan, so an issue created without `--project` is an
issue that never reaches the board:

```bash
gh issue create --repo JonasPangerl/2D-Profile-Designer \
  --title "BL-01: <short title>" \
  --body-file body.md \
  --project "2D Profile Designer"
```

The body states scope, acceptance criteria, and the spec section it
implements.

Close the issue from the pull request body with `Closes #23`, so the card
moves automatically.

Labels: `spec`, `blocked`, `milestone:M1` and friends.

If a `gh` call fails with an auth or scope error, **stop and report it**. Do
not fall back to editing markdown status files.

---

## 4. Running things

```bash
pnpm install              # once, at the repo root
pnpm dev                  # the studio app on a dev server
pnpm -r test              # all package tests
pnpm --filter @foil/geometry test -- --watch
pnpm verify               # the full self-verification list, what CI runs
```

`pnpm verify` is the list in section 13 of `CLAUDE.md`. If it fails, the
session is not finished.
