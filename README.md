# HawkTUI

A tiny TUI for hunting down the processes still squatting on your localhost
ports. Ever closed a terminal only to discover `next dev` is still on :3000?
Ever have a dozen stale dev servers hogging `lsof`? Open HawkTUI, pick the PID,
hit `k`. Done.

```
HawkTUI                                                     8 listeners
  PID       PORT(S)         UPTIME      USER          COMMAND
  65521     3000            37m 12s     manitmishra   node
              /Users/manitmishra/Desktop/web/node_modules/.bin/next dev
  862       6379            2h 14m      manitmishra   redis-server
  870       5432            1d 4h       manitmishra   postgres
  ...
  ↑/↓ or j/k  navigate    k  SIGTERM    K  SIGKILL    r  refresh    q  quit
```

## Install

HawkTUI runs on [Bun](https://bun.sh/) because its UI library,
[OpenTUI](https://opentui.com/), is Bun-only today.

```bash
bun install
```

## Run

```bash
bun start
# or
bun run src/index.ts
```

Dev mode (re-run on file changes):

```bash
bun dev
```

## Keybindings

| Key             | Action                                        |
| --------------- | --------------------------------------------- |
| `↑` / `↓`       | Move the selection                            |
| `j` / `k`       | Same (vim-style)                              |
| `k`             | Send `SIGTERM` to the selected PID (prompts)  |
| `Shift+K`       | Send `SIGKILL` to the selected PID (prompts)  |
| `r`             | Manually refresh the process list             |
| `q` / `Ctrl+C`  | Quit                                          |

The list auto-refreshes every two seconds. Selection is preserved across
refreshes by PID, so a newly-spawned process never steals focus from the row
you were about to kill.

## What counts as a "localhost process"?

Any process listening on a TCP port, found via:

```bash
lsof -iTCP -sTCP:LISTEN -P -n -F pcLn
```

This catches dev servers bound to `0.0.0.0` (Next.js, Vite, Rails) **and**
loopback-only services (Redis, Postgres, etc.), which is usually what you
actually want when something "won't let go of a port".

## Architecture

Two layers. They do not import each other.

```
src/
├── index.ts               entry: boot the renderer and mount the app
├── app.ts                 the only stateful file (state + refresh + key handling)
│
├── process/               data layer — zero OpenTUI imports
│   ├── types.ts             ProcessInfo interface
│   ├── scanner.ts           lsof + ps → ProcessInfo[]
│   └── killer.ts            process.kill wrapper with typed errors
│
├── ui/                    view layer — pure factories, one per widget
│   ├── header.ts            title bar + status line
│   ├── process-table.ts     Select with monospace-padded rows
│   ├── confirm-modal.ts     absolutely-positioned Yes/No dialog
│   └── footer.ts            keybinding hint bar
│
└── util/                  no dependencies on anything below it
    ├── shell.ts             Bun.spawn wrapper with typed result
    └── format.ts            formatDuration, padColumn, formatPorts
```

Data flows one way:

```
scanner.ts  ──►  app.ts state  ──►  ui/*.setProcesses(...)
                       ▲
                       │
              key events, modal results
```

Each UI factory returns a plain object: the root `Renderable` plus a handful of
`setX` methods. Nothing below `app.ts` knows about timers, refresh intervals,
or killing. That is why the whole tree stays ~400 lines and still feels like a
real app.

### Why these choices

- **Pure data layer.** `process/` has no OpenTUI imports, so tests are just
  "feed in fake stdout, assert on objects". You could swap the UI for a web
  app tomorrow.
- **Single stateful file.** Every mutation happens in `app.ts`. If something
  is out of sync, there is exactly one place to look.
- **Monospace `Select` rows.** OpenTUI's `Select` already handles scrolling
  and focus; we just pre-pad the `name` string into columns. No custom
  list-box, no bespoke rendering, no drama.
- **Typed kill errors.** `KillError` distinguishes `not-found`, `permission-denied`,
  and `unknown` so the UI can show a human message without regex-matching stderr.

## Requirements

- macOS or Linux (`lsof` + BSD/Linux `ps`)
- Bun 1.1+
- A terminal with true-color support (iTerm2, Kitty, Ghostty, Alacritty, WezTerm, Terminal.app modern versions, etc.)

## License

MIT.
