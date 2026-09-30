/**
 * The editor store. See docs/proposals/001-m2-svg-editor.md.
 *
 * The first test in this file is the M2 acceptance criterion.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  createDocument,
  ladderElement,
  serialiseDocumentJson,
  setAnchor,
  setElementParam,
} from "@foil/geometry";
import { HISTORY_LIMIT, useEditor } from "../src/store.js";

const ID = "element-1";

function freshDocument() {
  return createDocument([ladderElement()], "Test", "2026-09-30T00:00:00.000Z");
}

beforeEach(() => {
  useEditor.getState().load(freshDocument());
});

describe("the acceptance criterion", () => {
  it("a drag and a typed value produce an identical document", () => {
    // What a drag does: the pointer lands somewhere and the handler patches
    // x and y in one go.
    useEditor.getState().apply(
      (doc) => setAnchor(doc, ID, 1, { x: 0.42, y: -0.055 }),
      "drag:element-1:1:position",
    );
    useEditor.getState().endCoalescing();
    const dragged = serialiseDocumentJson(useEditor.getState().doc);

    // What two number fields do: one patch each, from a clean start.
    useEditor.getState().load(freshDocument());
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.42 }));
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { y: -0.055 }));
    const typed = serialiseDocumentJson(useEditor.getState().doc);

    expect(typed).toBe(dragged);
  });

  it("holds for the element-level parameters too", () => {
    useEditor
      .getState()
      .apply((doc) => setElementParam(doc, ID, "wedgeAngle", 0.31), "drag:element-1:wedge");
    useEditor.getState().endCoalescing();
    const dragged = serialiseDocumentJson(useEditor.getState().doc);

    useEditor.getState().load(freshDocument());
    useEditor.getState().apply((doc) => setElementParam(doc, ID, "wedgeAngle", 0.31));
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(dragged);
  });
});

describe("history", () => {
  it("undo and redo restore the exact previous document", () => {
    const start = serialiseDocumentJson(useEditor.getState().doc);
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.5 }));
    const changed = serialiseDocumentJson(useEditor.getState().doc);
    expect(changed).not.toBe(start);

    useEditor.getState().undo();
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(start);

    useEditor.getState().redo();
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(changed);
  });

  it("a coalesced run of applies is one undo entry", () => {
    const start = serialiseDocumentJson(useEditor.getState().doc);
    const key = "drag:element-1:1:position";
    for (let i = 1; i <= 50; i += 1) {
      useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.3 + i / 1000 }), key);
    }
    useEditor.getState().endCoalescing();

    expect(useEditor.getState().past.length).toBe(1);
    useEditor.getState().undo();
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(start);
  });

  it("two gestures with the same key but an end between them are two entries", () => {
    const key = "drag:element-1:1:position";
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.31 }), key);
    useEditor.getState().endCoalescing();
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.32 }), key);
    useEditor.getState().endCoalescing();
    expect(useEditor.getState().past.length).toBe(2);
  });

  it("a new edit clears the redo stack", () => {
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.5 }));
    useEditor.getState().undo();
    expect(useEditor.getState().canRedo()).toBe(true);
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { y: -0.1 }));
    expect(useEditor.getState().canRedo()).toBe(false);
  });

  it("caps the history", () => {
    for (let i = 0; i < HISTORY_LIMIT + 40; i += 1) {
      useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.2 + i / 10000 }));
    }
    expect(useEditor.getState().past.length).toBe(HISTORY_LIMIT);
  });

  it("undo does nothing on an empty stack", () => {
    const start = serialiseDocumentJson(useEditor.getState().doc);
    useEditor.getState().undo();
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(start);
    expect(useEditor.getState().canUndo()).toBe(false);
  });

  it("loading a document clears the history", () => {
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 1, { x: 0.5 }));
    useEditor.getState().load(freshDocument());
    expect(useEditor.getState().canUndo()).toBe(false);
    expect(useEditor.getState().canRedo()).toBe(false);
  });
});

describe("a refused edit", () => {
  it("leaves the document and the history alone", () => {
    const start = serialiseDocumentJson(useEditor.getState().doc);
    // The leading edge tangent is derived; setAnchor throws.
    useEditor.getState().apply((doc) => setAnchor(doc, ID, 2, { phi: 1 }));
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(start);
    expect(useEditor.getState().canUndo()).toBe(false);
  });

  it("does not push history for a transformation that changed nothing", () => {
    useEditor.getState().apply((doc) => doc);
    expect(useEditor.getState().canUndo()).toBe(false);
  });
});

describe("selection and visibility", () => {
  it("selects an element and an anchor", () => {
    useEditor.getState().select(ID, 3);
    expect(useEditor.getState().selection).toEqual({ elementId: ID, anchorIndex: 3 });
    useEditor.getState().select(null);
    expect(useEditor.getState().selection).toBe(null);
  });

  it("visibility is not part of the document", () => {
    const before = serialiseDocumentJson(useEditor.getState().doc);
    useEditor.getState().toggleVisible(ID);
    expect(useEditor.getState().isVisible(ID)).toBe(false);
    // The point of the test: hiding an element must not touch the document,
    // so a hidden element is still saved and still exported.
    expect(serialiseDocumentJson(useEditor.getState().doc)).toBe(before);
    expect(useEditor.getState().canUndo()).toBe(false);
  });
});
