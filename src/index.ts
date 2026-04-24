/**
 * HawkTUI entry point.
 *
 * Creates the OpenTUI renderer, mounts the app, and lets Ctrl+C / `q`
 * tear everything down cleanly.
 */

import { createCliRenderer } from "@opentui/core";

import { mountApp } from "./app.ts";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
});

renderer.setTerminalTitle("HawkTUI");
renderer.setBackgroundColor("#0D1117");

mountApp(renderer);
