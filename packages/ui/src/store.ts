/**
 * The editor store.
 *
 * It holds three things and no more: the document, the history, and what is
 * selected. Every change to the document goes through `apply`, which takes
 * a transformation from `@foil/geometry` - the UI never edits a document
 * field directly, which is what keeps dragging and numeric entry on one
 * code path (golden rules G6 and G7).
 *
 * Element visibility lives here rather than in the document, because it is
 * a property of looking at a profile, not of the profile.
 */

import { create } from "zustand";
import { defaultDocument } from "@foil/geometry";
import type { ProfileDocument } from "@foil/geometry";
import { log } from "./log.js";

/**
 * How many documents the undo stack keeps.
 *
 * A document is a few kilobytes, so 100 is well under a megabyte. An
 * unbounded stack is how a long editing session kills a browser tab.
 */
export const HISTORY_LIMIT = 100;

export interface Selection {
  readonly elementId: string;
  /** `null` means the element is selected but no individual anchor is. */
  readonly anchorIndex: number | null;
}

export interface EditorState {
  doc: ProfileDocument;
  past: ProfileDocument[];
  future: ProfileDocument[];
  selection: Selection | null;
  hidden: ReadonlySet<string>;
  /** The coalesce key of the entry currently on top of the undo stack. */
  lastKey: string | null;

  /**
   * Apply a document transformation.
   *
   * `coalesceKey` is what makes one drag one undo entry: consecutive calls
   * carrying the same key replace the top of the stack instead of pushing
   * onto it. Pass `undefined` for a discrete change, and call
   * `endCoalescing` when a gesture finishes.
   *
   * A transformation that throws is reported and dropped. The document is
   * left alone rather than half-changed: an editor that refuses an illegal
   * drag is better than one that stores it.
   */
  apply(change: (doc: ProfileDocument) => ProfileDocument, coalesceKey?: string): void;
  endCoalescing(): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  select(elementId: string | null, anchorIndex?: number | null): void;
  toggleVisible(elementId: string): void;
  isVisible(elementId: string): boolean;
  load(doc: ProfileDocument): void;
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: defaultDocument(new Date().toISOString()),
  past: [],
  future: [],
  selection: null,
  hidden: new Set<string>(),
  lastKey: null,

  apply(change, coalesceKey) {
    const state = get();
    let next: ProfileDocument;
    try {
      next = change(state.doc);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "UNKNOWN";
      log.warn("an edit was refused", {
        code,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (next === state.doc) return;

    const coalescing =
      coalesceKey !== undefined && coalesceKey === state.lastKey && state.past.length > 0;

    const past = coalescing ? state.past : [...state.past, state.doc].slice(-HISTORY_LIMIT);

    set({
      doc: next,
      past,
      // Any new edit invalidates the redo branch.
      future: [],
      lastKey: coalesceKey ?? null,
    });
  },

  endCoalescing() {
    set({ lastKey: null });
  },

  undo() {
    const { past, doc, future } = get();
    const previous = past[past.length - 1];
    if (previous === undefined) return;
    set({
      doc: previous,
      past: past.slice(0, -1),
      future: [doc, ...future].slice(0, HISTORY_LIMIT),
      lastKey: null,
    });
  },

  redo() {
    const { past, doc, future } = get();
    const next = future[0];
    if (next === undefined) return;
    set({
      doc: next,
      past: [...past, doc].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      lastKey: null,
    });
  },

  canUndo() {
    return get().past.length > 0;
  },

  canRedo() {
    return get().future.length > 0;
  },

  select(elementId, anchorIndex = null) {
    set({ selection: elementId === null ? null : { elementId, anchorIndex } });
  },

  toggleVisible(elementId) {
    const hidden = new Set(get().hidden);
    if (hidden.has(elementId)) hidden.delete(elementId);
    else hidden.add(elementId);
    set({ hidden });
  },

  isVisible(elementId) {
    return !get().hidden.has(elementId);
  },

  load(doc) {
    set({ doc, past: [], future: [], selection: null, lastKey: null });
    log.info("document loaded", {
      schemaVersion: doc.schemaVersion,
      elements: doc.elements.length,
    });
  },
}));
