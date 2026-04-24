/**
 * Types for the process scanning layer.
 *
 * This module is intentionally UI-free: nothing here imports OpenTUI. The data
 * layer is a pure pipeline (`shell → parse → ProcessInfo[]`) that the UI layer
 * consumes.
 */

/**
 * A single TCP-listening process, already deduped across interfaces.
 */
export interface ProcessInfo {
  /** Operating-system process id. */
  readonly pid: number;
  /** Short command name from `lsof` (e.g. `"node"`, `"redis-server"`). */
  readonly command: string;
  /**
   * Full command line from `ps`, including the script path. This is what we
   * surface as "where the process started from" in the UI.
   */
  readonly fullCommand: string;
  /** Login user that owns the process. */
  readonly user: string;
  /** Distinct TCP ports this PID is listening on, sorted ascending. */
  readonly ports: readonly number[];
  /**
   * Process current working directory, sourced from `lsof -d cwd`. This is
   * what we surface as "where the process was launched from" in the UI — and
   * the only signal we have for tools like Next.js that overwrite their
   * `process.title` and so erase the original argv from `ps`.
   *
   * `null` when lsof couldn't read it (permissions, the process exited
   * mid-scan, or a chroot/sandbox hiding it).
   */
  readonly cwd: string | null;
  /** Wall-clock start time parsed from `ps lstart`. */
  readonly startedAt: Date;
  /** Derived uptime, snapshotted at the moment of scanning. */
  readonly uptimeMs: number;
}
