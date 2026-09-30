# 09 - Milestones

| M | Content | Result |
|---|---|---|
| M1 | Geometry kernel plus tests, no UI | `params -> coords`, G2 verified |
| M2 | SVG editor, dragging, parameter panels | The first profile becomes tangible |
| M3 | Curvature comb plus curvature-over-arclength plot | It can be judged |
| M4 | Multi-element, placement, gap and overlap | Cascades |
| M5 | `.dat` I/O plus fit | Existing profiles can be loaded |
| M6 | Saving, comparing, presets | Trial operation |
| M7 | Web component plus Pages deploy | Live on the website |

M1 to M3 are the core. Everything after that is legwork.

## Gate tests

`ADDED 2026-09-30`. A milestone is reached when its gate passes, not when it
feels done. The gates also live in `AGENTS.md`, which is where an agent looks
for them.

| M | Gate |
|---|---|
| M1 | `pnpm --filter @foil/geometry test` green, including G0/G1/G2 asserts at every anchor for segment degrees 4 to 8, and a closed contour round trip through the sampler |
| M2 | A profile can be changed by dragging and by number, and the two paths produce the identical document |
| M3 | A deliberately introduced curvature kink is visible in the arclength plot and flagged by a warning marker |
| M4 | A two-element configuration reports gap and overlap that match a hand calculation to `1e-9` |
| M5 | A downloaded NACA 2412 `.dat` loads, fits under `1e-4` chord, and exports back within `1e-6` |
| M6 | Two configurations are shown overlaid, and a saved file from every earlier schema version still loads |
| M7 | The custom element renders inside a page with hostile CSS and the Pages deploy is reachable |
