# CLAUDE.md - the law for this repository

## 1. What you are building

**2D Profile Designer** is an interactive browser editor for 2D airfoil
(wing profile) sections. Profiles are built from chains of Bezier segments
joined at *anchor points* that carry position, tangent angle, curvature radius
and two arm lengths. The editor draws the profile as SVG, shows a live
curvature comb and a curvature-over-arclength plot, supports multi-element
configurations with gap and overlap readout, imports and exports `.dat`, and
fits existing profiles onto the Bezier representation.

It is a static web application. No backend, no account, no download. It ships
as a standalone app on GitHub Pages and as an embeddable custom element
`<foil-designer>` with shadow DOM.

Phase 2 (not in this spec) adds a panel method with an integral boundary layer
for Cp, downforce, drag, ground effect and ride-height sweeps. The seam for it
exists already: `packages/solver` holds the worker interface stub, and the
sampling step in the geometry core produces the panelisation the solver will
consume.

**This file governs every decision.** When it and `docs/spec/` conflict,
**the spec wins.**

Precedence: `docs/spec/` > `CLAUDE.md` > `docs/agent-workflow.md` >
everything else. When all are silent: follow the coding standards below and
leave a `// QUESTION:` comment.

## 2. Mandatory first actions every session

Run these before touching anything:

```bash
cat PROGRESS.md
cat BACKLOG.md
cat AGENTS.md
cat docs/agent-workflow.md
ls docs/spec/
```

Then read the spec section for the work at hand. Then `git pull --ff-only` on
the branch that is checked out. Do not switch branches.

## 3. Agent workflow (the part you carry even if you read nothing else)

The full process is in `docs/agent-workflow.md`. These five rules are binding
without reading it:

1. **Result quality beats cost, always.** Optimise cost only where it cannot
   endanger the result. When in doubt, spend the extra thinking.
2. **One model tier.** The strongest available model does everything:
   planning, architecture, tests, implementation, restricted areas, review.
   Nothing is delegated to a weaker model to save money. What differs between
   tasks is not the model but the CARE they need, and care is expressed as
   PROCESS.
3. **Restricted areas are high care.** In this repo those are: the geometry
   core (`packages/geometry`), the fit solver, the schema and its migrations,
   the `.dat` parsers, and anything that produces numbers a user will
   interpret. High care means a written plan first, tests written before the
   code, and an INDEPENDENT review of the diff in a fresh context.
   **The author never certifies its own restricted-area work.**
4. **The biggest cost lever is context, not the model.** Reading five named
   files beats searching forty. A delegated brief NAMES the files to start
   from.
5. **Stop after 3 implementation attempts** on one plan, and immediately on:
   changing the same place twice without success, weakening a test instead of
   fixing the code, or deviating from the plan. Discard that context and
   restart from the plan, the diff and the error.

Review is not optional. A backlog item without an acceptance criterion is not
scheduled.

## 4. Repository map

| Path | What it is for |
|---|---|
| `packages/geometry/` | Pure TypeScript geometry core. No DOM, no I/O, no framework. The only place curve maths lives. |
| `packages/ui/` | Editor components (React). Consumes `geometry`, never reimplements it. |
| `packages/solver/` | Phase 2. Worker interface stub only. |
| `packages/embed/` | The `<foil-designer>` custom element, shadow DOM, single ESM bundle. |
| `apps/studio/` | Standalone application deployed to GitHub Pages. |
| `docs/spec/` | The living specification. Truth. |
| `docs/proposals/` | One build plan per high-care task. |
| `scripts/` | Check scripts, one per golden rule where a rule is checkable. |
| `.github/workflows/` | CI. Runs exactly the self-verification list. |
| `BACKLOG.md` | OPEN work not yet in the spec. |
| `PROGRESS.md` | Session journal. |
| `LOGGING.md` | Logging conventions. |
| `AGENTS.md` | Long build instructions, phases, gate tests, board IDs. |

## 5. Golden rules

Each rule carries the date it was adopted and the reason it exists. A rule is
never removed because it is inconvenient.

**G1. Spec is truth.** (2026-09-30, founding)
Locate the spec section before writing. If the spec is silent, the work starts
with a spec change, not with code.

**G2. Tests before implementation.** (2026-09-30, founding)
`write test -> see it FAIL -> implement -> see it PASS -> commit both`.
Never claim a red-then-green you did not see. A test that was green from the
start is legitimate, but it must be CALLED a regression guard.

**G3. No silent numerical failures.** (2026-09-30, founding)
Never compare floats with `===`. Use `expect(actual).toBeCloseTo(expected, n)`
or the `expectAllClose` helper in `packages/geometry/tests/helpers.ts`, with an
explicit tolerance. A tolerance chosen to make a test pass is a bug being
hidden; state in a comment why the tolerance is what it is.

**G4. `geometry/` imports nothing.** (2026-09-30, spec section 6)
`packages/geometry` has no runtime dependencies, no DOM access, no React, no
network, no global state. It takes a document in and returns geometry out.
This is what keeps a later Rust/WASM port and worker offloading possible.
Enforced by `scripts/check-geometry-purity.mjs`.

**G5. A reference implementation before the fast one.** (2026-09-30, founding)
The slow, obvious version exists and passes tests before any optimised path is
written. The fast one is then proven equal to it by a backend-diff test. This
applies in particular to the fit solver and to curvature evaluation.

**G6. One interface, many frontends.** (2026-09-30, spec section 6)
There is exactly one canonical geometry API. The studio app, the embed element
and any future CLI are consumers of it and never reach around it.

**G7. The document is the integration seam.** (2026-09-30, spec sections 5, 9)
Every feature is a transformation of the versioned JSON document defined in
`packages/geometry/src/schema.ts`. Design each feature as "what does it do to
the document"; embedding then becomes a UI question only.

**G8. A schema change ships with its migration.** (2026-09-30, spec section 5)
Bumping `schemaVersion` without adding a migration function and a test that
loads a fixture of every previous version is not allowed. Saved profiles must
never break.

**G9. Curvature is analytic.** (2026-09-30, spec section 3)
Curvature comes from the Bezier derivatives, never from finite differences of
sampled points. Finite differences hide exactly the discontinuities the tool
exists to reveal.

**G10. English only, ASCII only.** (2026-09-30, founding)
Every word that ends up in the repo is English: identifiers, comments,
docstrings, log and error messages, UI strings, commit messages and every
`.md` file. Conversations with the owner often happen in another language; the
repo never does.
No em dashes and no non-ASCII characters anywhere in the repo. Use `-`, `->`,
`+/-`. The one exception is symbols RENDERED IN THE UI, which live in an
explicit reviewed allow-list in `scripts/check-ascii.mjs`.
Enforced by `node scripts/check-ascii.mjs` (`--fix` transliterates what is
safe).

**G11. Commit structure.** (2026-09-30, founding)
`<type>(<scope>): <description>`. Types and scopes are listed in
`CONTRIBUTING.md`. Every commit that touches an issue names its number.

**G12. No third-party product is named in user-facing text.** (2026-09-30,
founding)
Reference implementations and papers belong in `docs/`, never in the UI.
Enforced by `scripts/check-branding.mjs`.

## 6. Version badge

The studio app shows `<semver>+<short-sha>` in the footer, sourced at build
time from `package.json` and `git rev-parse --short HEAD`. It is never
hand-edited, and agents never bump the version; the orchestrator does that
after merging.

## 7. Git workflow

Full rules in `CONTRIBUTING.md`. The short version:

- **A task does NOT get its own branch.** Work on the branch that is checked
  out. Create a branch only when the owner asks.
- The working branch is `dev`. `main` is protected and holds releases.
- **Never commit to `main`.** If `main` is checked out when a task arrives,
  stop and ask which branch to use.
- Never `git push --force`. Never `git commit --amend` on pushed commits.
  Never merge a PR. Never mark a PR ready for review. The owner does all
  three.
- Temporary worktree branches for parallel agents are the one exception. They
  are local only, never pushed, and deleted immediately after merging.

## 8. Journal protocol

Write a block in `PROGRESS.md` when a session produced a decision, a
measurement, a dead end, a correction, or an assumption the owner must
confirm. Do NOT write a block for routine work that shipped cleanly and is
fully described by its issue and its commits. A journal that logs everything
is read by nobody.

Status words are plain lowercase English (`done`, `fixed`, `deferred`, `open`,
`owner`, `root-caused`), never a glyph. The notes carry the evidence: measured
numbers, test names, commit SHAs. `LESSON:` and `HONEST CORRECTION:` mark the
two kinds of entry most worth re-reading. Two blocks on the same day get
distinct suffixes (`2026-09-30a`, `30b`).

## 9. Build order

Gate tests per milestone are in `AGENTS.md`. Summary:

| M | Content | Gate |
|---|---|---|
| M1 | Geometry core plus tests, no UI | `params -> coords`, G0/G1/G2 verified at every anchor over all segment degrees |
| M2 | SVG editor, dragging, parameter panels | A profile can be edited by hand and by number |
| M3 | Curvature comb plus curvature-over-arclength plot | A kink is visible before it is exported |
| M4 | Multi-element, placement, gap and overlap | A two-element cascade with live gap readout |
| M5 | `.dat` import and export, fit | A downloaded profile loads and fits under tolerance in seconds |
| M6 | Save, compare, presets | Two configurations overlaid |
| M7 | Web component plus Pages deploy | Live on the target website |

M1 to M3 are the core. Everything after is legwork.

## 10. Coding standards

- **TypeScript**, `strict: true`, `noUncheckedIndexedAccess: true`. No `any`
  outside a typed boundary adapter, and there it carries a comment.
- `tsc --noEmit` is part of the build. Type errors fail the build, not the
  user.
- **Vitest** for tests, colocated in `tests/` per package.
- Naming: `camelCase` for values, `PascalCase` for types and components,
  `SCREAMING_SNAKE` for module-level constants.
- Angles are **radians** everywhere inside the code. Degrees exist only at the
  UI boundary, and the converting function is named so.
- Coordinates in the shape are **normalised to chord 1**. Physical size lives
  in `placement.chord`. Gap and overlap are reported in both chord fractions
  and physical units. (Owner decision 2026-09-30, spec section 11.3.)
- Every exported function in `packages/geometry` has a doc comment stating its
  units, its domain and what it does when the input is degenerate.
- ASCII only, English only. See G10.

## 11. Dependency rules

- `packages/geometry`: **zero runtime dependencies.** Standard library only.
- `packages/ui`: React, Zustand, uPlot. Nothing else without an owner
  decision recorded in `PROGRESS.md`.
- No CDN at runtime. Every asset is served same-origin.
- No UI component library, no charting library beyond uPlot, no maths library.
- Adding a dependency is a spec-level decision. It needs a line in
  `PROGRESS.md` saying what it replaces and why writing it ourselves is worse.

## 12. What you must never do

- Commit to `main`, force-push, amend a pushed commit, merge a PR, or mark a
  PR ready for review.
- Create a branch nobody asked for.
- Weaken, skip or delete a test to make a suite pass.
- Compute curvature by finite differences.
- Put DOM, I/O, framework or global state into `packages/geometry`.
- Bump `schemaVersion` without a migration and its test.
- Write a non-ASCII character or a non-English word into the repo.
- Copy code from a GPL-licensed source. The clean reference for the Phase 2
  solver is the MIT-licensed one named in the spec; the GPL one named there is
  off limits for implementation.
- Invent a number. If a value is unknown, say so and ask.

## 13. Self-verification before ending a session

All of these must exit 0:

```bash
node scripts/check-ascii.mjs
node scripts/check-geometry-purity.mjs
node scripts/check-branding.mjs
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

`pnpm verify` runs the whole list. If one fails, the session is not finished;
report the failure with its output rather than working around it.
