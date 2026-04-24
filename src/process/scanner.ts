/**
 * Discover processes listening on TCP ports.
 *
 * Pipeline:
 *   1. `lsof -iTCP -sTCP:LISTEN -P -n -F pcLn` → one machine-readable block
 *      per process; we dedupe the multiple "file" entries a single PID emits
 *      for IPv4/IPv6 / multiple ports.
 *   2. A single `ps -o pid=,lstart=,command= -p <ids>` call backfills the
 *      start time and full argv for every PID in one shot.
 *
 * All parsing lives here, so the happy path is: strings in → `ProcessInfo[]`
 * out. No OpenTUI imports, no global state.
 */

import { run } from "../util/shell.ts";
import type { ProcessInfo } from "./types.ts";

/** Raw, partially-populated record assembled while parsing `lsof`. */
interface LsofRecord {
  command: string;
  user: string;
  ports: Set<number>;
}

/**
 * Scan the machine and return one entry per TCP-listening PID, sorted by
 * uptime descending (longest-lived first — the most likely "linger" suspects).
 */
export async function scanListeningProcesses(): Promise<ProcessInfo[]> {
  const lsofResult = await run([
    "lsof",
    "-iTCP",
    "-sTCP:LISTEN",
    "-P",
    "-n",
    "-F",
    "pcLn",
  ]);
  // lsof exits non-zero (1) when nothing matches; treat empty stdout as empty.
  if (lsofResult.stdout.trim().length === 0) return [];

  const records = parseLsof(lsofResult.stdout);
  if (records.size === 0) return [];

  const pids = [...records.keys()];
  const psResult = await run([
    "ps",
    "-o",
    "pid=,lstart=,command=",
    "-p",
    pids.join(","),
  ]);
  const psByPid = parsePs(psResult.stdout);

  const now = Date.now();
  const out: ProcessInfo[] = [];
  for (const [pid, record] of records) {
    const ps = psByPid.get(pid);
    if (!ps) continue; // Process went away between lsof and ps; skip.
    out.push({
      pid,
      command: record.command,
      fullCommand: ps.fullCommand,
      user: record.user,
      ports: [...record.ports].sort((a, b) => a - b),
      startedAt: ps.startedAt,
      uptimeMs: now - ps.startedAt.getTime(),
    });
  }

  out.sort((a, b) => b.uptimeMs - a.uptimeMs);
  return out;
}

/**
 * Parse lsof's "field" output (`-F pcLn`). Each line starts with a single
 * field-type character:
 *   `p` — process id (starts a new process block)
 *   `c` — command name
 *   `L` — login user
 *   `f` — file descriptor (ignored)
 *   `n` — socket name (e.g. `*:3000`, `127.0.0.1:6379`, `[::1]:5432`)
 */
export function parseLsof(stdout: string): Map<number, LsofRecord> {
  const records = new Map<number, LsofRecord>();
  let current: LsofRecord | null = null;

  for (const line of stdout.split("\n")) {
    if (line.length === 0) continue;
    const tag = line[0];
    const value = line.slice(1);
    switch (tag) {
      case "p": {
        const pid = Number.parseInt(value, 10);
        if (!Number.isFinite(pid)) {
          current = null;
          break;
        }
        current = { command: "", user: "", ports: new Set() };
        records.set(pid, current);
        break;
      }
      case "c":
        if (current) current.command = value;
        break;
      case "L":
        if (current) current.user = value;
        break;
      case "n": {
        if (!current) break;
        const port = extractPort(value);
        if (port !== null) current.ports.add(port);
        break;
      }
      // `f`, and anything else, is ignored on purpose.
    }
  }

  return records;
}

/**
 * Extract the TCP port from a socket-name field. Handles IPv4 (`127.0.0.1:80`),
 * IPv6 (`[::1]:80`), and wildcard (`*:80`) forms. Returns `null` for anything
 * we don't recognize (e.g. a peer address on an established socket).
 */
function extractPort(name: string): number | null {
  // Skip anything that looks like an established connection (has "->").
  if (name.includes("->")) return null;
  const colonIndex = name.lastIndexOf(":");
  if (colonIndex === -1) return null;
  const port = Number.parseInt(name.slice(colonIndex + 1), 10);
  return Number.isFinite(port) ? port : null;
}

/** A single parsed `ps` row. */
interface PsRow {
  startedAt: Date;
  fullCommand: string;
}

/**
 * Parse BSD `ps -o pid=,lstart=,command=` output. `lstart` is always five
 * whitespace-separated tokens (`DayOfWeek Mon DD HH:MM:SS YYYY`), which we
 * match greedily. The rest of the line is the command.
 */
export function parsePs(stdout: string): Map<number, PsRow> {
  const out = new Map<number, PsRow>();
  const pattern =
    /^\s*(\d+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+?)\s*$/;
  for (const line of stdout.split("\n")) {
    if (line.length === 0) continue;
    const match = pattern.exec(line);
    if (!match) continue;
    const [, pidRaw, lstart, command] = match;
    const pid = Number.parseInt(pidRaw!, 10);
    const startedAt = new Date(lstart!);
    if (!Number.isFinite(pid) || Number.isNaN(startedAt.getTime())) continue;
    out.set(pid, { startedAt, fullCommand: command! });
  }
  return out;
}
