# BBS_MCP

A local MCP (Model Context Protocol) server that exposes a BBS forum as tools and resources for an MCP client such as Claude Desktop. Crawler + database + protocol layer are bundled as one workspace so the entire stack runs locally — no cloud agent, no global installs.

```
agent (Claude Desktop / Claude Code)
    │
    │ stdio JSON-RPC (MCP)
    ▼
bbs-mcp           ← this repo
    │ in-proc
    ├── bbs-crawler        (Playwright + SQLite — owns the data)
    └── bbs-database       (Neo4j graph layer — optional, M4+)
```

## Repo layout

```
BBS_MCP/                            ← clone here
├── package.json                    ← unified scripts (setup, init, build, start, ...)
├── tsconfig.base.json
├── .env.example                    ← single env template for the whole monorepo
├── bbs-mcp.config.example.json     ← MCP server config template
├── scripts/
│   ├── setup.mjs                   ← one-shot install + build
│   ├── run.mjs                     ← loads root .env then spawns subcommand
│   └── init-db.mjs                 ← placeholder (M4+)
├── mcp/                            ← MCP server package (this repo owns it)
├── BBS_Crawler/                    ← cloned by `npm run setup` from upstream
└── BBS_Database/                   ← same
```

`BBS_Crawler/` and `BBS_Database/` are independent git repos (their own remotes). They live as workspace members but are gitignored at this repo's level so they never get committed by accident.

## Prereqs

- Node.js **≥ 20**
- Git
- ~1 GB free disk (Playwright Chromium bundle ≈ 400 MB) — **or** an existing Chrome/Chromium install you point at via `BROWSER_EXECUTABLE_PATH` in `.env`

That's it. No global npm packages. No system services. No `~/.cache` pollution — Playwright browsers land in `./.cache/ms-playwright/` if they're downloaded at all.

If you set `BROWSER_EXECUTABLE_PATH` in `.env` to an existing browser binary BEFORE running `npm run setup`, the Playwright download step is skipped (saves ~400 MB).

## Setup (fresh machine)

```bash
# 1. Clone this repo (just BBS_MCP, not the children)
git clone https://github.com/VeinsureLee/BBS_MCP.git
cd BBS_MCP

# 2. (Optional) Pre-create .env if you already have a local Chrome:
#    cp .env.example .env
#    then edit .env and set BROWSER_EXECUTABLE_PATH=C:/path/to/chrome.exe
#    — setup will detect this and skip the ~400 MB Playwright download.

# 3. One-shot setup
#    Clones BBS_Crawler + BBS_Database, installs deps, builds them,
#    installs Playwright Chromium into ./.cache/ms-playwright/
#    (unless step 2 supplied a working BROWSER_EXECUTABLE_PATH).
npm run setup

# 3. Edit .env (created from .env.example during setup)
#    Fill in your BBS credentials. Re-read the comments in the file.
#    On Windows: notepad .env

# 4. Bootstrap forum data — this WILL pop a browser window on first login
npm run init

# 5. Copy and edit the MCP server config
cp bbs-mcp.config.example.json bbs-mcp.config.json
# edit bbs-mcp.config.json: set "data_dir" to an absolute path under BBS_Crawler/data/
```

## Root scripts (everything is `npm run <name>` from this directory)

| Script | What |
|---|---|
| `npm run setup` | Clone subprojects, install deps, build, install Playwright Chromium locally (skipped if `BROWSER_EXECUTABLE_PATH` is set) |
| `npm run login` | Interactive crawler login (writes `BBS_Crawler/.state/<site>.json`). Same as `init:crawler:login` |
| `npm run init` | End-to-end: auto-login if no storage state exists, then crawl sections + boards, then `init:db` |
| `npm run init:crawler:sections` | Crawl top-level forum sections into structure.db |
| `npm run init:crawler:boards` | Crawl all boards under sections |
| `npm run init:crawler:threads` | Crawl pinned threads (baseline) for each board |
| `npm run init:crawler` | sections + boards in order (does NOT auto-login) |
| `npm run init:db` | Bootstrap bbs-database (placeholder until M4+) |
| `npm run build:crawler` / `build:mcp` / `build` | Rebuild after pulling upstream changes |
| `npm run register` | Register this clone with Claude Code (writes `.mcp.json`) |
| `npm run register -- --desktop` | Same but for Claude Desktop's user-global config |
| `npm run unregister` | Remove from `.mcp.json` |
| `npm run unregister -- --desktop` | Remove from Claude Desktop's user-global config |
| `npm run start` | Run the MCP server on stdio (for manual testing) |
| `npm run dev:mcp` | Same but via `tsx` (no rebuild needed) |
| `npm run test` | Vitest suite for `bbs-mcp` |
| `npm run lint` | tsc --noEmit |
| `npm run clean` | Remove `dist/`, `logs/`, `.cache/` |

## Register the server with your Claude client

`npm run register` writes the right config for you. Pick your client:

### Claude Code (CLI) — recommended for "this folder configures this folder"

```bash
npm run register
```

Writes `.mcp.json` at the project root. Claude Code auto-discovers it when you start `claude` in this directory. `.mcp.json` is gitignored (paths are absolute and machine-specific), so each clone configures itself independently.

### Claude Desktop — user-global registration

```bash
npm run register -- --desktop
```

Writes to `%APPDATA%\Claude\claude_desktop_config.json` on Windows (macOS: `~/Library/Application Support/Claude/`, Linux: `~/.config/Claude/`). Pre-existing `mcpServers` entries are preserved; only the entry matching `MCP_SERVER_NAME` is added/updated. Fully quit Claude Desktop (system tray too) and reopen for the change to apply.

### Multiple installs on the same machine

Each clone has its own `.env` with `MCP_SERVER_NAME=...`. Change the name per install (`bbs`, `bbs-test`, `bbs-dev`, etc.) so they don't collide in Claude Desktop's global list. `.mcp.json` files are project-local so they naturally don't conflict.

### Undo

```bash
npm run unregister              # remove entry from project .mcp.json
npm run unregister -- --desktop # remove entry from Claude Desktop config
```

### Why does the loader resolve paths relative to the config file?

Because Claude Desktop / Claude Code set the spawned MCP server's cwd to their own location, not yours. If `bbs-mcp.config.json` says `"data_dir": "./BBS_Crawler/data/crawler.db"`, the MCP loader now resolves it relative to **the directory containing the config file** — so the same JSON works no matter who launches the server. You don't need absolute paths inside `bbs-mcp.config.json`; the example file's relative paths are fine.

## What tools are exposed

See `docs/superpowers/specs/2026-05-24-bbs-mcp-design.md` for the design rationale. Short version:

| Tool | Purpose |
|---|---|
| `forum_list_sites` | List configured BBS sites |
| `forum_list_boards` | List all boards with thread counts |
| `forum_threads_by_board` | List threads in a board (pinned/plain/all, `since`, paging) |
| `forum_get_thread` | Fetch one thread + all its posts (by url or by id) |
| `forum_search_threads` | Lexical (LIKE) title search |
| `forum_crawl` | Trigger a crawl of a board or single thread (synchronous) |
| `forum_status` | Session / global counts / per-board freshness |
| `forum_ping` | Smoke test |

Plus resource `bbs://forum-tree` — the full site → forum → board hierarchy with per-board counts, auto-injected into the agent's context by clients that support MCP resources.

## How env / paths are unified

There is **one** `.env` at the project root. `scripts/run.mjs` (used by every root script) loads it into `process.env` before spawning the child command. The child workspace scripts still call `dotenv/config` themselves but find no `.env` in their own directory, so the root values win.

If you previously had a `BBS_Crawler/.env`, it still works but takes precedence over the root one only for variables defined in both (because dotenv processes in load order and skips already-set keys). Cleanest practice: keep everything in the root `.env` and leave per-subproject `.env` files empty.

## Updating after a `git pull`

```bash
git pull
cd BBS_Crawler && git pull && cd ..    # if crawler had changes upstream
cd BBS_Database && git pull && cd ..   # same
npm install                            # picks up any new deps
npm run build                          # rebuild crawler + mcp
```

## Privacy posture

- All data stays on your machine: SQLite under `BBS_Crawler/data/`, MCP logs under `logs/`, Playwright login state under `.state/`, browser binaries under `.cache/`.
- The MCP server talks only to your MCP client (Claude Desktop) over stdio JSON-RPC. No network calls except the crawler hitting your configured BBS.
- `.env` and `bbs-mcp.config.json` are gitignored — credentials never leave your filesystem.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to reconnect to bbs` in Claude Desktop | Check `logs/bbs-mcp.log` — typically a missing `data_dir` (use absolute paths in `bbs-mcp.config.json`) |
| `npm run setup` fails at the git clone step | Configure git (`git config --global user.name/email`) and ensure GitHub access |
| `npm run init:crawler:login` hangs without opening a browser | Set `BROWSER_HEADLESS=false` in `.env` for the first login |
| Playwright says "browser not found" | Re-run `npm run setup` or manually `PLAYWRIGHT_BROWSERS_PATH=./.cache/ms-playwright npx playwright install chromium` |
| `forum_status.session.logged_in` always false | Known limitation (M0-M3): CrawlerService doesn't expose AuthManager. Real session state will surface in a later milestone. |
| Server starts but tool calls hang | Likely a synchronous crawl in progress; check `logs/bbs-mcp.log`. `forum_crawl` blocks until done. |

## License / Status

Pre-release. Currently completes the M0–M3 (SQLite-only) milestone — browse, search, and trigger crawl. M4+ adds the Neo4j graph layer and semantic routing tools.
