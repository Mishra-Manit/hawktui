#!/usr/bin/env bun
/**
 * HawkTUI CLI entry.
 *
 * This is the file that `bunx @manitmishra/hawktui` invokes.
 * Kept minimal on purpose: preflight the runtime, then hand off to the app.
 * Static imports of src/index.ts would be resolved *before* the Bun check
 * runs, so we use a dynamic import after the guard.
 */

if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") {
  console.error(
    "HawkTUI requires Bun (https://bun.sh).\n" +
      "Its TUI library (OpenTUI) is Bun-only today.\n" +
      "\n" +
      "Install Bun, then run:  bunx @manitmishra/hawktui",
  );
  process.exit(1);
}

await import("../src/index.ts");
