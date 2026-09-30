#!/usr/bin/env node
// Golden rule G12: no third-party product is named in user-facing text.
//
// Reference implementations, papers and competitor tools belong in docs/,
// never in the UI. This script scans the source of the packages that produce
// visible text and fails on a forbidden name.
//
// docs/ is exempt on purpose: that is where the references live.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SCANNED_ROOTS = [
  "packages/ui/src",
  "packages/embed/src",
  "packages/solver/src",
  "apps/studio/src",
];

// Names that must not reach a user. Matched case-insensitively on a word
// boundary. Add a name here in the same commit that discovers the need.
const FORBIDDEN = [
  "xfoil",
  "mfoil",
  "pymead",
  "pyairpar",
  "flexfoil",
  "javafoil",
  "xflr5",
  "ansys",
  "fluent",
  "openfoam",
  "star-ccm",
  "solidworks",
  "catia",
  "rhino",
];

const problems = [];

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (/\.(ts|tsx|css|html)$/.test(p)) files.push(p);
  }
  return files;
}

for (const root of SCANNED_ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      for (const name of FORBIDDEN) {
        const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(line)) {
          problems.push(`${file}:${i + 1}: names "${name}" in user-facing code`);
        }
      }
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error(`check-branding: ${problems.length} violation(s). See golden rule G12.`);
  process.exit(1);
}

console.log("check-branding: clean");
