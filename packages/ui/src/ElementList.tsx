/**
 * The element list: visibility, duplicate, reorder, delete.
 *
 * Visibility is the one control here that does not touch the document. A
 * hidden element is still saved and still exported; hiding is about
 * looking, not about the profile.
 */

import {
  deleteAnchor,
  duplicateElement,
  insertAnchor,
  moveElement,
  removeElement,
  resolveElement,
} from "@foil/geometry";
import { useEditor } from "./store.js";

export function ElementList(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const hidden = useEditor((s) => s.hidden);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const toggleVisible = useEditor((s) => s.toggleVisible);

  const nextId = (): string => {
    let n = doc.elements.length + 1;
    while (doc.elements.some((e) => e.id === `element-${n}`)) n += 1;
    return `element-${n}`;
  };

  return (
    <aside className="panel">
      <h3>Elements</h3>
      <ul className="element-list">
        {doc.elements.map((spec, index) => {
          const isSelected = selection?.elementId === spec.id;
          return (
            <li key={spec.id} className={isSelected ? "selected" : ""}>
              <button
                type="button"
                className="element-name"
                onClick={() => select(spec.id, null)}
              >
                {spec.name}
              </button>
              <div className="element-actions">
                <button
                  type="button"
                  title={hidden.has(spec.id) ? "Show" : "Hide"}
                  aria-pressed={!hidden.has(spec.id)}
                  onClick={() => toggleVisible(spec.id)}
                >
                  {hidden.has(spec.id) ? "hidden" : "shown"}
                </button>
                <button
                  type="button"
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => apply((d) => moveElement(d, spec.id, index - 1))}
                >
                  up
                </button>
                <button
                  type="button"
                  title="Move down"
                  disabled={index === doc.elements.length - 1}
                  onClick={() => apply((d) => moveElement(d, spec.id, index + 1))}
                >
                  down
                </button>
                <button
                  type="button"
                  title="Duplicate"
                  onClick={() => apply((d) => duplicateElement(d, spec.id, nextId()))}
                >
                  copy
                </button>
                <button
                  type="button"
                  title={
                    doc.elements.length === 1
                      ? "A document keeps at least one element"
                      : "Delete"
                  }
                  disabled={doc.elements.length === 1}
                  onClick={() => {
                    apply((d) => removeElement(d, spec.id));
                    if (isSelected) select(null);
                  }}
                >
                  delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <AnchorActions />
    </aside>
  );
}

function AnchorActions(): JSX.Element | null {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);

  if (selection === null) return null;
  const spec = doc.elements.find((e) => e.id === selection.elementId);
  if (spec === undefined) return null;

  const element = resolveElement(spec);
  const anchorIndex = selection.anchorIndex;
  const removable =
    anchorIndex !== null &&
    anchorIndex !== 0 &&
    anchorIndex !== spec.anchors.length - 1 &&
    anchorIndex !== element.leIndex;

  // Insert into the segment that starts at the selected anchor, or into the
  // first segment when only the element is selected.
  const segmentIndex = Math.min(anchorIndex ?? 0, spec.anchors.length - 2);

  return (
    <section className="anchor-actions">
      <h4>Anchors</h4>
      <button
        type="button"
        onClick={() => {
          apply((d) => insertAnchor(d, spec.id, segmentIndex, 0.5));
          select(spec.id, segmentIndex + 1);
        }}
      >
        Insert after {anchorIndex ?? 0}
      </button>
      <button
        type="button"
        disabled={!removable}
        title={
          removable
            ? "Delete the selected anchor"
            : "The leading edge and both trailing edge anchors are part of the model"
        }
        onClick={() => {
          if (anchorIndex === null) return;
          apply((d) => deleteAnchor(d, spec.id, anchorIndex));
          select(spec.id, null);
        }}
      >
        Delete selected
      </button>
    </section>
  );
}
