# OpenCode Radar

**Know exactly what your AI coding sessions cost — while they're happening.**

[![npm version](https://img.shields.io/npm/v/opencode-radar?color=0070f3&label=opencode-radar)](https://www.npmjs.com/package/opencode-radar)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

OpenCode Radar is a local analytics dashboard for [OpenCode](https://opencode.ai) users. It reads your OpenCode SQLite database directly and gives you real-time visibility into session costs, token usage, agent activity, and spending trends — with zero configuration and no data leaving your machine.

---

## Why OpenCode Radar?

OpenCode is powerful, but flying blind on costs adds up fast. Radar gives you the missing layer: a live view of every session, every sub-agent, every model call — with costs read straight from the database so the numbers are always exact. Know your burn rate before your API bill arrives.

---

## ⚡ Quick Start

```bash
npx opencode-radar
```

First run builds the dashboard (~30s). Subsequent runs start instantly. Opens automatically in your browser at [http://localhost:3141](http://localhost:3141).

### Options

```bash
npx opencode-radar --port 8080   # custom port (default: 3141)
npx opencode-radar --rebuild     # force a fresh build
npx opencode-radar --help        # show all options
```

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [OpenCode](https://opencode.ai) installed and used at least once
- `git` in your `PATH` _(optional — enables the Git Activity panel)_

---

## ✨ Features

### Session Analytics

| Feature | Description |
|---|---|
| **Cost tracking** | Cumulative cost chart with per-model breakdown |
| **Token usage** | Input, output, cache read, cache write, and reasoning tokens |
| **Token efficiency** | Cost per file edit and cost per line changed |
| **Model breakdown** | Which models ran and their share of total cost |
| **Tool usage** | Bar chart of every tool call — Read, Edit, Write, Bash, Grep, Glob, task… |
| **Cost per turn** | How much each user prompt cost to process |
| **File heatmap** | Which files were read and edited most |
| **Conversation timeline** | Visual timeline of messages, tool calls, and agent spawns |
| **Agent panel** | Sub-agents spawned in a session with individual costs |
| **Context window** | Progress bar showing fill level, with compaction markers |
| **Git activity** | Commits made during the session, files changed, lines inserted/deleted |

### 🖥 Mission Control

Live view of every running OpenCode session across all your projects — in one place.

- Unified activity feed: user messages, tool calls, and agent spawns as they happen
- Cost and status at a glance for every active session
- Copy `opencode -s <id>` to resume any session instantly

### 📊 Spending Overview

- Daily spending chart over 7 / 14 / 30 day windows
- Monthly forecast based on daily average
- Per-project cost breakdown with percentage share

### 💰 Budget Management

- Set daily, weekly, and monthly spending limits
- Visual progress meters per budget period
- Browser notifications when spending hits your threshold
- Settings persist to `~/.local/share/opencode/insights-config.json`

### 🗂 Session Tools

- **Resume** — copy `opencode -s <id>` to clipboard in one click
- **Export** — download the full conversation as a Markdown file
- **Bookmarks** — star sessions to pin them; persists across restarts
- **Search** — full-text search across all session conversations

---

## How It Works

OpenCode stores all session data in a SQLite database at `~/.local/share/opencode/opencode.db`. Radar reads that file directly using `better-sqlite3` — no API calls, no sync, no accounts.

Costs are read from `step-finish` events in the database exactly as OpenCode recorded them, so every figure is precise. Sub-agent sessions (spawned via `task()`) are attributed to their parent session so aggregate spending is never undercounted.

---

## 🛠 Development

```bash
git clone https://github.com/klpanagi/opencode-radar.git
cd opencode-radar
npm install
npm run dev
```

Open [http://localhost:3141](http://localhost:3141).

```bash
npm run build   # production build
npm start       # serve production build
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 15 with Turbopack |
| UI | [React](https://react.dev/) 19 + [Tailwind CSS](https://tailwindcss.com/) 4 |
| Charts | [Recharts](https://recharts.org/) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Language | TypeScript |

---

## 🔒 Privacy

Radar runs entirely on your machine. It reads OpenCode's local SQLite database and performs all processing inside your local Next.js instance. No telemetry. No external requests. No accounts.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes and open a PR

Bug reports and feature requests welcome via [GitHub Issues](https://github.com/klpanagi/opencode-radar/issues).

---

## License

MIT © [klpanagi](https://github.com/klpanagi)

---

_If Radar saves you from a surprise API bill, consider leaving a ⭐ — it helps others find it._
