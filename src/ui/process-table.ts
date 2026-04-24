/**
 * The main table of processes, implemented as a `SelectRenderable` with rows
 * that are pre-padded into monospace columns. Each option's `name` is the
 * table row; its `description` is the full command path (shown under the
 * highlighted row via `showDescription`).
 */

import {
  BoxRenderable,
  SelectRenderable,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import type { CliRenderer } from "@opentui/core";

import type { ProcessInfo } from "../process/types.ts";
import { formatDuration, formatPorts, padColumn } from "../util/format.ts";

const COLS = {
  pid: 7,
  ports: 14,
  uptime: 10,
  user: 12,
} as const;

const GAP = "  ";

/** Render the fixed column-header strip that sits above the select. */
const HEADER_ROW =
  padColumn("PID", COLS.pid, "right") +
  GAP +
  padColumn("PORT(S)", COLS.ports) +
  GAP +
  padColumn("UPTIME", COLS.uptime) +
  GAP +
  padColumn("USER", COLS.user) +
  GAP +
  "COMMAND";

export interface ProcessTableHandle {
  /** Container that holds the header row and the select. */
  readonly node: BoxRenderable;
  /** The underlying select, exposed so the caller can `focus()` it. */
  readonly select: SelectRenderable;
  /** Replace the rows. Tries to keep the same PID highlighted across refreshes. */
  setProcesses(processes: readonly ProcessInfo[]): void;
  /** Currently highlighted process, or null when the list is empty. */
  getSelected(): ProcessInfo | null;
}

export function createProcessTable(renderer: CliRenderer): ProcessTableHandle {
  const node = new BoxRenderable(renderer, {
    id: "process-table",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
    paddingRight: 1,
  });

  const headerRow = new TextRenderable(renderer, {
    id: "process-table-header",
    content: HEADER_ROW,
    fg: "#FFD66B",
    attributes: 1, // BOLD
  });

  const emptyState = new TextRenderable(renderer, {
    id: "process-table-empty",
    content: "  No processes are listening on TCP ports.",
    fg: "#888888",
  });
  emptyState.visible = false;

  const select = new SelectRenderable(renderer, {
    id: "process-table-select",
    flexGrow: 1,
    options: [],
    showDescription: true,
    showScrollIndicator: true,
    wrapSelection: false,
    backgroundColor: "transparent",
    textColor: "#E6E6E6",
    focusedBackgroundColor: "transparent",
    focusedTextColor: "#E6E6E6",
    selectedBackgroundColor: "#1F3A4D",
    selectedTextColor: "#FFFFFF",
    descriptionColor: "#777777",
    selectedDescriptionColor: "#B9D8E6",
  });

  node.add(headerRow);
  node.add(emptyState);
  node.add(select);

  // Source of truth for "which process is highlighted". Updated on
  // SELECTION_CHANGED / ITEM_SELECTED and used to restore selection after a
  // refresh swaps the option list.
  let currentPids: number[] = [];

  return {
    node,
    select,
    setProcesses(processes) {
      const previousPid = currentPids[select.getSelectedIndex()];
      currentPids = processes.map((p) => p.pid);

      if (processes.length === 0) {
        select.options = [];
        select.visible = false;
        emptyState.visible = true;
        return;
      }

      emptyState.visible = false;
      select.visible = true;
      select.options = processes.map(toOption);

      const restoredIndex =
        previousPid !== undefined
          ? currentPids.indexOf(previousPid)
          : -1;
      const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;
      select.setSelectedIndex(nextIndex);
    },
    getSelected() {
      const index = select.getSelectedIndex();
      const options = select.options;
      if (index < 0 || index >= options.length) return null;
      return (options[index]?.value as ProcessInfo | undefined) ?? null;
    },
  };
}

function toOption(p: ProcessInfo): SelectOption {
  const name =
    padColumn(String(p.pid), COLS.pid, "right") +
    GAP +
    padColumn(formatPorts(p.ports, COLS.ports), COLS.ports) +
    GAP +
    padColumn(formatDuration(p.uptimeMs), COLS.uptime) +
    GAP +
    padColumn(p.user, COLS.user) +
    GAP +
    p.command;
  return { name, description: p.fullCommand, value: p };
}
