# Trackly — Engineering Operating System

> **One platform. One intelligence layer. One truth.**  
> Trackly is an AI-powered Engineering Analytics Platform that goes beyond traditional project management tools. It understands your team's reality and operates one step ahead of everyone in it.

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/MUI-Components-007FFF?logo=mui&logoColor=white" alt="MUI">
  <img src="https://img.shields.io/badge/EOS-AI%20Powered-8B5CF6" alt="EOS AI">
</p>

---

## ✨ What is Trackly?

Trackly kills the **"47-minute morning"** — the daily ritual where engineers open Jira, Slack, GitHub, Confluence, and the calendar just to figure out what matters. 

Instead, Trackly provides:

- 🤖 **EOS (Engineering Operating System)** — An AI co-pilot that reads every ticket, standup, code review, and timesheet to deliver personal morning briefings, intelligent prioritization, and proactive insights.
- 🌌 **Spaces** — Mission control for every pod with smart backlog management, epic tracking, release confidence, AI-generated tests, and team-specific automation.
- 🧠 **Intelligence Hub** — A full-page AI assistant with streaming responses, citations, agent mode with tool calls, and real-time anomaly detection.
- 🔍 **AI Code Review** — Automated static analysis with severity-coded findings, detailed explanations, and one-click ticket creation.
- 📊 **Leadership Analytics** — Workload distribution, burnout risk detection, velocity anomaly tracking, emotion-aware work management, and predictive resource planning.
- ⏰ **Time Tracking** — Spreadsheet-style weekly grids and manual entry that takes seconds, not minutes.
- 👥 **Team Intelligence** — Cognitive load scores, institutional memory mapping, bus-factor risk detection, and AI-generated performance briefs.

---

## 🚀 Key Features

### 🤖 My Work — AI Command Center
Your personal morning briefing, not a todo list.
- **EOS Agent Brief** — Typewriter-animated daily summary with status chips
- **AI Priority Queue** — Ranked tickets with urgency scores and reasoning
- **Smart Focus Block** — One top-priority ticket to start your day
- **Ambient Awareness** — Live feed of work happening around you
- **Delivery Forecast** — Sprint completion probability based on real velocity
- **Knowledge Gaps** — Wiki coverage holes from your active tickets

### 🌌 Spaces — Mission Control for Pods
Project hub with every dimension of team management:
- **Summary** — Health score, velocity, risk signals, bottleneck detection
- **Backlog** — Sprints with health rings, stale ticket detection, quick-create
- **Epics** — Color-coded big bets with progress bars and timeline tracking
- **Releases** — Version management with automatic readiness calculation
- **Tests** — Test case management with AI generation, cycles, and coverage analysis
- **EOS** — 9 AI capabilities: Sprint Retro, Release Notes, Risk Assessment, Tech Debt, Team Performance, Client Status, Sprint Forecast, Anomaly Detection, Knowledge Gaps
- **Decisions** — ADR database with status tracking and searchability
- **Processes** — SOPs, runbooks, compliance workflows with interactive checklists
- **Settings** — Members management, automation rules, custom fields

### 🧠 EOS Intelligence Hub
Your project's brain. Ask anything. Create anything.
- **Streaming text responses** with typewriter effect and blinking cursor
- **Citations** from tickets, decisions, wiki, standups (hover-highlighted)
- **Agent mode** — tool calls with live reasoning traces
- **Intent detection** — ask, thought, meeting, screenshot, voice
- **Pulse cards** — real-time anomalies, knowledge gaps, patterns, suggestions
- **Media support** — Screenshot analysis, audio/video transcription
- **Content creation** — tickets, docs, bugs created directly from chat

### 🔍 Code Review
AI-powered static analysis of GitHub repositories:
- **AI Terminal animation** — streaming log lines with realistic timing
- **Severity-coded findings** — Critical, High, Medium with detailed explanations
- **Bug detail drawers** — Why It's a Bug, User Impact, Evidence, Reproduction Steps
- **One-click actions** — Approve, reject, or create ticket from any finding
- **Run history** — load and compare historical analysis snapshots

### 📊 Analytics
Leadership intelligence dashboard:
- **Workload Distribution** — bar chart of hours by engineer
- **Team Health Monitor** — burnout risk detection with redistribution recommendations
- **Velocity Anomaly Detection** — sprint-over-sprint drops with root cause analysis
- **Emotion-Aware Work Management** — linguistic sentiment signals from comments
- **Real Cost of a Bug** — total bugs, hours, estimated USD cost
- **Recurring Problem Detector** — keyword patterns showing systemic issues
- **Client Health Score** — delivery rate, bug density, blockers per client
- **Knowledge Gaps** — EOS-detected wiki gaps with one-click article generation
- **Predictive Resource Planning** — skill gaps and hiring recommendations
- **Cross-Org Pattern Learning** — anonymized benchmarks vs. industry averages

### ⏰ Time Tracking
Two modes for every workflow:
- **Weekly Grid** — Spreadsheet-style: tickets × days (Mon-Fri), tab navigation, live totals
- **Manual Entry** — Single ticket picker, date, hours (0.25 increments), optional note

### 👥 Team
Manager view with deep intelligence:
- **Team grid** — member cards with hours, tickets, POD, status (Overloaded/Active/Light/Idle)
- **EOS Team Brief** — auto-generated leadership brief on team health
- **Institutional Memory Map** — bus factor risks, expertise map by person and pod
- **Cognitive Load Score** — per-engineer load bars with WIP/overdue counts
- **Team Chemistry Analyser** — POD imbalance detection
- **Timesheet Drawer** — per-member detail with AI performance brief generator

### 🔔 Notifications
Real-time, actionable notifications:
- **18 notification types** — sprint events, standup readiness, burn rate alerts, ticket changes, mentions
- **Visual distinction** — each type has a unique icon and color
- **Click-to-navigate** — mark as read and jump directly to context
- **Bulk actions** — mark all read with one click

### 🔗 Integrations
Connect Trackly to your existing workflow:
- **Slack**, **Microsoft Teams**, **Generic Webhook**
- **Event selection** — ticket_created, status_changed, sprint_started, sprint_completed, mention, comment_added
- **Live testing** — test payload delivery with instant feedback
- **Toggle control** — enable/disable per integration without deleting configuration

### 💬 Comments & Collaboration
Rich ticket conversations with full context:
- **@mention autocomplete** — type `@` to see org users, keyboard navigation
- **Rendered mentions** — highlighted in accent color with font-weight emphasis
- **Mixed timeline** — comments, worklogs, and activity changes interleaved chronologically
- **Sub-tasks** — create, toggle status, unlink, with progress bars
- **Linked Issues** — search, add by relationship type (blocks, duplicates, relates to, clones)
- **Custom Fields** — dynamic fields per POD (text, number, select, checkbox, date)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 + TypeScript (strict) |
| **Bundler** | Vite |
| **Routing** | React Router v6 |
| **State Management** | Zustand (client UI), TanStack Query (server state) |
| **Virtualization** | TanStack Virtual (handles 50k+ rows) |
| **Charts** | Recharts (bar/donut), D3 (activity heatmap) |
| **UI Components** | MUI (Material UI) + CSS Modules |
| **Animations** | Framer Motion |
| **Rich Text** | TipTap editor |
| **Notifications** | react-hot-toast |
| **Icons** | react-icons (Remix Icons) |

**Themes:** Default (Cobalt), Emerald, Violet, Rose — with full light/dark mode support.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+

### 1. Install dependencies
```bash
npm install
```

### 2. Run with mock data (no backend required)
```bash
# .env.local already has VITE_USE_MOCK=true
npm run dev
```
Opens at `http://localhost:3000` with realistic mock data.

### 3. Run with backend
```bash
# Edit .env.local
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000

# Start backend first (see backend README)
cd ../backend
python3 -m uvicorn main:app --reload --port 8000

# Then start frontend
npm run dev
```

---

## 📁 Project Structure

```
src/
├── app/                  # App shell + router (App.tsx)
├── features/             # Feature-first colocation
│   ├── my-work/          # AI command center (/my-work)
│   ├── spaces/           # Project spaces with tabs (/spaces)
│   ├── tickets/          # Ticket management + detail drawer
│   ├── nova/             # EOS AI hub — chat + intelligence (/nova, /eos)
│   ├── analytics/        # Team analytics (/analytics)
│   ├── code-review/      # AI code review (/code-review)
│   ├── team/             # Team view (/team)
│   ├── standup/          # Daily standups (/standup)
│   ├── settings/         # Settings + integrations (/settings)
│   ├── wiki/             # Knowledge base (/wiki)
│   ├── goals/            # OKRs (/goals)
│   ├── timetrack/        # Weekly time grid (/timesheets)
│   └── manual-entry/     # Manual timesheets
├── components/
│   ├── layout/           # AppShell, Sidebar, Topbar
│   ├── ui/               # Badge, Skeleton, EmptyState, SideDrawer
│   ├── nova/             # EosPanel, NotificationPanel
│   └── CommandBar/       # Global command bar
├── store/                # Zustand stores
├── services/             # API layer + mock data
├── types/                # TypeScript types
├── utils/                # Formatters, helpers
└── styles/               # globals.css, CSS custom properties (theme tokens)
```

---

## 🎨 Theming

The design system uses CSS custom properties. Switch accent color by setting `data-theme` on `<html>`:

| Theme | Color | Hex |
|-------|-------|-----|
| default | Cobalt | `#4F7EFF` |
| emerald | Emerald | `#10B981` |
| violet | Violet | `#8B5CF6` |
| rose | Rose | `#F43F5E` |

Light mode: set `data-mode="light"` on `<html>`.

Both are controlled from **Settings → Appearance** and persisted in `localStorage`.

---

## 🧪 Available Scripts

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
npm run test     # Run Vitest tests
npm run lint     # ESLint check
```

---

## 🧠 Architecture Notes

### Mock Data Architecture
The app runs entirely on **mock data** by default (`VITE_USE_MOCK=true`):
- **DUMMY_TICKETS** — 100+ realistic tickets with assignees, priorities, sprints
- **DUMMY_SPRINTS** — Sprint data with velocity tracking
- **DUMMY_ORG_MEMBERS** — Team roster with roles and capacities
- **MOCK_COMMENTS** — In-memory Map for ticket comments with @mentions
- **DUMMY_GOALS** — OKRs with key results and Nova insights

This means **the demo works offline** with realistic data flows.

### Feature-First Organization
Code is organized by feature, not by type. All code related to a feature lives in `src/features/<feature>/`. This keeps related code close and makes features easy to add, remove, or modify.

### AI Branding
Every AI-powered element uses the **EOS** badge (`<EOSBadge />`) with the `RiSparklingLine` icon. In code, hooks use names like `useMyWork`, `fetchSummary`, etc. The AI API endpoint is `/api/nova/query`.

---

## 📖 Demo & Documentation

- **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** — Complete keynote-style demo script (~18-20 min) covering all features
- **[TRACKLY_FRONTEND_ROADMAP.md](TRACKLY_FRONTEND_ROADMAP.md)** — Feature roadmap, implementation status, and architecture decisions

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing patterns:
- Feature-first colocation
- CSS Modules for styling (no Tailwind)
- TypeScript strict mode
- EOS badge on every AI-powered element

---

## 📄 License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

<p align="center">
  <strong>Trackly — The Future of Engineering Operations</strong><br>
  <em>Built with 💙 by the Trackly Team</em>
</p>
