# BACKLOG

Open work that is real but **not yet in the spec**: ideas, deferrals,
follow-ups, known bugs.

## Hygiene rules

- **The tables contain OPEN work only.** When a row's work ships, DELETE the
  row in the same commit that ships it. For a partial ship, rewrite the row
  to only the remainder. Git history is the archive; there is never a "done"
  status here.
- **A row without an acceptance criterion is not scheduled.**
- A row that does not fit into a diff reviewable in one pass gets split.
- An unclear row is a PLANNING task, not an implementation task.
- Exactly three tables: ready now, waiting on the owner, ideas. No fourth
  state.
- Audit the backlog against the CODE periodically, and spot-check a row
  against the code before acting on it.

The **Agent** column holds the care level and the thinking effort
(`high / medium`, `normal / low`, or `owner` when it waits on the owner).

---

## Ready now

| Id | Title | Prio | Size | Agent | State of play | Detail |
|---|---|---|---|---|---|---|
| BL-02 | Create the GitHub project board and record its number and ID | high | S | normal / low | `gh` token lacks the `project` scope; owner must run `gh auth refresh -s project` first | `AGENTS.md` section 3 |
| BL-03 | Open one issue per M1 subtask on the board | high | S | normal / low | Blocked by BL-02 | `AGENTS.md` section 2, M1 |
| BL-04 | Protect `main` on GitHub (no direct pushes, no force) | high | S | owner | Requires repository settings access | `CONTRIBUTING.md` |
| BL-05 | M2: SVG editor, dragging, parameter panels | high | L | high / medium | Geometry core is in place; needs a plan in `docs/proposals/` first | spec `06-ui.md` |
| BL-06 | M3: curvature comb and curvature-over-arclength plot | high | M | high / medium | `curvature.ts` already produces comb data; the UI side is missing | spec `02-curvature.md` |
| BL-07 | Sharp-corner handling (`R = 0`) end to end, including the fit never introducing one | medium | M | high / medium | The kernel reports corners; the UI and the fit do not handle them yet. Acceptance: a corner survives a JSON round trip and a resample, and a fit on a rounded profile never produces one | spec `01-geometry.md` 1.2, decision O2 |

## Waiting on the owner

| Id | Title | Prio | Size | Agent | State of play | Detail |
|---|---|---|---|---|---|---|
| BL-01 | Choose a licence before the first public deploy | high | S | owner | Deferred 2026-09-30: no `LICENSE` file for now, so all rights reserved. Must be settled before M7, because Pages publishes the built app. Candidates: MIT, PolyForm Noncommercial, BSL 1.1 | spec `10-decisions.md` D2 |
| BL-08 | Repository public or private | medium | S | owner | Interacts with BL-01: GitHub Pages on the free plan needs a public repository | spec `10-decisions.md` O1 |

## Ideas

| Id | Title | Prio | Size | Agent | State of play | Detail |
|---|---|---|---|---|---|---|
| BL-09 | NACA 4-digit generator exposed as a preset source in the UI | low | S | normal / low | The generator exists in the kernel for the golden tests. Acceptance: a preset dropdown produces a fitted Bezier chain for any 4-digit code | spec `10-decisions.md` O3 |
| BL-10 | Deviation plot over arclength for the ghost reference contour | low | M | normal / medium | Belongs with M5. Acceptance: after a fit, the plot shows signed normal distance and its maximum matches the fit residual | spec `03-io-and-fit.md` |
| BL-11 | Keyboard nudging of a selected anchor, with a configurable step | low | S | normal / low | Acceptance: arrow keys move the selected anchor by the step and produce the same document a drag would | spec `06-ui.md` |
| BL-12 | `packages/embed`: the `<foil-designer>` custom element | low | M | high / medium | Deliberately not created at M1; an empty package would only be rewritten. Acceptance: the element renders inside a page with hostile CSS, styles stay inside the shadow root, and one script tag plus one element is the whole integration | spec `08-deployment.md` |
| BL-13 | Warn in the editor when an arm length is too long for its radius | medium | S | normal / medium | The normal offset grows as `L^2 / R`, so a long arm at a small radius throws the control point past the nose. Measured 2026-09-30: at `leRadius = 0.02` an arm of 0.04 pushes the contour to `x = -0.017`. Acceptance: the UI flags the anchor before the contour self-intersects, and the kernel exposes the ratio it is judged by | spec `01-geometry.md` 1.2 |
| BL-14 | Degree-dependent arm lengths in the ladder preset | low | S | normal / medium | The preset is tuned for degree 4. At degree 8 the same arms give a wavy suction side with real inflections; continuity is still G2. Acceptance: the preset produces an inflection-free suction side at every degree from 4 to 8 | `PROGRESS.md` 2026-09-30a |
