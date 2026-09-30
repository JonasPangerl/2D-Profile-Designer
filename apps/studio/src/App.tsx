/**
 * The standalone application.
 *
 * At M1 this is a viewer, not the editor: it proves the geometry core
 * produces a profile and gives M2 a place to put the first drag handle. The
 * controls here change the document, never the rendering, which is golden
 * rule G7 in its smallest possible form.
 */

import { useMemo, useState } from "react";
import { ProfileView } from "@foil/ui";
import { createDocument, ladderElement, ladderFromNaca } from "@foil/geometry";
import type { ProfileDocument } from "@foil/geometry";

declare const __BUILD_VERSION__: string;

const SEGMENT_DEGREES = [4, 5, 6, 7, 8];

export function App(): JSX.Element {
  const [code, setCode] = useState("2412");
  const [useNaca, setUseNaca] = useState(false);
  const [segmentDegree, setSegmentDegree] = useState(4);
  const [combGain, setCombGain] = useState(0.06);
  const [showControlPoints, setShowControlPoints] = useState(true);

  const doc: ProfileDocument = useMemo(() => {
    const element = useNaca
      ? ladderFromNaca(/^\d{4}$/.test(code) ? code : "0012", { segmentDegree })
      : ladderElement({ segmentDegree });
    return createDocument([element], useNaca ? `NACA ${code}` : "Ladder preset");
  }, [code, useNaca, segmentDegree]);

  return (
    <main className="app">
      <header>
        <h1>2D Profile Designer</h1>
        <span className="version">{__BUILD_VERSION__}</span>
      </header>

      <section className="canvas">
        <ProfileView doc={doc} combGain={combGain} showControlPoints={showControlPoints} />
      </section>

      <section className="controls">
        <label>
          <input
            type="checkbox"
            checked={useNaca}
            onChange={(e) => setUseNaca(e.target.checked)}
          />
          Edge parameters from a four-digit code
        </label>

        <label>
          Code
          <input
            type="text"
            value={code}
            maxLength={4}
            disabled={!useNaca}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>

        <label>
          Segment degree
          <select
            value={segmentDegree}
            onChange={(e) => setSegmentDegree(Number(e.target.value))}
          >
            {SEGMENT_DEGREES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label>
          Curvature comb
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.005}
            value={combGain}
            onChange={(e) => setCombGain(Number(e.target.value))}
          />
          <span className="value">{combGain.toFixed(3)}</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={showControlPoints}
            onChange={(e) => setShowControlPoints(e.target.checked)}
          />
          Control points
        </label>
      </section>

      <footer>
        <p>
          Viewer only at this milestone. Dragging, numeric entry and the
          curvature plot arrive with the editor.
        </p>
      </footer>
    </main>
  );
}
