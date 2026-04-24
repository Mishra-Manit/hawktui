/**
 * Verifies that the UI mounts without throwing, by booting the renderer in
 * a non-alternate-screen mode, waiting one render tick, and exiting cleanly.
 * Run as: `bun run scripts/boot-test.ts`.
 */

import { createCliRenderer } from "@opentui/core";

import { mountApp } from "../src/app.ts";

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  targetFps: 30,
  screenMode: "main-screen",
  useMouse: false,
  useKittyKeyboard: null,
  consoleMode: "disabled",
});

mountApp(renderer);

// Let one scan + one render happen, then tear down.
await new Promise((r) => setTimeout(r, 500));
renderer.destroy();
console.log("BOOT_OK");
process.exit(0);
