/**
 * Send a POSIX signal to a PID with typed error reporting.
 *
 * We use Bun's built-in `process.kill` rather than shelling out to `kill(1)`
 * so we get `errno`-tagged errors and don't need to worry about argument
 * escaping.
 */

export type KillSignal = "SIGTERM" | "SIGKILL";

/** The shape of errors surfaced by `killProcess`. */
export type KillErrorReason =
  | "not-found" // Process no longer exists (ESRCH).
  | "permission-denied" // We don't own the PID (EPERM).
  | "invalid-pid" // `pid` was non-positive or not a safe integer.
  | "unknown";

export class KillError extends Error {
  constructor(
    public readonly reason: KillErrorReason,
    public readonly pid: number,
    public readonly signal: KillSignal,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "KillError";
  }
}

/**
 * Send `signal` to `pid`. Resolves on success, rejects with a `KillError` on
 * any failure. Refusing to target `pid <= 0` guards against process-group
 * semantics, which are never what a user wants from this tool.
 */
export async function killProcess(
  pid: number,
  signal: KillSignal,
): Promise<void> {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new KillError(
      "invalid-pid",
      pid,
      signal,
      `Refusing to signal non-positive PID ${pid}.`,
    );
  }
  try {
    process.kill(pid, signal);
  } catch (err) {
    throw toKillError(err, pid, signal);
  }
}

function toKillError(err: unknown, pid: number, signal: KillSignal): KillError {
  const code = typeof err === "object" && err && "code" in err ? (err as { code: unknown }).code : undefined;
  if (code === "ESRCH") {
    return new KillError("not-found", pid, signal, `PID ${pid} is no longer running.`, err);
  }
  if (code === "EPERM") {
    return new KillError(
      "permission-denied",
      pid,
      signal,
      `Not allowed to signal PID ${pid} (try running with sudo).`,
      err,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new KillError("unknown", pid, signal, `Failed to signal PID ${pid}: ${message}`, err);
}
