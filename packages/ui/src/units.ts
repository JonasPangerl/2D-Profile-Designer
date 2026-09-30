/**
 * The boundary between radians and degrees.
 *
 * Angles are radians everywhere inside the code and degrees only in the UI
 * (docs/spec/06-ui.md). This is the only place the conversion happens, so
 * there is exactly one door between the two.
 */

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Round for display without pretending to a precision the value does not
 * have. Returns a string, because a rounded number re-rendered by React
 * would fight the user's cursor in a text field.
 */
export function format(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "inf" : "-inf";
  return value.toFixed(decimals);
}
