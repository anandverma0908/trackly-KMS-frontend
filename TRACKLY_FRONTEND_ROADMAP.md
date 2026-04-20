# Trackly Frontend Roadmap

> Vision: Not a better JIRA. A system that understands what your team is trying to accomplish and operates one step ahead of everyone in it.

---

## Navigation Architecture

```
─── ME ───────────────────────────────
  My Work            /my-work

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
| 2 | **Effort Estimation visible** — story points callout in create drawer | 🔴 TODO | Prominent callout: "Nova estimates 3–5 pts · Confidence 82% · Based on 11 similar tickets" |
| 3 | **Intelligent Ticket Routing UI** — "Route this" button with explainability | 🔴 TODO | "Nova recommends: Assign to Priya — Python expertise, 2 open tickets" |
| 4 | **AI assistant process data** — Decisions log + Processes for Nova to query | 🔴 TODO | Needs DecisionsPage + ProcessesPage backends wired |

---

## P1 Gaps — Should Fix

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5 | **Process Management** — workflow definitions, compliance, templates | 🟡 In Progress | ProcessesPage UI created (backend pending) |
| 6 | **KB Usage Analytics** — page views, stale detection, reference tracking | 🔴 TODO | "Last edited 4mo ago but referenced 7× this week" |
| 7 | **@mentions in comments** — trigger notifications | 🔴 TODO | Basic collaboration feature |
| 8 | **Audit log** — who changed what, when, on which ticket/page | 🔴 TODO | Required for trust |

---

## New Pages — Generation 1 (Now)

| Page | Route | Status | Key Features |
|------|-------|--------|--------------|
| **My Work** | `/my-work` | 🟡 In Progress | AI-ranked tickets, morning brief, priority explanations |
| **Roadmap** | `/roadmap` | 🟡 In Progress | Global timeline, not buried in project tabs |
| **Goals / OKRs** | `/goals` | 🟡 In Progress | OKRs linked to sprint tickets, velocity-to-goal tracking |
| **Decisions** | `/decisions` | 🟡 In Progress | ADR database, Nova search, who/why/when/alternatives |
| **Processes** | `/processes` | 🟡 In Progress | SOPs, runbooks, compliance tracking, templates |
| **Nova Hub** | `/nova` | 🟡 In Progress | Full intelligence command center (not a floating bubble) |

---

## AI Features Checklist — Generation 1

| Feature | Status | Location |
|---------|--------|----------|
| Nova Intelligence Hub (full page) | 🟡 In Progress | `/nova` |
| AI Morning Brief (typewriter animation) | 🟡 In Progress | `/my-work` |
| My Work — AI-ranked personal hub | 🟡 In Progress | `/my-work` |
| Streaming Nova responses with citation highlights | 🔴 TODO | EosPanel + NovaPage |
| Inline Wiki AI Assistant (`/ai` command) | 🔴 TODO | Wiki editor |
| Duplicate Detection Live Banner | 🔴 TODO | Ticket create drawer |
| Sprint Health Predictor | 🔴 TODO | Sprint page |
| Knowledge Gap → Auto-Generate Article | 🔴 TODO | KB gaps widget |
| Story Point Estimation with Confidence | 🔴 TODO | Ticket create drawer |
| Decisions Log with AI Search | 🟡 In Progress | `/decisions` |
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

---

## Implementation Notes

- Stack: React 18 + TypeScript, CSS Modules (no Tailwind), Framer Motion, MUI, Zustand, TanStack Query
- All new pages use CSS Modules + CSS variable tokens from `globals.css`
- Mock data used for frontend-first; backend integration done in Phase 2
- Nova API: `/api/nova/query` with `scope: 'all' | 'wiki' | 'decisions' | 'processes'`

---

## Session Log

| Date | Work Done |
|------|-----------|
| 2026-04-20 | Navigation architecture (Sidebar revamp), MyWorkPage, NovaPage, DecisionsPage, ProcessesPage, GoalsPage, RoadmapPage — all new routes wired |
