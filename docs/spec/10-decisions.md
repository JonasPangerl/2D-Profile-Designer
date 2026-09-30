# 10 - Decisions

## Settled

**D1. Units in the operating logic.** (owner, 2026-09-30)
The shape is normalised to chord length 1. Physical size lives in
`placement.chord`; `placement.le` and `ground.rideHeight` are in the same
physical units. Gap and overlap are reported both as a fraction of the
preceding element's chord and in physical units.
Consequence: a profile can be scaled without touching a single anchor, and
ground effect quantities stay meaningful.

**D2. Licence.** (owner, 2026-09-30)
No `LICENSE` file for now. The repository is therefore all rights reserved
by default. Revisit before the first public deploy (M7), because GitHub
Pages publishes the built app regardless of the repository's visibility.
The candidates discussed were MIT (too permissive if the tool becomes a
sales argument for the owner's CFD software), PolyForm Noncommercial and
BSL 1.1.
Tracked as `BL-01`. Raised to high priority by D5 below: the repository is
public, so the source is already readable.

**D3. Angles.** (2026-09-30, derived from the coding standards)
Radians everywhere inside the code, degrees only at the UI boundary.

**D4. `R = Infinity` in JSON.** (2026-09-30)
Encoded as `null`, because JSON has no infinity literal. Converted on load
and on write, covered by a round-trip test.

**D5. Repository visibility: public.** (owner, 2026-09-30)
Settles what was open point O1. GitHub Pages on the free plan needs a public
repository, and the tool is meant to be reachable from the owner's website.
Consequence, and it is the reason `BL-01` is high priority: the source is
readable by anyone today, and with no `LICENSE` file it is all rights
reserved, which is a defensible state but should be a decision rather than
an oversight.

## Open

**O2. Sharp corners in the chain.**
`R = 0` is specified as a sharp corner. Whether the UI should allow a sharp
corner anywhere other than the trailing edge is not settled. Recommendation:
allow it, warn about it, and never let the fit introduce one.

**O3. Preset library scope.**
The spec names one preset matching the classic r / p1..p5 ladder. Whether a
NACA generator ships as a preset source is open. Recommendation: yes, it is
cheap and it gives the golden tests their reference profiles anyway.
