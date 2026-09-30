# Contributing

Git, issues and pull requests for this repository. Binding for humans and
agents alike.

## Branches

- **A task does NOT get its own branch.** Work on the branch that is checked
  out and commit there. Create a branch ONLY when the owner asks; the default
  is never to branch. Branch sprawl costs more than it saves.
- `main` is protected and holds releases. **Never commit to `main`, never
  switch to it in order to work.** If `main` happens to be checked out when a
  task arrives, stop and ask which branch to use; do not silently create one.
- `dev` is the working branch. Everything lands there first.
- Start of session: `git pull --ff-only` on the CURRENT branch. Do not switch.
- Temporary worktree branches for parallel agents are the one exception. They
  are local only, never pushed, and deleted immediately after their commits
  are merged.

## Commits

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `build`,
`chore`.

**Scopes:** `geometry`, `ui`, `solver`, `embed`, `studio`, `schema`, `dat`,
`fit`, `curvature`, `ci`, `scripts`, `docs`.

Rules:

- Commit early and often, one logical change per commit.
- Reference the issue number in every commit that touches it (`refs #12`).
- The commit message carries the EVIDENCE for anything non-obvious: the
  measured numbers, the reason a decision went the way it did, what was
  refuted. A good message of this kind is the cheapest documentation there is.
- English only, ASCII only, in the message as everywhere else.

Example:

```
fix(curvature): use analytic second derivative at t=0 of degree-4 segments

Finite differencing with h=1e-6 lost 5 digits at the leading edge and made
the comb show a false kink at R_LE < 0.005. The analytic form matches the
closed-form circle curvature to 1.2e-13 over the whole test sweep.

refs #7
```

## Never

- `git push --force`
- `git commit --amend` on pushed commits
- Merge any pull request
- Mark any pull request as ready for review (the owner only)
- Commit to `main`
- Create a branch that was not explicitly requested

## Issues and the project board

**The board is the single source of truth for where work stands**, not a
markdown checklist.

- Every backlog item gets a GitHub issue **before any code is written**.
  Title: `BL-xx: <short title>`. The body states scope, acceptance criteria,
  and the spec section it implements.
- Create the issue WITH the board attached in one command, never without
  `--project`:

```bash
gh issue create --repo JonasPangerl/2D-Profile-Designer \
  --title "BL-xx: ..." --body-file body.md --project "2D Profile Designer"
```

- Close the issue from the **pull request body** with `Closes #23`, so the
  card moves automatically.
- Labels: `spec` for spec-only work, `blocked` when waiting on the owner,
  `milestone:M1` and friends for the current train.
- If a `gh` call fails with an auth or scope error, **stop and report it**.
  Do not fall back to editing markdown status files.
- Required `gh` scope: `project`. Grant it with
  `gh auth refresh -s project`.

## Pull requests

- Agents create **draft** pull requests only when the owner explicitly asks
  ("commit, push and create the pull request"). Not unprompted at the end of
  a session.
- Fill every section of `.github/PULL_REQUEST_TEMPLATE.md`: summary, spec
  section, changes, tests with their output, CI checklist, reviewer focus,
  screenshots where applicable.
- On Windows PowerShell, write the body to a temp file and pass `--body-file`.
  Heredocs are not reliable there.
- The owner reviews and merges. Always.

## Before you push

`pnpm verify` must exit 0. It runs the same list CI runs:

```bash
node scripts/check-ascii.mjs
node scripts/check-geometry-purity.mjs
node scripts/check-branding.mjs
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```
