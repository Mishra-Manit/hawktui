/**
 * Top bar: app name on the left, live listener count on the right.
 */

import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { CliRenderer } from "@opentui/core";

export interface HeaderHandle {
  /** The renderable the caller adds to its parent container. */
  readonly node: BoxRenderable;
  /** Update the "N listeners" text. Called after every scan. */
  setCount(count: number): void;
  /** Show a transient status message (e.g. "sent SIGTERM to 1234"). */
  setStatus(text: string | null): void;
}

export function createHeader(renderer: CliRenderer): HeaderHandle {
  const title = new TextRenderable(renderer, {
    id: "header-title",
    content: "HawkTUI",
    fg: "#00E5A0",
    attributes: 1, // BOLD
  });

  const status = new TextRenderable(renderer, {
    id: "header-status",
    content: "",
    fg: "#888888",
  });

  const spacer = new BoxRenderable(renderer, {
    id: "header-spacer",
    flexGrow: 1,
  });

  const count = new TextRenderable(renderer, {
    id: "header-count",
    content: "0 listeners",
    fg: "#FFD66B",
  });

  const node = new BoxRenderable(renderer, {
    id: "header",
    flexDirection: "row",
    alignItems: "center",
    height: 1,
    paddingLeft: 1,
    paddingRight: 1,
  });

  node.add(title);
  node.add(new TextRenderable(renderer, { id: "header-sep", content: "  " }));
  node.add(status);
  node.add(spacer);
  node.add(count);

  return {
    node,
    setCount(n) {
      count.content = n === 1 ? "1 listener" : `${n} listeners`;
    },
    setStatus(text) {
      status.content = text ?? "";
    },
  };
}
