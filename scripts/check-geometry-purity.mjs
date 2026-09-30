#!/usr/bin/env node
// Golden rule G4: packages/geometry imports nothing and knows nothing about
// rendering. The later Rust/WASM port and the worker offloading both hang
// off this, and both become impossible the moment a DOM reference or a
// dependency creeps in.
//
// This script fails if packages/geometry:
//   - declares any runtime dependency,
//   - imports anything outside its own source tree,
//   - references a browser or Node global,
//   - holds module-level mutable state (a top-level `let` or `var`).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "packages/geometry";
const SRC = join(ROOT, "src");

const FORBIDDEN_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "fetch",
  "XMLHttpRequest",
  "process",
  "require",
  "__dirname",
  "globalThis",
  "console",
];

const problems = [];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (p.endsWith(".ts")) files.push(p);
  }
  return files;
}

// 1. No runtime dependencies.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  const deps = pkg[field] ?? {};
  for (const name of Object.keys(deps)) {
    problems.push(`${ROOT}/package.json: ${field} must be empty, found "${name}"`);
  }
}

// 2 to 4, per source file.
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  // Comments are prose and must not trip the checks: a doc comment saying
  // "as stored in the document." is not a DOM reference.
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf("*/");
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const open = line.indexOf("/*");
    if (open !== -1) {
      const close = line.indexOf("*/", open + 2);
      if (close === -1) {
        line = line.slice(0, open);
        inBlockComment = true;
      } else {
        line = line.slice(0, open) + line.slice(close + 2);
      }
    }
    line = line.replace(/\/\/.*$/, "");

    const importMatch = line.match(/\bfrom\s+["']([^"']+)["']/);
    if (importMatch) {
      const spec = importMatch[1] ?? "";
      if (!spec.startsWith(".")) {
        problems.push(`${file}:${i + 1}: imports "${spec}"; geometry imports nothing`);
      }
    }
    if (/\bawait\s+import\(/.test(line) || /\brequire\(/.test(line)) {
      problems.push(`${file}:${i + 1}: dynamic import or require is not allowed here`);
    }

    for (const g of FORBIDDEN_GLOBALS) {
      const re = new RegExp(`(?<![\\w.$])${g}\\s*[.(\\[]`);
      if (re.test(line)) {
        problems.push(`${file}:${i + 1}: references the global "${g}"`);
      }
    }

    if (/^(let|var)\s+/.test(raw)) {
      problems.push(
        `${file}:${i + 1}: module-level mutable state. Geometry must be stateless.`,
      );
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error(`check-geometry-purity: ${problems.length} violation(s). See golden rule G4.`);
  process.exit(1);
}

console.log("check-geometry-purity: clean");
