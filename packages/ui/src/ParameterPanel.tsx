/**
 * Numeric entry for the selected element and anchor.
 *
 * Every field here calls the same `@foil/geometry` transformation the drag
 * handlers call. That is what makes "a drag and a typed value produce an
 * identical document" true by construction rather than by discipline.
 *
 * Fields an element-level parameter owns are shown, disabled, and say which
 * parameter to change instead. Hiding them would leave the user hunting.
 */

import {
  resolveElement,
  setAnchor,
  setElementParam,
  setPlacement,
  setSegmentDegree,
} from "@foil/geometry";
import type { Anchor, ElementSpec } from "@foil/geometry";
import { MIN_SEGMENT_DEGREE } from "@foil/geometry";
import { NumberField } from "./NumberField.js";
import { derivedAt } from "./AnchorHandles.js";
import { useEditor } from "./store.js";
import { toDegrees, toRadians } from "./units.js";

const DEGREE_CHOICES = [4, 5, 6, 7, 8];

export function ParameterPanel(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const apply = useEditor((s) => s.apply);
  const endCoalescing = useEditor((s) => s.endCoalescing);

  if (selection === null) {
    return (
      <aside className="panel">
        <p className="panel-empty">Select a profile to edit it.</p>
      </aside>
    );
  }

  const spec = doc.elements.find((e) => e.id === selection.elementId);
  if (spec === undefined) {
    return (
      <aside className="panel">
        <p className="panel-empty">That element is gone.</p>
      </aside>
    );
  }

  return (
    <aside className="panel">
      <ElementSection spec={spec} apply={apply} endCoalescing={endCoalescing} />
      {selection.anchorIndex !== null && (
        <AnchorSection
          spec={spec}
          anchorIndex={selection.anchorIndex}
          apply={apply}
          endCoalescing={endCoalescing}
        />
      )}
    </aside>
  );
}

/**
 * The store's `apply`, with the coalesce key it always had and this panel
 * used to drop. Dropping it meant every slider step was its own undo entry:
 * 241 of them from one departure-angle drag, which overflowed the history.
 */
type Apply = (
  change: (doc: Parameters<typeof setAnchor>[0]) => ReturnType<typeof setAnchor>,
  coalesceKey?: string,
) => void;

/** Turns NumberField's commit options into the store's coalesce key. */
function keyFor(id: string, field: string, options: { coalesce: boolean }): string | undefined {
  return options.coalesce ? `panel:${id}:${field}` : undefined;
}

function ElementSection({
  spec,
  apply,
  endCoalescing,
}: {
  spec: ElementSpec;
  apply: Apply;
  endCoalescing: () => void;
}): JSX.Element {
  return (
    <section>
      <h3>{spec.name}</h3>

      <NumberField
        label="Leading edge radius"
        value={spec.leRadius}
        decimals={4}
        step={0.0005}
        min={0.001}
        max={0.15}
        onCommit={(v, o) => apply((d) => setElementParam(d, spec.id, "leRadius", v), keyFor(spec.id, "leRadius", o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Nose axis"
        unit="deg"
        value={toDegrees(spec.leAxisAngle)}
        decimals={2}
        step={0.5}
        min={-30}
        max={30}
        onCommit={(v, o) => apply((d) => setElementParam(d, spec.id, "leAxisAngle", toRadians(v)), keyFor(spec.id, "leAxisAngle", o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Trailing edge thickness"
        value={spec.teThickness}
        decimals={4}
        step={0.0005}
        min={0}
        max={0.05}
        onCommit={(v, o) => apply((d) => setElementParam(d, spec.id, "teThickness", v), keyFor(spec.id, "teThickness", o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Departure angle"
        unit="deg"
        value={toDegrees(spec.departureAngle)}
        decimals={2}
        step={0.25}
        min={-30}
        max={30}
        onCommit={(v, o) => apply((d) => setElementParam(d, spec.id, "departureAngle", toRadians(v)), keyFor(spec.id, "departureAngle", o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Wedge angle"
        unit="deg"
        value={toDegrees(spec.wedgeAngle)}
        decimals={2}
        step={0.25}
        min={0}
        max={45}
        onCommit={(v, o) => apply((d) => setElementParam(d, spec.id, "wedgeAngle", toRadians(v)), keyFor(spec.id, "wedgeAngle", o))}
        onCommitEnd={endCoalescing}
      />

      <h4>Placement</h4>
      <NumberField
        label="Chord"
        value={spec.placement.chord}
        decimals={4}
        step={0.01}
        onCommit={(v, o) => apply((d) => setPlacement(d, spec.id, { chord: v }), keyFor(spec.id, "chord", o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Chord angle"
        unit="deg"
        value={toDegrees(spec.placement.chordAngle)}
        decimals={2}
        step={0.25}
        min={-30}
        max={30}
        onCommit={(v, o) =>
          apply((d) => setPlacement(d, spec.id, { chordAngle: toRadians(v) }), keyFor(spec.id, "chordAngle", o))
        }
        onCommitEnd={endCoalescing}
      />
    </section>
  );
}

function AnchorSection({
  spec,
  anchorIndex,
  apply,
  endCoalescing,
}: {
  spec: ElementSpec;
  anchorIndex: number;
  apply: Apply;
  endCoalescing: () => void;
}): JSX.Element {
  const element = resolveElement(spec);
  const anchor = element.anchors[anchorIndex] as Anchor;
  const derived = derivedAt(element, anchorIndex);
  const segmentCount = spec.anchors.length - 1;

  const set = (patch: Partial<Anchor>, coalesceKey?: string): void => {
    apply((d) => setAnchor(d, spec.id, anchorIndex, patch), coalesceKey);
  };

  const role =
    anchorIndex === 0
      ? "trailing edge, pressure side"
      : anchorIndex === spec.anchors.length - 1
        ? "trailing edge, suction side"
        : anchorIndex === element.leIndex
          ? "leading edge"
          : "free anchor";

  return (
    <section>
      <h4>
        Anchor {anchorIndex} <span className="panel-role">{role}</span>
      </h4>

      <NumberField
        label="x"
        value={anchor.x}
        decimals={4}
        step={0.005}
        disabled={derived.position}
        disabledReason="The trailing edge sits at x = 1 by the chord normalisation."
        onCommit={(v, o) => set({ x: v }, keyFor(spec.id, "ax:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="y"
        value={anchor.y}
        decimals={4}
        step={0.005}
        disabled={derived.position}
        disabledReason="Set by teThickness."
        onCommit={(v, o) => set({ y: v }, keyFor(spec.id, "ay:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Tangent"
        unit="deg"
        value={toDegrees(anchor.phi)}
        decimals={2}
        step={0.5}
        disabled={derived.phi}
        disabledReason={
          anchorIndex === element.leIndex
            ? "Set by the nose axis."
            : "Set by the departure and wedge angles."
        }
        onCommit={(v, o) => set({ phi: toRadians(v) }, keyFor(spec.id, "aphi:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Radius"
        value={anchor.R}
        decimals={4}
        step={0.005}
        allowInfinity
        disabled={derived.radius}
        disabledReason="Set by the leading edge radius."
        onCommit={(v, o) => set({ R: v }, keyFor(spec.id, "aR:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Arm in"
        value={anchor.Lin}
        decimals={4}
        step={0.002}
        min={0.001}
        max={0.5}
        onCommit={(v, o) => set({ Lin: v }, keyFor(spec.id, "aLin:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />
      <NumberField
        label="Arm out"
        value={anchor.Lout}
        decimals={4}
        step={0.002}
        min={0.001}
        max={0.5}
        onCommit={(v, o) => set({ Lout: v }, keyFor(spec.id, "aLout:" + anchorIndex, o))}
        onCommitEnd={endCoalescing}
      />

      {anchorIndex < segmentCount && (
        <label className="field">
          <span className="field-label">Degree of the next segment</span>
          <select
            className="field-input"
            value={spec.segmentDegrees[anchorIndex] ?? MIN_SEGMENT_DEGREE}
            onChange={(e) =>
              apply((d) => setSegmentDegree(d, spec.id, anchorIndex, Number(e.target.value)))
            }
          >
            {DEGREE_CHOICES.map((degree) => (
              <option key={degree} value={degree}>
                {degree}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
