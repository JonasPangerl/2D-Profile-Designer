/**
 * The standalone application.
 *
 * It owns no document state of its own: the store in `@foil/ui` holds it,
 * and every control here is a consumer of the same transformations
 * (golden rule G6).
 */

import { useEffect, useState } from "react";
import {
  ElementList,
  ErrorBoundary,
  ParameterPanel,
  ProfileEditor,
  useEditor,
} from "@foil/ui";
import { createDocument, ladderElement, ladderFromNaca } from "@foil/geometry";

declare const __BUILD_VERSION__: string;

export function App(): JSX.Element {
  const [combGain, setCombGain] = useState(0.05);
  const [showComb, setShowComb] = useState(true);
  const load = useEditor((s) => s.load);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);

  // Ctrl+Z and Ctrl+Shift+Z, which is what every editor does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      // Let a text field keep its own undo.
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const loadPreset = (code: string | null): void => {
    const element = code === null ? ladderElement() : ladderFromNaca(code);
    load(createDocument([element], code === null ? "Ladder preset" : `NACA ${code}`));
  };

  return (
    <main className="app">
      <header>
        <h1>2D Profile Designer</h1>
        <span className="version">{__BUILD_VERSION__}</span>
        <div className="toolbar">
          <button type="button" disabled={past.length === 0} onClick={undo}>
            Undo
          </button>
          <button type="button" disabled={future.length === 0} onClick={redo}>
            Redo
          </button>
          <button type="button" onClick={() => loadPreset(null)}>
            Ladder preset
          </button>
          <button type="button" onClick={() => loadPreset("2412")}>
            From code 2412
          </button>
        </div>
      </header>

      <section className="canvas">
        <ErrorBoundary onRecover={undo}>
          <ProfileEditor combGain={combGain} showComb={showComb} />
        </ErrorBoundary>
      </section>

      <div className="columns">
        <ElementList />
        <ParameterPanel />
      </div>

      <section className="controls">
        <label>
          <input
            type="checkbox"
            checked={showComb}
            onChange={(e) => setShowComb(e.target.checked)}
          />
          Curvature comb
        </label>
        <label>
          Comb scale
          <input
            type="range"
            min={0.005}
            max={0.2}
            step={0.005}
            value={combGain}
            disabled={!showComb}
            onChange={(e) => setCombGain(Number(e.target.value))}
          />
          <span className="value">{combGain.toFixed(3)}</span>
        </label>
      </section>

      <footer>
        <p>
          Click a profile to select it, then an anchor to see its handles.
          Drag the anchor, its arms or the centre of curvature, or type any
          value in the panel. The curvature plot arrives with the next
          milestone.
        </p>
      </footer>
    </main>
  );
}
