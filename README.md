# 2D Profile Designer

An interactive 2D wing profile editor that runs entirely in the browser.
Profiles are built from chains of Bezier segments joined at anchor points
carrying position, tangent angle, curvature radius and two arm lengths, so
G0, G1 and G2 continuity are structural rather than enforced afterwards.

Phase 1 is geometry: parametric profiles, live curvature analysis,
multi-element configurations with gap and overlap, `.dat` import and export,
and fitting existing profiles. A panel method with an integral boundary layer
is Phase 2; the seam for it exists already.

No backend, no account, no download.

## Status

| Milestone | State |
|---|---|
| M1 - geometry kernel plus tests | done |
| M2 - SVG editor, dragging, parameter panels | done |
| M3 - curvature comb and arclength plot | comb is live in the editor, the arclength plot is not |
| M4 to M7 | not started |

Anchors drag, every parameter can be typed, anchors insert and delete,
elements list and reorder, undo and redo. The curvature comb updates while
dragging and flags a sign change on the suction side.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints.

## Verifying

```bash
pnpm verify
```

That runs the same list CI runs: the three check scripts, typecheck, lint,
tests and build. It must exit 0 before anything is pushed.

## Layout

```
packages/geometry   pure TypeScript geometry core, zero dependencies
packages/ui         React components and the editor store
packages/solver     Phase 2, worker interface stub
apps/studio         the standalone app
docs/spec           the specification - truth
docs/proposals      one build plan per high-care task
scripts             one check script per checkable golden rule
```

`packages/embed`, the `<foil-designer>` custom element, arrives with M7.

## Where the rules live

| File | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The law: golden rules, coding standards, what never to do |
| [`AGENTS.md`](AGENTS.md) | Long build instructions, phases with gate tests, GitHub tracking |
| [`docs/agent-workflow.md`](docs/agent-workflow.md) | Planning, care levels, the review loop, delegation |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Git workflow, commits, issues, pull requests |
| [`docs/spec/`](docs/spec/README.md) | The specification. It wins over everything else |
| [`BACKLOG.md`](BACKLOG.md) | Open work not yet in the spec |
| [`PROGRESS.md`](PROGRESS.md) | Session journal: decisions, measurements, dead ends |
| [`LOGGING.md`](LOGGING.md) | Levels, structured fields, error codes |

## Licence

Not chosen yet, so all rights are reserved for the moment. This has to be
settled before the first public deploy; see `BL-01` in
[`BACKLOG.md`](BACKLOG.md).
