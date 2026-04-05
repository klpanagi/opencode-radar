# OpenCode Radar

Real-time radar for your [OpenCode](https://opencode.ai) sessions. Track spending, monitor token usage, analyze tool activity, search conversations, and watch live sessions — all from a local web UI with no external services.

## Quick Start

```bash
npx opencode-radar
```

First run builds the dashboard (~30s), then opens it in your browser. Subsequent runs start instantly.

### Options

```bash
npx opencode-radar --port 8080   # custom port (default: 3141)
npx opencode-radar --rebuild      # force a fresh build
npx opencode-radar --help         # show all options
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [OpenCode](https://opencode.ai) installed and used at least once
- `git` in your `PATH` (optional — required for the Git Activity panel)

## Features

### Session Analytics
- **Cost tracking** — cumulative cost chart per session with model-level breakdown
- **Token usage** — input, output, cache read, cache write, and reasoning token counts
- **Token efficiency** — cost per file edit and cost per line changed (with git)
- **Model breakdown** — which models were used and their cost share
- **Tool usage** — bar chart of all tool calls (Read, Edit, Write, Bash, Grep, Glob, task, etc.)
- **Cost per turn** — how much each user prompt cost to process
- **File heatmap** — which files were read and edited most
- **Conversation timeline** — visual timeline of messages, tool calls, and agent spawns
- **Agent panel** — sub-agents spawned during a session with individual costs
- **Context window** — progress bar showing context fill level, with compaction markers
- **Git activity** — commits made during the session, files changed, lines inserted/deleted

### Mission Control
- **Live monitoring** — real-time view of all active OpenCode sessions across projects
- **Unified activity feed** — user messages, tool calls, and agent spawns as they happen
- **Multi-session overview** — cost and status at a glance for every running session
- **Resume from live view** — copy `opencode -s <id>` directly from any active session card

### Spending Overview
- **Daily spending chart** — aggregate costs over 7 / 14 / 30 day windows
- **Monthly forecast** — projected end-of-month spend based on daily average
- **Project breakdown** — per-project cost bars with percentage share of total

### Budget Management
- **Spending limits** — set daily, weekly, and monthly budgets
- **Visual progress meters** — see how close you are to each limit
- **Browser notifications** — get alerted when spending hits a configurable threshold
- **Persistent config** — settings saved to `~/.local/share/opencode/insights-config.json`

### Session Tools
- **Resume session** — copy `opencode -s <id>` to clipboard with one click
- **Export as Markdown** — download the full conversation as a `.md` file
- **Bookmark sessions** — star sessions to pin them; bookmarks persist across restarts
- **Full-text search** — search across all session conversations

## How It Works

OpenCode stores session data in a SQLite database at `~/.local/share/opencode/opencode.db`. OpenCode Radar reads that database directly — no API keys, no external services, no data leaves your machine.

## Development

```bash
git clone https://github.com/klpanagi/opencode-radar.git
cd opencode-radar
npm install
npm run dev
```

Open [http://localhost:3141](http://localhost:3141).

### Build for production

```bash
npm run build
npm start
```

## Tech Stack

- [Next.js](https://nextjs.org/) 15 with Turbopack
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Recharts](https://recharts.org/) for data visualization
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for database access
- TypeScript

## Privacy

All data stays on your machine. OpenCode Radar reads OpenCode's local SQLite database and performs all calculations within your local Next.js instance. Nothing is sent to any external service.

## License

MIT
