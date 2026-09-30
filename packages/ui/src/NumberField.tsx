/**
 * One numeric input, used by every panel.
 *
 * Two behaviours worth stating, because both are the kind of thing that
 * gets reimplemented differently in each panel if it is not shared:
 *
 * - The field keeps the text the user is typing and only commits a parsed
 *   value. Re-rendering a rounded number into the input while someone is
 *   typing `0.0` fights their cursor.
 * - A value outside the slider range is accepted. The range is a comfort
 *   default, not a constraint (docs/spec/06-ui.md).
 */

import { useEffect, useState } from "react";

export interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly onCommit: (value: number) => void;
  readonly step?: number;
  /** Slider bounds. Omit both to get a plain field with no slider. */
  readonly min?: number;
  readonly max?: number;
  readonly decimals?: number;
  readonly unit?: string;
  readonly disabled?: boolean;
  /** Why it is disabled, shown as a title so the reason is discoverable. */
  readonly disabledReason?: string;
  /** `Infinity` is a legal value for a curvature radius. */
  readonly allowInfinity?: boolean;
}

export function NumberField({
  label,
  value,
  onCommit,
  step = 0.001,
  min,
  max,
  decimals = 4,
  unit,
  disabled = false,
  disabledReason,
  allowInfinity = false,
}: NumberFieldProps): JSX.Element {
  const display = Number.isFinite(value) ? value.toFixed(decimals) : "inf";
  const [text, setText] = useState(display);
  const [editing, setEditing] = useState(false);

  // Follow the document while the field is not being typed into.
  useEffect(() => {
    if (!editing) setText(display);
  }, [display, editing]);

  const commit = (raw: string): void => {
    const trimmed = raw.trim().toLowerCase();
    if (allowInfinity && (trimmed === "inf" || trimmed === "infinity")) {
      onCommit(Infinity);
      return;
    }
    const parsed = Number(trimmed);
    if (trimmed === "" || Number.isNaN(parsed)) {
      // Reject rather than substitute: silently turning a typo into 0 is
      // how a profile changes without anyone deciding to change it.
      setText(display);
      return;
    }
    onCommit(parsed);
  };

  const showSlider = min !== undefined && max !== undefined && Number.isFinite(value);

  return (
    <label className="field" title={disabled ? disabledReason : undefined}>
      <span className="field-label">
        {label}
        {unit !== undefined && <span className="field-unit">{unit}</span>}
      </span>
      {showSlider && (
        <input
          className="field-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          disabled={disabled}
          onChange={(e) => onCommit(Number(e.target.value))}
        />
      )}
      <input
        className="field-input"
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          setEditing(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setText(display);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
