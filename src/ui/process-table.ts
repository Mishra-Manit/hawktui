/**
 * The main table of processes, implemented as a `SelectRenderable` with rows
 * that are pre-padded into monospace columns. Each option's `name` is the
 * table row; its `description` is the full command path (shown under the
 * highlighted row via `showDescription`).
 *
 * Column widths are recomputed on every `setProcesses` call from the actual
 * cell contents (capped per column). This keeps the layout tight — no fixed
 * 14-wide PORTS column for processes that only ever expose one short port —
 * and guarantees that the header and every data row line up perfectly because
 * they're padded with the same widths.
 */

import { homedir } from "node:os";

import {
  BoxRenderable,
  SelectRenderable,
  TextRenderable,
} from "@opentui/core";
import type { CliRenderer, SelectOption } from "@opentui/core";

import type { ProcessInfo } from "../process/types.ts";
import { formatDuration, formatPorts, padColumn } from "../util/format.ts";

const GAP = "  ";

/**
 * Per-column rendering config. `cap` bounds the auto-computed width so a
 * single pathological cell (a Spotify-sized port list, a 200-char cwd) can't
 * blow the table out; values that exceed the cap are truncated with "…" by
 * `padColumn`.
 */
interface ColumnSpec {
  readonly key: keyof RowCells;
  readonly header: string;
  readonly align: "left" | "right";
  readonly cap?: number;
}

interface RowCells {
  readonly pid: string;
  readonly ports: string;
  readonly uptime: string;
  readonly user: string;
  readonly command: string;
  readonly cwd: string;
}

const COLUMNS: readonly ColumnSpec[] = [
  { key: "pid", header: "PID", align: "right" },
  { key: "ports", header: "PORT(S)", align: "left", cap: 18 },
  { key: "uptime", header: "UPTIME", align: "left" },
  { key: "user", header: "USER", align: "left", cap: 16 },
  { key: "command", header: "COMMAND", align: "left", cap: 24 },
  { key: "cwd", header: "CWD", align: "left", cap: 60 },
];

const HEADER_CELLS: RowCells = {
  pid: "PID",
  ports: "PORT(S)",
  uptime: "UPTIME",
  user: "USER",
  command: "COMMAND",
  cwd: "CWD",
};

const HOME = homedir();

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
    // Filled in by the first setProcesses() call. Sized for the empty case
    // here so the bar isn't blank during the first render tick.
    content: renderRow(HEADER_CELLS, computeWidths([])),
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

      const cells = processes.map(toCells);
      const widths = computeWidths(cells);
      headerRow.content = renderRow(HEADER_CELLS, widths);

      if (processes.length === 0) {
        select.options = [];
        select.visible = false;
        emptyState.visible = true;
        return;
      }

      emptyState.visible = false;
      select.visible = true;
      select.options = processes.map<SelectOption>((p, i) => ({
        name: renderRow(cells[i]!, widths),
        description: describe(p),
        value: p,
      }));

      const restoredIndex =
        previousPid !== undefined ? currentPids.indexOf(previousPid) : -1;
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

/**
 * Compute the rendered width per column: max of the header text and every
 * cell value, clamped by the column's `cap`. Columns whose data is shorter
 * than the header still get the header width (so labels never truncate).
 */
function computeWidths(
  cells: readonly RowCells[],
): ReadonlyMap<ColumnSpec["key"], number> {
  const widths = new Map<ColumnSpec["key"], number>();
  for (const col of COLUMNS) {
    let w = col.header.length;
    for (const row of cells) {
      const len = row[col.key].length;
      if (len > w) w = len;
    }
    if (col.cap !== undefined && w > col.cap) w = col.cap;
    widths.set(col.key, w);
  }
  return widths;
}

/**
 * Pad each cell to its column width and join with the inter-column gap. The
 * trailing column is rendered without trailing padding — there's no neighbor
 * to align against, and the trim keeps the highlighted-row background from
 * extending into empty space.
 */
function renderRow(
  cells: RowCells,
  widths: ReadonlyMap<ColumnSpec["key"], number>,
): string {
  const parts: string[] = [];
  for (let i = 0; i < COLUMNS.length; i += 1) {
    const col = COLUMNS[i]!;
    const padded = padColumn(cells[col.key], widths.get(col.key)!, col.align);
    parts.push(i === COLUMNS.length - 1 ? padded.trimEnd() : padded);
  }
  return parts.join(GAP);
}

function toCells(p: ProcessInfo): RowCells {
  return {
    pid: String(p.pid),
    // Use a generous formatPorts width; if the auto-computed column ends up
    // tighter, padColumn truncates with "…".
    ports: formatPorts(p.ports, 18),
    uptime: formatDuration(p.uptimeMs),
    user: p.user,
    command: p.command,
    cwd: shortenPath(p.cwd),
  };
}

/**
 * Description shown under the highlighted row. Prefers the full command line
 * because that's the most informative for processes that didn't rewrite their
 * `process.title`. For processes that did (Next.js, Postgres workers, etc.),
 * the cwd in the row column is what carries the signal.
 */
function describe(p: ProcessInfo): string {
  return p.fullCommand;
}

/** Replace a leading `$HOME` with `~` so user paths read as `~/Desktop/...`. */
function shortenPath(path: string | null): string {
  if (path === null) return "—";
  if (HOME.length > 0) {
    if (path === HOME) return "~";
    if (path.startsWith(HOME + "/")) return "~" + path.slice(HOME.length);
  }
  return path;
}
