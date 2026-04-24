/**
 * Tiny typed wrapper around `Bun.spawn`.
 *
 * Only the scanner uses this. Killing is done with `process.kill(pid, signal)`
 * directly, so we never shell out for the destructive path.
 */

export interface ShellResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Run a command and capture its output. Never throws on a non-zero exit; the
 * caller decides how to react (lsof, for instance, exits 1 when it finds
 * nothing matching the filter, which is not an error).
 */
export async function run(cmd: readonly string[]): Promise<ShellResult> {
  const proc = Bun.spawn({
    cmd: cmd as string[],
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}
