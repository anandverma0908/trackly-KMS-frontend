# Trackly Frontend Roadmap

> Vision: Not a better JIRA. A system that understands what your team is trying to accomplish and operates one step ahead of everyone in it.

---

## Navigation Architecture

```
─── ME ───────────────────────────────
  My Work            /my-work          ← default landing page

─── WORK ─────────────────────────────
  Spaces             /spaces
  Roadmap            /roadmap
  Goals              /goals

─── KNOWLEDGE ────────────────────────
  Wiki               /wiki
  Decisions          /decisions
  Processes          /processes

─── INTELLIGENCE ─────────────────────
  Nova               /nova
  Analytics          /analytics

─── PEOPLE ───────────────────────────
  Team               /team
  Standup            /standup
```

---

## P0 Gaps — Must Fix

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | **Duplicate Detection UI** — live banner while typing ticket title | 🔴 TODO | Debounced call → `⚠️ 2 similar tickets exist` banner |
| 2 | **Effort Estimation visible** — story points callout in create drawer | 🔴 TODO | Prominent callout: "EOS estimates 3–5 pts · Confidence 82% · Based on 11 similar tickets" |
| 3 | **Intelligent Ticket Routing UI** — "Route this" button with explainability | 🔴 TODO | "EOS recommends: Assign to Priya — Python expertise, 2 open tickets" |
| 4 | **AI assistant process data** — Decisions log + Processes for EOS to query | 🔴 TODO | Needs DecisionsPage + ProcessesPage backends wired |

---

## P1 Gaps — Should Fix

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5 | **Process Management** — workflow definitions, compliance, templates | 🟡 In Progress | ProcessesPage UI done (backend pending) |
| 6 | **KB Usage Analytics** — page views, stale detection, reference tracking | 🔴 TODO | "Last edited 4mo ago but referenced 7× this week" |
| 7 | **@mentions in comments** — trigger notifications | 🔴 TODO | Basic collaboration feature |
| 8 | **Audit log** — who changed what, when, on which ticket/page | 🔴 TODO | Required for trust |

---

## Pages — Status

| Page | Route | Status | Key Features |
|------|-------|--------|--------------|
| **My Work** | `/my-work` | ✅ Done | Full AI command center redesign — see below |
| **Nova Hub** | `/nova` | ✅ Done | Intelligence hub, proactive insights grid, streaming chat |
| **Decisions** | `/decisions` | ✅ Done | ADR database, EOS search, split-pane detail view |
| **Processes** | `/processes` | ✅ Done | SOPs/runbooks/compliance, interactive step checklist |
| **Goals / OKRs** | `/goals` | ✅ Done | OKR tracker, circular progress, KR bars, EOS insights per goal |
| **Roadmap** | `/roadmap` | ✅ Done | Gantt-style global timeline grouped by project, "now" line |
| **Dashboard** | `/dashboard` | ✅ Done | Team/org analytics hub for leads, managers, admins |
| **Spaces** | `/spaces` | ✅ Done | Project hub |
| **Wiki** | `/wiki` | ✅ Done | Knowledge base |
| **Kanban** | `/kanban` | ✅ Done | Board view |
| **Sprints** | `/sprints` | ✅ Done | Sprint management |
| **Analytics** | `/analytics` | ✅ Done | Team analytics |
| **Standup** | `/standup` | ✅ Done | Daily standup |
| **Team** | `/team` | ✅ Done | People view |
| **Timesheets** | `/timesheets/weekly` | ✅ Done | Weekly time grid |

---

## My Work Page — AI Command Center (Redesigned 2026-04-20)

The page is a personal living briefing, not a task list. Every section is AI-powered.

| Section | Type | What it does |
|---------|------|--------------|
| Morning Brief Bar | Gen 2 | Glowing banner, typewriter animation, personalized daily summary, dismissible |
| KPI Pills | Gen 1 | Open Tickets / Hours This Week / Sprint Contribution / Overruns |
| Today's Focus | Gen 2 | AI-ranked tickets with Blocked/Due soon/Pick next tags, pulse on blocked |
| AI Insights Panel | Gen 2 | 3 fixed cards: Velocity Signal, Risk Signal, Recommendation — all EOS-badged |
| My Sprint Progress | Gen 2 | Personal burn bar, pts done/remaining, On track/At risk/Behind pace chip |
| Standup Generator | Gen 1 | Auto-filled Yesterday/Today/Blockers from ticket data |
| Recent Activity | Gen 1 | Last 7 days: time logs, status moves |
| Knowledge Surface | Gen 3 | Horizontal scroll of EOS-surfaced wiki cards based on active tickets |

**EOS Badge** — `<EOSBadge />` component defined in MyWorkPage.tsx. Use this on every AI-powered element across the app.

---

## AI Features Checklist

| Feature | Status | Location |
|---------|--------|----------|
| EOS Morning Brief (typewriter animation) | ✅ Done | `/my-work` |
| AI-ranked personal ticket queue | ✅ Done | `/my-work` Today's Focus |
| AI Insights Panel (velocity, risk, recommendation) | ✅ Done | `/my-work` |
| Sprint pace prediction + AI coaching | ✅ Done | `/my-work` Sprint Progress |
| Knowledge surfacing from active tickets | ✅ Done | `/my-work` Knowledge Surface |
| EOS Intelligence Hub (full page) | ✅ Done | `/nova` |
| Decisions Log with AI Search | ✅ Done | `/decisions` |
| Goals with AI insights per OKR | ✅ Done | `/goals` |
| Streaming EOS responses with citations | 🔴 TODO | EosPanel + NovaPage |
| Inline Wiki AI Assistant (`/ai` command) | 🔴 TODO | Wiki editor |
| Duplicate Detection Live Banner | 🔴 TODO | Ticket create drawer |
| Sprint Health Predictor | 🔴 TODO | Sprint page |
| Knowledge Gap → Auto-Generate Article | 🔴 TODO | Knowledge Surface |
| Story Point Estimation with Confidence | 🔴 TODO | Ticket create drawer |
| Velocity Anomaly Detection | 🔴 TODO | Analytics page |

---

## Generation 2 Features (Future)

- Voice-to-Ticket
- Meeting Recording → Auto-Documentation
- Screenshot → Bug Ticket
- Code-Aware Context
- Team Health Monitor
- Autonomous Standup Collection
- Smart Sprint Planning Assistant
- Natural Language Project Management (command bar)
- Per-project Roadmap tabs under Spaces

---

## Implementation Notes

- Stack: React 18 + TypeScript, CSS Modules (no Tailwind), Framer Motion, MUI, Zustand, TanStack Query
- All pages use CSS Modules + CSS variable tokens from `globals.css`
- Mock data used for frontend-first; backend integration done in Phase 2
- AI brand name in UI: **EOS** (badge on every AI element). Code hook names use `useMyWork`, `fetchSummary`, etc.
- EOS API: `/api/nova/query` with `scope: 'all' | 'wiki' | 'decisions' | 'processes'`

---

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-04-20 | Navigation architecture revamp, MyWorkPage, NovaPage, DecisionsPage, ProcessesPage, GoalsPage, RoadmapPage — all new routes wired |
| 2026-04-20 | MyWorkPage full redesign — AI command center with Morning Brief, KPI Pills, Today's Focus, AI Insights Panel, Sprint Progress, Standup+Activity, Knowledge Surface |
