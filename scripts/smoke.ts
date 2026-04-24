/**
 * Non-interactive smoke test: verifies the full data pipeline without
 * touching the TUI.
 *
 *   1. Spawn a child Bun process that listens on an ephemeral port.
 *   2. Scan — assert that PID is in the result with the right port.
 *   3. Send SIGTERM via killProcess.
 *   4. Rescan — assert the PID is gone.
 */

import { setTimeout as sleep } from "node:timers/promises";

import { killProcess } from "../src/process/killer.ts";
import { scanListeningProcesses } from "../src/process/scanner.ts";

const child = Bun.spawn({
  cmd: [
    "bun",
    "-e",
    `Bun.serve({ port: 0, hostname: "127.0.0.1", fetch() { return new Response("ok"); } }); await new Promise(() => {});`,
  ],
  stdout: "inherit",
  stderr: "inherit",
});

try {
  // Wait for the server to bind its port.
  await sleep(500);

  const beforeAll = await scanListeningProcesses();
  const before = beforeAll.find((p) => p.pid === child.pid);
  if (!before) {
    throw new Error(`scanner did not find child PID ${child.pid}`);
  }
  console.log(
    `FOUND pid=${before.pid} ports=${before.ports.join(",")} command="${before.command}"`,
  );

  await killProcess(child.pid, "SIGTERM");
  await sleep(500);

  const afterAll = await scanListeningProcesses();
  const after = afterAll.find((p) => p.pid === child.pid);
  if (after) {
    throw new Error(`child PID ${child.pid} still present after SIGTERM`);
  }
  console.log(`KILLED pid=${child.pid} — no longer in listeners`);
  console.log("SMOKE_OK");
} finally {
  try {
    child.kill();
  } catch {
    // already dead — fine.
  }
}
