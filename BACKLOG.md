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

Every row carries its GitHub issue. **The board is where work stands**; this
file only says what exists. Board:
https://github.com/users/JonasPangerl/projects/2

The **Agent** column holds the care level and the thinking effort
(`high / medium`, `normal / low`, or `owner` when it waits on the owner).

---

## Ready now

| Id | Issue | Title | Prio | Size | Agent | State of play |
|---|---|---|---|---|---|---|
| BL-06 | [#5](https://github.com/JonasPangerl/2D-Profile-Designer/issues/5) | M3: curvature comb and curvature-over-arclength plot | high | M | high / medium | Kernel already produces comb data and inflection markers; the UI side is missing |
| BL-07 | [#6](https://github.com/JonasPangerl/2D-Profile-Designer/issues/6) | Sharp corner handling (`R = 0`) end to end | medium | M | high / medium | A model change: needs `phiIn`/`phiOut`, schema 2 and a migration. Starts with a spec change |
| BL-13 | [#11](https://github.com/JonasPangerl/2D-Profile-Designer/issues/11) | Warn when an arm length is too long for its radius | medium | S | normal / medium | M2 has landed, so this is unblocked. Measured numbers in the issue |
| BL-15 | [#13](https://github.com/JonasPangerl/2D-Profile-Designer/issues/13) | One door for the derived-anchor-field list | medium | S | high / medium | The list of which anchor fields the element parameters own exists in three places: `element.ts`, `edit.ts` and `AnchorHandles.tsx`. They agree today and nothing stops them drifting |
| BL-14 | [#12](https://github.com/JonasPangerl/2D-Profile-Designer/issues/12) | Degree-dependent arm lengths in the ladder preset | low | S | normal / medium | Preset is tuned for degree 4; degree 8 is wavy. Continuity is unaffected |

## Waiting on the owner

| Id | Issue | Title | Prio | Size | Agent | State of play |
|---|---|---|---|---|---|---|
| BL-01 | [#2](https://github.com/JonasPangerl/2D-Profile-Designer/issues/2) | Choose a licence before the first public deploy | high | S | owner | The repository is public with no `LICENSE`, so it is all rights reserved by default. Candidates: PolyForm Noncommercial (recommended), MIT, BSL 1.1 |
| BL-04 | [#3](https://github.com/JonasPangerl/2D-Profile-Designer/issues/3) | Protect `main` in the repository settings | high | S | owner | `CLAUDE.md` says `main` is protected; the branch has no rule, so only the markdown enforces it |

## Ideas

| Id | Issue | Title | Prio | Size | Agent | State of play |
|---|---|---|---|---|---|---|
| BL-09 | [#7](https://github.com/JonasPangerl/2D-Profile-Designer/issues/7) | NACA 4-digit generator as a preset source | low | S | normal / low | The generator exists in the kernel for the golden tests |
| BL-10 | [#8](https://github.com/JonasPangerl/2D-Profile-Designer/issues/8) | Deviation plot over arclength for the ghost contour | low | M | normal / medium | Belongs with M5; the fit has to exist first |
| BL-11 | [#9](https://github.com/JonasPangerl/2D-Profile-Designer/issues/9) | Keyboard nudging of the selected anchor | low | S | normal / low | M2 has landed, so this is unblocked |
| BL-12 | [#10](https://github.com/JonasPangerl/2D-Profile-Designer/issues/10) | `packages/embed`: the `<foil-designer>` custom element | low | M | high / medium | Deliberately not created at M1; an empty package would only be rewritten |
