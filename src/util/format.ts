/**
 * Pure formatting helpers. Kept UI-agnostic so they can be unit-tested and
 * reused by any renderer.
 */

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Render a duration as the two most significant units, e.g. `"2d 4h"`,
 * `"37m 12s"`, `"12s"`. We cap at two units to keep table columns narrow.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "?";
  if (ms < MS_PER_SECOND) return "<1s";

  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Pad or truncate a string to exactly `width` visible characters. We treat
 * every character as width 1, which is correct for the ASCII-dominant data
 * shown by HawkTUI (PIDs, ports, command names).
 */
export function padColumn(
  value: string,
  width: number,
  align: "left" | "right" = "left",
): string {
  if (width <= 0) return "";
  if (value.length === width) return value;
  if (value.length > width) {
    return width <= 1 ? value.slice(0, width) : value.slice(0, width - 1) + "…";
  }
  const padding = " ".repeat(width - value.length);
  return align === "left" ? value + padding : padding + value;
}

/**
 * Render a list of ports compactly: `[3000]` → `"3000"`, `[3000, 8080]` →
 * `"3000,8080"`. If the combined string would overflow `maxWidth`, we
 * summarize as `"3000 +2"`.
 */
export function formatPorts(ports: readonly number[], maxWidth: number): string {
  if (ports.length === 0) return "-";
  const joined = ports.join(",");
  if (joined.length <= maxWidth) return joined;
  const first = String(ports[0]);
  const remaining = ports.length - 1;
  return `${first} +${remaining}`;
}
