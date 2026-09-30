import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function shortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "nogit";
  }
}

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  // Relative, so the built bundle works at any URL path: a subdirectory of
  // an existing site, an object store, a static host. See
  // docs/spec/08-deployment.md.
  base: "./",
  define: {
    // The version badge is sourced at build time and never hand-edited.
    __BUILD_VERSION__: JSON.stringify(`${pkg.version}+${shortSha()}`),
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
