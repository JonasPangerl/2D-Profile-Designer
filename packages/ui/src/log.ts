/**
 * The one logger. See LOGGING.md.
 *
 * The geometry core does not log at all; it throws typed errors and the
 * caller decides whether that is worth a line. Everything visible logs
 * through here, so that levels and structured fields stay consistent and
 * greppable.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Flat structured fields. No value is interpolated into the message. */
export type LogFields = Readonly<Record<string, unknown>>;

function activeLevel(): LogLevel {
  // `debug` is off unless the URL asks for it: `?log=debug`.
  if (typeof window === "undefined") return "info";
  const value = new URLSearchParams(window.location.search).get("log");
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

function emit(level: LogLevel, message: string, fields: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLevel()]) return;
  const line = `[${level}] ${message}`;
  // eslint-disable-next-line no-console
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line, fields);
}

export const log = {
  debug: (message: string, fields: LogFields = {}): void => emit("debug", message, fields),
  info: (message: string, fields: LogFields = {}): void => emit("info", message, fields),
  warn: (message: string, fields: LogFields = {}): void => emit("warn", message, fields),
  error: (message: string, fields: LogFields = {}): void => emit("error", message, fields),
};
