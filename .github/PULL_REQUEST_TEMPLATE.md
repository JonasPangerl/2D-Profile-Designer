<!--
Every section is filled in. An empty section is an unfinished pull request.
See CONTRIBUTING.md.
-->

## Summary

One paragraph: what is true after this that was not true before.

## Spec section

Which part of `docs/spec/` this implements or changes. If it changes the
spec, say so and link the commit that changed it.

Closes #

## Changes

- `path/to/file.ts` - what changed and why

## Tests

Which tests were written before the implementation, and the output of the
run. Paste the real output; do not describe it.

```
pnpm --filter @foil/geometry test
...
```

If a test was a regression guard that was green from the start, call it a
guard. Never claim a red-then-green that was not observed.

## Measurements

Any number this change is justified by: a timing, a residual, a tolerance.
"It felt faster" is not a measurement.

## Checklist

- [ ] `pnpm verify` exits 0
- [ ] No test weakened, skipped or deleted
- [ ] No change outside what the plan names, or the deviation is stated below
- [ ] Care level stated, and for high care the diff was reviewed in a fresh
      context by someone other than the author
- [ ] `BACKLOG.md` rows that shipped were deleted in this branch
- [ ] `PROGRESS.md` has a block, or this work is routine and fully described
      by its issue and commits

## Reviewer focus

Where to look hardest, and what would be the most expensive thing to get
wrong here.

## Screenshots

For anything visible. A screenshot of a chart must be readable on its own.
