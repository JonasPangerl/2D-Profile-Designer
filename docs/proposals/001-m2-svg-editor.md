# 001 - M2: the SVG editor

## Revision 1, 2026-09-30 - overrides the body below

Three things the body got wrong. They are recorded here rather than edited
into the paragraphs, so a later reader sees the newest truth first.

**1. The insert and delete tolerances in "Tests" were invented.** The body
says the contour deviation was "measured at 1.4e-3". Nothing had been
measured at that point; the number was a guess written in the voice of a
measurement, which is exactly what the honesty rules forbid. The real
figures, taken on 2026-09-30 over all four segments at t = 0.25, 0.5 and
0.75 of the ladder preset:

| | deviation |
|---|---|
| insert, neighbour arms left alone | 1.2e-2 chord |
| insert, neighbour arms scaled by de Casteljau | 3.8e-6 to 7.4e-6 chord |
| insert then delete, without the arm rescale | 3.1e-4 to 7.9e-3 chord |
| insert then delete, with it | 0, worst case 4.7e-13 |

**2. "Insert and delete are not exact inverses" was wrong.** The body lists
it under Risks as something the tests should merely bound. They are exact
inverses, because the split parameter is recoverable from the departing
anchor: the insert sets `Lin = t*s/n` and `Lout = (1-t)*s/n`, so
`t = Lin / (Lin + Lout)`. `deleteAnchor` uses that to scale the neighbours
back up. The test asserts a round trip to 1e-9 rather than a loose bound.

**3. The arm lengths on insert are not "a third of the distance to each
neighbour".** That rule of thumb, from the body's Interfaces section and
from assumption 5, is what produced the 1.2e-2 deviation, and only half the
problem: it also left the two neighbouring anchors carrying arms sized for
the whole original segment. De Casteljau subdivision gives the right answer
for all three anchors and costs nothing.

One method note, because it nearly hid all of the above: the first version
of the test measured point-to-point distance between two sampled contours.
The sampler is density-adaptive, so the same shape sampled twice puts points
in different places, and that metric reported 1.2e-2 for a contour whose
true deviation is 6e-6. Deviation between contours is measured
point-to-polyline.

---


Issue: [#4](https://github.com/JonasPangerl/2D-Profile-Designer/issues/4)
Spec: `docs/spec/06-ui.md`, `docs/spec/09-milestones.md` M2
Care level: **high** - it is the first UI idiom in the repository and every
later panel copies it, and the document mutations it introduces are the seam
the whole tool hangs off (golden rule G7).

## Goal

A profile can be edited: anchors dragged, every parameter typed, anchors
inserted and deleted, elements listed and reordered, and all of it undone
and redone. Afterwards the studio app is an editor rather than a viewer.

## Non-goals

- The curvature-over-arclength plot and the comb controls. That is M3 (#5).
- Multi-element placement editing, gap and overlap readout. That is M4.
- `.dat` import and export, and the fit. That is M5.
- Saving to disk and comparing configurations. That is M6.
- Sharp corners. That is a model change, #6.
- Any styling beyond what makes the controls usable.

## The one decision that shapes everything else

**Dragging and numeric entry must not be two code paths.** The acceptance
criterion in the issue says the two produce an identical document, and the
cheapest way to guarantee that is to make it structurally true: both call
the same pure transformation.

Those transformations belong in `packages/geometry`, not in the UI, because
golden rule G7 says every feature is a transformation of the document and
golden rule G4 says the geometry core is where pure logic lives. The UI then
holds only the document, the history and the selection.

```
drag handler  --\
                 >--  edit.ts (pure, in @foil/geometry)  -->  new document
numeric field --/
```

## Files affected

New, in `packages/geometry`:

- `src/edit.ts` - pure document transformations. No React, no DOM.
- `tests/edit.test.ts` - the transformations, including the round trips.

New, in `packages/ui`:

- `src/store.ts` - Zustand store: document, history, selection, per-element
  visibility. Visibility is view state and deliberately does NOT go into the
  document.
- `src/units.ts` - `toDegrees` and `toRadians`, the only place the
  conversion happens (spec `06-ui.md`).
- `src/ProfileEditor.tsx` - the SVG surface, selection, drag handling.
- `src/AnchorHandles.tsx` - the handles for one element.
- `src/ParameterPanel.tsx` - numeric entry for the selected anchor and for
  the element-level parameters.
- `src/ElementList.tsx` - visibility, duplicate, reorder, delete.
- `src/NumberField.tsx` - one numeric input, used by every panel.
- `tests/store.test.ts` - the store, including that a drag and a typed value
  converge on the same document.
- `vitest.config.ts`, and `vitest` in `devDependencies`.

Changed:

- `packages/ui/src/index.ts` - export the new components.
- `packages/ui/package.json` - add `zustand`, add the test script.
- `apps/studio/src/App.tsx` - use the editor instead of the viewer.
- `apps/studio/src/styles.css` - layout for the panels.
- `packages/ui/src/ProfileView.tsx` - stays, unchanged, as the read-only
  renderer the embed element will reuse.

## Interfaces

### `packages/geometry/src/edit.ts`

Every function takes a document and returns a new one. None mutates. Each
throws `GeometryError` rather than returning a silently wrong document.

```ts
// Element-level
setElementParam(
  doc: ProfileDocument,
  elementId: string,
  key: "leAxisAngle" | "teThickness" | "departureAngle" | "wedgeAngle" | "leRadius",
  value: number,
): ProfileDocument

setPlacement(doc, elementId, placement: Partial<Placement>): ProfileDocument
setSegmentDegree(doc, elementId, segmentIndex: number, degree: number): ProfileDocument

// Anchor-level. `patch` carries any subset of the anchor fields, so a drag
// (x and y) and a typed radius go through the same door.
setAnchor(
  doc: ProfileDocument,
  elementId: string,
  anchorIndex: number,
  patch: Partial<Anchor>,
): ProfileDocument

// Structure
insertAnchor(doc, elementId, segmentIndex: number, t: number): ProfileDocument
deleteAnchor(doc, elementId, anchorIndex: number): ProfileDocument

// Elements
duplicateElement(doc, elementId, newId: string): ProfileDocument
removeElement(doc, elementId): ProfileDocument
moveElement(doc, elementId, toIndex: number): ProfileDocument
```

Rules the implementation must honour:

- `setAnchor` on the leading edge anchor or on either trailing edge anchor
  silently accepts a patch to a **derived** field and then loses it, because
  `resolveElement` recomputes those. That is a trap. Instead it throws
  `GEOM_DERIVED_FIELD`, and the UI edits the element-level parameter. This
  is the one new error code.
- `insertAnchor` puts the new anchor exactly on the current curve: position,
  `phi` and `R` come from `evaluateChain` at that parameter, so the inserted
  point is on the old contour to floating point. The arm lengths are set to
  a third of the distance to each neighbour, which is the usual choice and
  which is stated in the doc comment.
- `deleteAnchor` refuses to remove the leading edge anchor or either
  trailing edge anchor (`GEOM_TOO_FEW_ANCHORS`), because the model needs all
  three.
- `moveElement` clamps the target index rather than throwing, because a drag
  to the end of a list is a normal gesture.

### `packages/ui/src/store.ts`

```ts
interface EditorState {
  doc: ProfileDocument;
  past: ProfileDocument[];
  future: ProfileDocument[];
  selection: { elementId: string; anchorIndex: number | null } | null;
  hidden: ReadonlySet<string>;

  apply(next: (doc: ProfileDocument) => ProfileDocument, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  select(elementId: string | null, anchorIndex?: number | null): void;
  toggleVisible(elementId: string): void;
  load(doc: ProfileDocument): void;
}
```

`coalesceKey` is what makes a drag one undo entry instead of two hundred:
consecutive `apply` calls with the same non-empty key replace the previous
history entry rather than pushing a new one. A key of `undefined` always
pushes. The key a drag uses is `drag:<elementId>:<anchorIndex>:<field>`, and
pointer-up clears it.

History depth is capped at 100 documents. A document is a few kilobytes, so
that is well under a megabyte, and an unbounded stack in a long session is
how a browser tab dies.

### Drag handles

Three kinds, all on the same SVG surface:

| Handle | Drag changes | Shown for |
|---|---|---|
| Anchor | `x`, `y` | every anchor except the two trailing edge ones, which are fixed at `x = 1` by `teThickness` |
| Arm, incoming and outgoing | `Lin` or `Lout`, and `phi` together | every anchor whose `phi` is not derived |
| Radius | `R` | every anchor whose `R` is not derived |

The arm handle sets `phi` and the arm length in one patch, which is what
makes it feel like a pen tool. The radius handle moves along the curve
normal and its distance maps to `R` through `radiusFromOffset`, which is
already in the public API.

Handles for derived fields are drawn but not draggable, with the element
panel as the place to change them. Drawing them greyed out is cheaper to
understand than hiding them.

## Tests, written before the implementation

In `packages/geometry/tests/edit.test.ts`:

- `setAnchor applies a patch and leaves every other field alone`
- `setAnchor rejects a patch to a derived field` - throws
  `GEOM_DERIVED_FIELD` for the leading edge `phi` and `R`, and for the
  trailing edge `x`, `y` and `phi`
- `setAnchor never mutates the input document`
- `insertAnchor puts the new anchor exactly on the old curve` - the inserted
  position matches `evaluateChain` at that parameter to 1e-12
- `insertAnchor keeps the contour close` - the resampled contour moves by
  less than a tolerance chosen from the measurement, stated in a comment
- `insertAnchor keeps G2` - the continuity report still passes the M1
  tolerances
- `deleteAnchor refuses the leading edge and the trailing edges`
- `deleteAnchor undoes an insert on a plain section` - within a measured
  tolerance
- `duplicateElement produces an independent element with a new id`
- `moveElement clamps rather than throwing`
- `every transformation leaves the document parseable` - serialise and
  parse after each one

In `packages/ui/tests/store.test.ts`:

- **`a drag and a typed value produce an identical document`** - the
  acceptance criterion, asserted by serialising both and comparing strings
- `undo and redo restore the exact previous document`
- `a coalesced run of applies is one undo entry`
- `a new edit clears the redo stack`
- `history is capped`
- `visibility is not part of the document`

Command:

```bash
pnpm --filter @foil/geometry test && pnpm --filter @foil/ui test
```

## Acceptance criteria

1. `pnpm verify` exits 0.
2. `a drag and a typed value produce an identical document` passes.
3. Undo and redo cover both paths, with one entry per drag gesture.
4. An anchor can be inserted and deleted in the running app, and the
   inserted anchor lies on the old curve to 1e-12.
5. The studio app lets a profile be edited by hand and by number, which a
   screenshot in the pull request shows.

## Risks and open points

- **Zustand is a new dependency.** `docs/spec/05-architecture.md` names it,
  so this is the spec being implemented rather than a new decision. It is
  recorded in `PROGRESS.md` when it lands.
- **SVG pointer coordinates.** Converting a pointer event to a document
  coordinate has to go through the SVG's own CTM, not through manual
  arithmetic on the viewBox, or the mapping breaks the moment the element is
  scaled by CSS. This is the single most likely source of a subtle bug in
  this diff and the reviewer should look there first.
- **The y axis is flipped** between aerodynamics and SVG. `ProfileView`
  already handles it with one `scale(1, -1)`. Every pointer coordinate has
  to pass back through that same transform, and doing it in two places is
  exactly the "one door per concern" failure the workflow warns about.
- **Insert and delete are not exact inverses.** They cannot be: deleting an
  anchor removes degrees of freedom. The tests state measured tolerances
  rather than pretending otherwise.

## What I assumed

1. Dragging applies to anchors and to handles, not to the contour itself.
   Dragging the curve between anchors is a different interaction and is not
   in the spec.
2. Angles in the UI are degrees, radians behind it, per
   `docs/spec/06-ui.md`.
3. Element visibility is view state, not document state, so it is not
   saved. A hidden element is still exported.
4. One undo entry per drag gesture, not per pointer move.
5. Inserting an anchor sets its arm lengths to a third of the distance to
   each neighbour. Nothing in the spec fixes this; it is the conventional
   choice and it is stated in the doc comment.
6. The two trailing edge anchors stay at `x = 1`. The spec places them there
   and offsets them by `teThickness`; letting them move would make the chord
   normalisation meaningless.

## Open questions for the owner

Answering these changes the UI but not the architecture, so the work
proceeds on the recommendation and can be changed cheaply afterwards.

1. **Should the radius be draggable at all, or numeric only?**
   A radius handle is a fourth thing on screen per anchor, and at fifteen
   anchors the surface gets busy. Numeric only is calmer; draggable is
   faster once learned.
   *Recommendation: draggable, but only for the selected anchor.* Handles
   for unselected anchors stay as plain dots.

2. **Should an element be deletable from the element list when it is the
   last one?**
   An empty document is a valid state but an unhelpful one.
   *Recommendation: no. Keep at least one element and grey out the control.*
