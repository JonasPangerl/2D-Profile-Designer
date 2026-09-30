# 05 - Architecture

Monorepo, pnpm workspaces.

```
/packages
  geometry/     pure TypeScript, no DOM dependency, fully testable
  ui/           editor components
  solver/       Phase 2 - worker interface stub only
  embed/        web component <foil-designer>
/apps
  studio/       standalone app for GitHub Pages
```

**Hard rule:** `geometry/` imports nothing and knows nothing about rendering.
The possible later Rust/WASM port and the worker offloading both hang off
that. This is golden rule G4, enforced by
`scripts/check-geometry-purity.mjs`.

## Stack

- TypeScript, Vite, React
- Zustand for state
- **SVG** for the editor - at 20 to 60 control points it is fast enough and
  gives hit testing for dragging for free
- uPlot for the curvature-over-arclength plot and the later Cp and polar
  plots
- No heavy dependencies

## Dependency direction

```
studio  ->  ui  ->  geometry
embed   ->  ui  ->  geometry
solver  ->  geometry          (Phase 2)
```

Nothing points the other way. `geometry` has no dependencies at all.
