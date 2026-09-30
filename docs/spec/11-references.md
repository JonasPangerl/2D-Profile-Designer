# 11 - References and known limits

## Parametrisation

- Lauer and Ansell, *A Parametrization Framework for Multi-Element Airfoil
  Systems Using Bezier Curves*, AIAA Aviation 2022. Anchor points, curvature
  control arms, G0/G1/G2. Implementation: `pymead` (mlau154/pymead),
  predecessor `pyairpar`. **Reference for the data model, not a dependency.
  Licence to be checked before anything is taken from it.**
- Derksen and Rogalsky, *Bezier-PARSEC: An optimized aerofoil
  parameterization for design*, Advances in Engineering Software 41 (2010).
  Variants BP3333 and BP3434.
- Kulfan, *CST* (2008). Interesting for later optimisation and import,
  unsuitable as a UI parametrisation because the coefficients are not
  geometrically intuitive.
- `marc-frank/BezierAirfoilDesigner` solves the fit problem, but with
  runtimes of minutes to hours. A counterexample for the
  Levenberg-Marquardt approach, which must land in seconds.

## Phase 2 (solver, not to be implemented here)

- Drela, *XFOIL: An Analysis and Design System for Low Reynolds Number
  Airfoils* (1989). Linear vortex-strength panel method plus a two-equation
  integral boundary layer, global Newton solve. **The code is GPL and must
  not be used.**
- Fidkowski, `mfoil` (MATLAB and Python, **MIT**) and *A Coupled
  Inviscid-Viscous Airfoil Analysis Solver, Revisited*, AIAA J. 60(5), 2022.
  An independent implementation of the same physics, including documented
  closure relations. **This is the clean reference for the solver.**
- `flexcompute/flexfoil` (Rust to WASM, **MIT**). Multi-body as a design
  goal; the inviscid part works, the boundary layer and the
  viscous-inviscid interaction are missing.
- Ground effect: the image method (mirror the profile at the ground plane,
  solve both bodies simultaneously). Exact for the inviscid case.

## Known physical limits (to keep in mind for Phase 2)

- A pure potential method gives **drag = 0** (d'Alembert). Drag only appears
  with the integral boundary layer (Squire-Young over the momentum thickness
  in the wake).
- Multi-element **inviscid** is easy, one Kutta condition per element.
  Multi-element **viscous** is hard: confluent boundary layers, wake
  interaction. Realistically, viscous for single elements first.
- Below roughly 0.1 c ground clearance, real downforce collapses through
  separation. Panel plus integral boundary layer reproduces the
  force-enhancement branch, but not the peak and not the force reduction.
- 2D has no induced drag. On real front wings, induced drag dominates.

The tool is therefore a qualitative trend and teaching instrument, not a
quantitative design tool. That is intentional.
