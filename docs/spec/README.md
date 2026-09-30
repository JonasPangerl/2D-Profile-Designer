# Specification - 2D Profile Designer

The living specification. **The spec wins over `CLAUDE.md`.** Locate the
section your work belongs to before writing anything. If the section does not
exist or is silent, the work starts with a change to this specification, not
with code.

Translated and split from the owner's original project specification
(2026-09-30). Wording changes are editorial only; where a section here says
something the original did not, it is marked `ADDED <date>` with the reason.

## Index

| File | Content |
|---|---|
| [`01-geometry.md`](01-geometry.md) | The geometry kernel: anchors, the G2 construction, special cases, placement, sampling |
| [`02-curvature.md`](02-curvature.md) | Analytic curvature, the comb, the arclength plot, warnings |
| [`03-io-and-fit.md`](03-io-and-fit.md) | `.dat` import and export, fitting existing profiles |
| [`04-data-model.md`](04-data-model.md) | The versioned JSON document and its migrations |
| [`05-architecture.md`](05-architecture.md) | Monorepo layout, package boundaries, stack |
| [`06-ui.md`](06-ui.md) | Editor requirements |
| [`07-testing.md`](07-testing.md) | What must be tested and to what tolerance |
| [`08-deployment.md`](08-deployment.md) | CI, Pages, the embeddable custom element |
| [`09-milestones.md`](09-milestones.md) | M1 to M7 with their gates |
| [`10-decisions.md`](10-decisions.md) | Decisions taken and decisions still open |
| [`11-references.md`](11-references.md) | Literature, reference implementations, licence notes, known physical limits |

## Overview

An interactive 2D wing profile editor in the browser. Statically hosted on
GitHub Pages, embeddable as a web component on an existing website.

The long-term goal is a panel method with a boundary layer for Cp, downforce,
drag, ground effect and ride-height sweeps. **This specification covers
Phase 1 only: geometry.** The solver comes later; the interface for it is
provided for now.

## Scope

**In Phase 1:**

- Parametric profile generation from Bezier chains with anchor points
- Interactive dragging of the points plus numeric entry of every parameter
- Live curvature analysis (porcupine comb plus a curvature-over-arclength
  plot)
- Multi-element configurations with gap and overlap readout
- `.dat` import and export, fitting existing profiles onto the Bezier
  representation
- Saving, loading and comparing configurations

**Not in Phase 1:**

- Panel method, boundary layer, Cp, forces, sweeps
- 3D, wings, optimisation
- A backend of any kind. Everything runs in the browser.
