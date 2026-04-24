/**
 * Absolutely-positioned confirmation overlay. Shown when the user presses
 * `k` or `K`, hidden otherwise. The modal owns its own Select so keyboard
 * focus moves cleanly between the table and the dialog.
 */

import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import type { CliRenderer, SelectOption } from "@opentui/core";

import type { KillSignal } from "../process/killer.ts";
import type { ProcessInfo } from "../process/types.ts";

export interface ConfirmRequest {
  readonly process: ProcessInfo;
  readonly signal: KillSignal;
}

export interface ConfirmResult {
  readonly confirmed: boolean;
}

export interface ConfirmModalHandle {
  readonly node: BoxRenderable;
  /** Display the dialog. Resolves when the user answers or dismisses it. */
  prompt(request: ConfirmRequest): Promise<ConfirmResult>;
  /** Whether the dialog is currently visible (used to gate global keys). */
  isOpen(): boolean;
}

const OPTIONS: SelectOption[] = [
  { name: "Yes, send signal", description: "", value: true },
  { name: "No, cancel", description: "", value: false },
];

export function createConfirmModal(renderer: CliRenderer): ConfirmModalHandle {
  const message = new TextRenderable(renderer, {
    id: "confirm-message",
    content: "",
    fg: "#FFFFFF",
  });

  const detail = new TextRenderable(renderer, {
    id: "confirm-detail",
    content: "",
    fg: "#AAAAAA",
  });

  const select = new SelectRenderable(renderer, {
    id: "confirm-select",
    options: OPTIONS,
    showDescription: false,
    wrapSelection: true,
    height: 2,
    backgroundColor: "transparent",
    selectedBackgroundColor: "#402030",
    selectedTextColor: "#FFFFFF",
    textColor: "#E0E0E0",
  });

  const node = new BoxRenderable(renderer, {
    id: "confirm-modal",
    position: "absolute",
    left: "20%",
    top: "30%",
    width: "60%",
    height: 9,
    borderStyle: "rounded",
    borderColor: "#FF6680",
    backgroundColor: "#1A1115",
    title: " Confirm ",
    titleAlignment: "center",
    padding: 1,
    flexDirection: "column",
    gap: 1,
  });
  node.add(message);
  node.add(detail);
  node.add(select);
  node.visible = false;

  let pending: ((result: ConfirmResult) => void) | null = null;

  select.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    if (!pending) return;
    const resolve = pending;
    pending = null;
    node.visible = false;
    resolve({ confirmed: option.value === true });
  });

  return {
    node,
    isOpen: () => node.visible,
    async prompt(request) {
      // If a prompt is already open (shouldn't happen, but be safe), cancel it.
      if (pending) {
        const previous = pending;
        pending = null;
        previous({ confirmed: false });
      }

      const sigLabel = request.signal === "SIGTERM" ? "SIGTERM (graceful)" : "SIGKILL (force)";
      message.content = `Send ${sigLabel} to PID ${request.process.pid}?`;
      detail.content = truncate(
        `${request.process.command}  —  ${request.process.fullCommand}`,
        120,
      );
      select.setSelectedIndex(1); // Default to "No" — destructive actions opt-in.
      node.visible = true;
      select.focus();

      return new Promise<ConfirmResult>((resolve) => {
        pending = resolve;
      });
    },
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}
