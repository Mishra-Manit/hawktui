/**
 * Top-level wiring for HawkTUI.
 *
 * `mountApp` is the only stateful function in the codebase. It owns:
 *   - the current process snapshot,
 *   - the refresh timer,
 *   - the single global key handler,
 *   - the confirm-modal lifecycle.
 *
 * Everything else is a pure factory (`create*`) or a pure function.
 */

import { BoxRenderable, type CliRenderer } from "@opentui/core";

import { KillError, killProcess, type KillSignal } from "./process/killer.ts";
import { scanListeningProcesses } from "./process/scanner.ts";
import type { ProcessInfo } from "./process/types.ts";
import { createConfirmModal } from "./ui/confirm-modal.ts";
import { createFooter } from "./ui/footer.ts";
import { createHeader } from "./ui/header.ts";
import { createProcessTable } from "./ui/process-table.ts";

/** Auto-refresh cadence. Small enough to feel live, slow enough to avoid churn. */
const REFRESH_INTERVAL_MS = 2_000;
/** How long a transient status message (e.g. "killed 1234") stays on screen. */
const STATUS_TIMEOUT_MS = 3_000;

export function mountApp(renderer: CliRenderer): void {
  const header = createHeader(renderer);
  const table = createProcessTable(renderer);
  const footer = createFooter(renderer);
  const modal = createConfirmModal(renderer);

  const root = new BoxRenderable(renderer, {
    id: "app-root",
    flexDirection: "column",
    width: "100%",
    height: "100%",
  });
  root.add(header.node);
  root.add(table.node);
  root.add(footer);
  root.add(modal.node);
  renderer.root.add(root);

  table.select.focus();

  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  const setStatus = (text: string | null): void => {
    header.setStatus(text);
    if (statusTimer) clearTimeout(statusTimer);
    if (text === null) return;
    statusTimer = setTimeout(() => header.setStatus(null), STATUS_TIMEOUT_MS);
  };

  let processes: readonly ProcessInfo[] = [];
  const refresh = async (): Promise<void> => {
    try {
      processes = await scanListeningProcesses();
      table.setProcesses(processes);
      header.setCount(processes.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`scan failed: ${message}`);
    }
  };

  const requestKill = async (signal: KillSignal): Promise<void> => {
    if (modal.isOpen()) return;
    const target = table.getSelected();
    if (!target) {
      setStatus("Nothing selected.");
      return;
    }

    const { confirmed } = await modal.prompt({ process: target, signal });
    // Hand focus back to the table whether the user confirmed or cancelled.
    table.select.focus();
    if (!confirmed) return;

    try {
      await killProcess(target.pid, signal);
      setStatus(`sent ${signal} to PID ${target.pid} (${target.command})`);
      void refresh();
    } catch (err) {
      if (err instanceof KillError) {
        setStatus(err.message);
      } else {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    }
  };

  renderer.keyInput.on("keypress", (event) => {
    // While the modal is open, let its own Select handle keys.
    if (modal.isOpen()) return;

    switch (event.name) {
      case "r":
        if (event.shift) return;
        void refresh();
        return;
      case "k":
        if (event.shift || event.ctrl || event.meta) {
          if (event.shift && !event.ctrl && !event.meta) {
            void requestKill("SIGKILL");
          }
          return;
        }
        void requestKill("SIGTERM");
        return;
      case "q":
        if (event.shift || event.ctrl || event.meta) return;
        renderer.destroy();
        process.exit(0);
    }
  });

  renderer.on("resize", () => {
    // Yoga reflows automatically; nothing app-level to do today. Hook kept
    // so future responsive tweaks have an obvious home.
  });

  // Kick off the initial scan and the recurring refresh timer.
  void refresh();
  setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
}
