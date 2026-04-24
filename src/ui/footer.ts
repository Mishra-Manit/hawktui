/**
 * Bottom keybinding hint bar.
 */

import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";

const HINTS =
  "  ↑/↓ or j/k  navigate    k  SIGTERM    K  SIGKILL    r  refresh    q  quit";

export function createFooter(renderer: CliRenderer): BoxRenderable {
  const node = new BoxRenderable(renderer, {
    id: "footer",
    height: 1,
    flexDirection: "row",
  });
  node.add(
    new TextRenderable(renderer, {
      id: "footer-hints",
      content: HINTS,
      fg: "#888888",
    }),
  );
  return node;
}
