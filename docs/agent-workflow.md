# Agent workflow

How work is planned, delegated, reviewed and finished in this repository.
Read this at the start of every session. `CLAUDE.md` carries the short form;
this file is the long one.

The single sentence behind all of it:

> **Result quality beats cost, always.** Optimise cost only where it cannot
> endanger the result. When in doubt, spend the extra thinking.

---

## 1. One model tier

The strongest available model does everything: planning, architecture, tests,
implementation, restricted areas, review. Nothing is delegated to a weaker
model to save money, because the principle above rules that out.

What differs between tasks is not the model but the CARE they need, and care
is expressed as PROCESS.

**Escalation no longer means handing the task to a stronger model - there is
none. It means: go back to the plan, question the decomposition, and if the
owner holds the missing fact, ask him.**

## 2. Care levels

| Normal care | High care |
|---|---|
| UI wiring in an existing idiom | Architecture, decomposition, cross-cutting refactors |
| Implementation against a clear plan | Debugging without a clear cause |
| Boilerplate, renames, mechanical repetition | Numerics: curves, curvature, fitting, sampling |
| Docs, comments, lint fixes | The schema and its migrations |
| Scripts off the production path | Anything whose output a user reads as a number |
|  | Public APIs and file formats (`.dat`, the JSON document) |

> Rule of thumb: if a silent error costs more than any conceivable token
> spend, it is high care. End of discussion.

In this repository the permanently restricted areas are:

- `packages/geometry/src/bezier.ts`, `anchors.ts`, `curvature.ts`,
  `sampling.ts` - the curve maths;
- the fit solver (from M5 on);
- `packages/geometry/src/schema.ts` and `migrations.ts`;
- the `.dat` reader and writer;
- anything that changes numbers already shown to a user.

High care means, without exception:

1. a written plan in `docs/proposals/` before any code;
2. tests written before the implementation;
3. an INDEPENDENT review of the diff in a FRESH context.

**The author never certifies its own restricted-area work.**

## 3. The loop

```
Plan + interfaces + tests        (the thinking step)
        |
        v
Implementation against the tests  (max 3 attempts)
        |
        v
Independent review of the diff    (FRESH context)
        |
        v
Merge
```

Keep the halves as separate STEPS even when one agent does both: the plan and
the tests exist before the code does.

**Why tests rather than an exhaustive plan:** a perfect plan is expensive and
still has gaps. Tests are cheaper and catch exactly the gaps the plan leaves.

**Why the review works:** the reviewer does not share the author's
assumptions. That is why it needs a FRESH CONTEXT, not a stronger model.

**The three-attempt rule.** Stop after three implementation attempts on one
plan, and immediately on any of: changing the same place twice without
success, weakening a test instead of fixing the code, deviating from the plan.
Discard that context. Restart from the plan, the diff and the error. A second
stop means the task is cut wrong - back to planning.

## 4. Delegation

**Whenever work CAN be delegated, spawn a subagent; run independent pieces in
PARALLEL.** The owner should never have to ask for this.

Every brief states, without exception:

- the **goal**;
- the **files to start from** (paths and symbols, so nothing is searched);
- the **acceptance criterion**;
- the **care level** (normal or high);
- that `CLAUDE.md` and `docs/agent-workflow.md` apply.

A subagent inherits none of this by osmosis. A subagent that finds it needs a
repo-wide search reports that the brief was thin instead of guessing.

Rules for parallel agents:

- Their branches and worktrees are **temporary and LOCAL ONLY** - never
  pushed, never left behind. This is the one standing exception to "do not
  create a branch".
- The moment an agent finishes, the orchestrator merges or cherry-picks its
  commits into the working branch, **deletes the branch and worktree right
  away**, runs the checks, and only then pushes.
- Agents do not bump versions, do not build the production bundle, and do not
  push. The orchestrator does all three after merging.
- Every brief tells the agent to fast-forward to the working branch first; an
  agent worktree can start stale.
- Split work onto **disjoint files**. Where two packages must touch the same
  file, run them sequentially and say so in both briefs.

### Worktree traps in this repo

- A `node_modules` **junction** inside a worktree: delete it with
  `cmd //c rmdir <worktree>/node_modules` (no `/s`) BEFORE
  `git worktree remove`, or the removal deletes through it and empties the
  main checkout. The same applies to every nested `node_modules` a pnpm
  install created.
- `pnpm install` inside a worktree creates a separate store link farm. Run
  the tests from the worktree root and confirm from the vitest header that
  the resolved `packages/geometry` path is the worktree one, not the main
  checkout.

## 5. The plan template (binding for high-care work)

A high-care plan missing any of these fields is unfinished and must not be
implemented. Plans live in `docs/proposals/<NNN>-<slug>.md`.

```markdown
## Goal
One sentence. What is true afterwards that was not true before?

## Non-goals
What is explicitly not touched.

## Files affected
- path/to/file.ts - what changes

## Interfaces / signatures
Exact signatures, types, return values, error cases.

## Tests (written BEFORE the implementation)
- test name - checks ...
Command to run them: ...

## Acceptance criteria
Checkable, not "it works": the test command passes, or the reference case
reproduces value X within tolerance.

## Care level
normal | high - with a one-sentence reason (restricted area? which one).

## Risks / open points
What can go wrong and how it would show. Open points only the owner can
settle go to him BEFORE implementation, not after.

## What I assumed
Every assumption stated so it can be checked.

## Open questions for the owner
Each with the options, the consequence of each, and a RECOMMENDATION.
```

When a plan is revised after review or after the owner answers, put the
revision at the TOP as a section that explicitly **overrides** the body,
rather than editing every paragraph. A later reader must see the newest truth
first and know which document wins.

## 6. Definition of done

- [ ] Tests green, including the ones written before the implementation
- [ ] Diff reviewed in a fresh context (mandatory for high care)
- [ ] No change outside what the plan names, or the deviation stated and
      justified
- [ ] No weakened or disabled tests
- [ ] Conventions from `CLAUDE.md` observed
- [ ] `pnpm verify` exits 0
- [ ] Acceptance criterion demonstrably met, by someone who re-ran it

## 7. Anti-patterns

| Anti-pattern | Why it hurts |
|---|---|
| Restricted-area work without tests first | The error goes silent; debugging costs a multiple |
| The author reviewing its own restricted-area diff | It shares the assumptions that produced the bug |
| Implementing without tests | Plan gaps surface late |
| Endless rounds of fixing | More expensive than re-planning once |
| Carrying context forward after a failed attempt | Poisons the next attempt, costs twice |
| Skipping review because "it was small" | The small diffs are the ones that slip through |
| Copying conventions into every prompt | They belong in `CLAUDE.md` |
| Free exploration without a plan | The single biggest token sink |
| Economising on thinking | Exactly the wrong direction |

## 8. Honesty rules

These are not politeness; they are what makes a report worth reading.

- **Report outcomes faithfully.** If tests fail, say so with the output. If a
  step was skipped, say that. When something is done and verified, say it
  plainly without hedging.
- **Never claim a red-then-green you did not see.** A regression guard that
  was green from the start is legitimate, but it must be CALLED a guard.
- **Measure, do not reason, when a measurement is possible.** "I think the
  fit is slow because of the Jacobian" is worth nothing next to a timing
  breakdown per iteration.
- **Contradict the brief when the code says otherwise, with evidence.** A
  brief is a hypothesis. Refuting it with a measurement is the behaviour to
  reward, not a problem.
- **An honest correction belongs in the journal** under `HONEST CORRECTION:`.
- **Name the direction an estimate must err in.** "A plausible wrong number
  is worse than a crash."

## 9. Phrases that remove room for interpretation

- "When `CLAUDE.md` and `docs/spec/` conflict, **the spec wins.**"
- "A journal that logs everything is read by nobody."
- "An item without an acceptance criterion is not scheduled."
- "The author never certifies its own restricted-area work."
- "A plausible wrong number is worse than a crash."
