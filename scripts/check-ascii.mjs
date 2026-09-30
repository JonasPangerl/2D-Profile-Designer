#!/usr/bin/env node
// Golden rule G10: English only, ASCII only.
//
// Every character committed to this repository must be ASCII. The one
// exception is the reviewed allow-list below, for symbols that are RENDERED
// IN THE UI and have no ASCII equivalent a user would accept.
//
// Usage:
//   node scripts/check-ascii.mjs          list offenders, exit 1 if any
//   node scripts/check-ascii.mjs --fix    transliterate what is safe
//
// The --fix pass only replaces characters listed in SAFE_REPLACEMENTS. It
// never guesses: anything else is reported and left alone, because a silent
// wrong substitution in a formula is worse than a failing check.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Symbols that may appear because they are rendered in the UI. Each entry
// names the file pattern it is allowed in, so an allowance in one component
// does not silently permit the character everywhere.
const UI_ALLOWLIST = [
  // Example shape, kept empty until a real need appears:
  // { char: "\u2713", where: /packages\/ui\/src\/icons\.tsx$/, why: "menu checkmark" },
];

const SAFE_REPLACEMENTS = new Map([
  ["\u2014", "-"], // em dash
  ["\u2013", "-"], // en dash
  ["\u2212", "-"], // minus sign
  ["\u2018", "'"], // left single quote
  ["\u2019", "'"], // right single quote
  ["\u201c", '"'], // left double quote
  ["\u201d", '"'], // right double quote
  ["\u2026", "..."], // ellipsis
  ["\u00a0", " "], // non-breaking space
  ["\u2192", "->"], // right arrow
  ["\u00b1", "+/-"], // plus-minus
  ["\u00d7", "x"], // multiplication sign
  ["\u00b0", " deg"], // degree sign
]);

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "pdf",
  "zip",
  "wasm",
]);

const fix = process.argv.includes("--fix");

function trackedFiles() {
  // Tracked files AND untracked ones that are not ignored. A new file that
  // has not been staged yet is exactly the file most likely to carry a
  // pasted em dash, so scanning only the index would miss the common case.
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  return [...new Set(out.split("\0").filter((p) => p.length > 0))];
}

function isAllowed(char, file) {
  return UI_ALLOWLIST.some((entry) => entry.char === char && entry.where.test(file));
}

let offenders = 0;
let fixedFiles = 0;

for (const file of trackedFiles()) {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (BINARY_EXTENSIONS.has(ext)) continue;
  if (file === "pnpm-lock.yaml") continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(text)) continue;

  if (fix) {
    let next = text;
    for (const [from, to] of SAFE_REPLACEMENTS) {
      next = next.split(from).join(to);
    }
    if (next !== text) {
      writeFileSync(file, next, "utf8");
      fixedFiles += 1;
      text = next;
    }
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    for (let c = 0; c < line.length; c += 1) {
      const char = line[c];
      if (char === undefined || char.charCodeAt(0) < 128) continue;
      if (isAllowed(char, file)) continue;
      const code = char.codePointAt(0)?.toString(16).padStart(4, "0");
      const hint = SAFE_REPLACEMENTS.has(char) ? " (--fix can replace this)" : "";
      console.error(`${file}:${i + 1}:${c + 1}  U+${code} ${JSON.stringify(char)}${hint}`);
      offenders += 1;
    }
  }
}

if (fix && fixedFiles > 0) {
  console.log(`check-ascii: rewrote ${fixedFiles} file(s)`);
}

if (offenders > 0) {
  console.error(`check-ascii: ${offenders} non-ASCII character(s) found. See golden rule G10.`);
  process.exit(1);
}

console.log("check-ascii: clean");
