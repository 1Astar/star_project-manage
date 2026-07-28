# AI ChangeSession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship PM-facing AI change sessions (changelog): open before work, finish after work, browse by day on the project, drill into one session, editable in UI + MCP.

**Architecture:** New Studio entity `ChangeSession` in `studio_change_sessions` (Supabase + local snapshot mirror). Keep `EvolutionLog` for product decisions/releases. Project「迭代记录」gains a third tab「AI 变更」: day groups → session cards. MCP `start_change_session` / `finish_change_session` / `update_change_session` / `list_change_sessions`.

**Tech Stack:** Next.js App Router, existing Studio store/mutations/mappers pattern, MCP workspace-tools, Tailwind UI matching evolution timeline.

## Global Constraints

- Repo: `工具/star_project-manage` (not legacy `star-pm`)
- Out of scope this plan: requirement status machine, acceptance screenshots, impact-scope checkboxes
- Module paths stay `体系·功能面·能力` when provided
- `humanAcceptance`: `unreviewed` | `passed` | `rejected` only
- Dual write: MCP and站内 PATCH the same rows
- Migration next number: `032_studio_change_sessions.sql`

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/032_studio_change_sessions.sql` | Table + indexes |
| `lib/studio/types.ts` | `ChangeSession` type + acceptance enum |
| `lib/studio/mappers.ts` | row ↔ entity |
| `lib/studio/store.ts` / `data.ts` / `mutations.ts` | Snapshot load + CRUD |
| `lib/studio/mock-data.ts` | Optional empty array / 1–2 samples |
| `app/api/studio/change-sessions/route.ts` | POST list/create |
| `app/api/studio/change-sessions/[id]/route.ts` | GET/PATCH |
| `lib/mcp/workspace-tools.ts` (+ schema JSON if generated) | MCP tools |
| `components/project-change-sessions.tsx` | Day list + detail editor |
| `components/project-evolution-timeline.tsx` | Add tab「AI 变更」or compose sibling |
| `app/projects/[id]/evolution/page.tsx` | Pass sessions into UI |

---

### Task 1: Schema + types + mappers

**Files:**
- Create: `supabase/migrations/032_studio_change_sessions.sql`
- Modify: `lib/studio/types.ts`, `lib/studio/mappers.ts`

**Produces:** `ChangeSession` type; `changeSessionToRow` / `rowToChangeSession`

- [ ] **Step 1:** Create table:

```sql
create table if not exists studio_change_sessions (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  day date not null,
  goal text not null default '',
  reason text not null default '',
  expected jsonb not null default '[]'::jsonb,
  done_items jsonb not null default '[]'::jsonb,
  pending_items jsonb not null default '[]'::jsonb,
  ai_ops jsonb not null default '[]'::jsonb,
  result text not null default '',
  human_acceptance text not null default 'unreviewed',
  module text not null default '',
  requirement_id text,
  idea_id text,
  status text not null default 'open', -- open | finished
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists studio_change_sessions_project_day_idx
  on studio_change_sessions(project_id, day desc);
```

- [ ] **Step 2:** Add TS types matching columns (`expected`/`doneItems`/`pendingItems`/`aiOps` as `string[]`)
- [ ] **Step 3:** Add mappers; coerce bad acceptance → `unreviewed`

---

### Task 2: Store + mutations + data helpers

**Files:**
- Modify: `lib/studio/store.ts`, `lib/studio/mutations.ts`, `lib/studio/data.ts`, `lib/studio/mock-data.ts`

**Produces:** `createChangeSession` / `updateChangeSession` / `getProjectChangeSessions`

- [ ] **Step 1:** Extend `StudioSnapshot` with `changeSessions: ChangeSession[]`; load/save like evolution
- [ ] **Step 2:** Implement create (default `day` = today Asia/Shanghai or UTC date from `createdAt`; `status=open`)
- [ ] **Step 3:** Implement update; `finish` path sets `status=finished`, `finishedAt`, keeps `humanAcceptance=unreviewed` unless passed
- [ ] **Step 4:** `getProjectChangeSessions(projectId)` sorted by day desc, then `createdAt` desc
- [ ] **Step 5:** Smoke with a small node assert or existing test style if present

---

### Task 3: REST API

**Files:**
- Create: `app/api/studio/change-sessions/route.ts`
- Create: `app/api/studio/change-sessions/[id]/route.ts`

**Produces:** `POST` create, `GET?projectId=` list, `PATCH /[id]` update/finish

- [ ] **Step 1:** POST body: `{ projectId, goal, reason?, expected?, module?, requirementId?, ideaId? }`
- [ ] **Step 2:** GET requires `projectId`
- [ ] **Step 3:** PATCH supports partial fields + `action: "finish"` shortcut for done/pending/aiOps/result

---

### Task 4: MCP tools

**Files:**
- Modify: `lib/mcp/workspace-tools.ts` (and `lib/mcp/server.ts` if tools registered there)
- Create/update MCP descriptor JSON under Cursor MCP folder only if this repo generates them; otherwise tools register at runtime

**Produces:**
- `start_change_session` → create open session, return `id`
- `finish_change_session` → `{ sessionId, doneItems?, pendingItems?, aiOps?, result? }`
- `update_change_session` → arbitrary patch incl. `humanAcceptance`
- `list_change_sessions` → `{ projectId, day? }`

- [ ] **Step 1:** Register four tools with zod schemas mirroring REST
- [ ] **Step 2:** Manual smoke via MCP or unit call to mutation layer

---

### Task 5: UI — 迭代记录「AI 变更」Tab

**Files:**
- Create: `components/project-change-sessions.tsx`
- Modify: `components/project-evolution-timeline.tsx` (add tab) **or** page-level tab shell
- Modify: `app/projects/[id]/evolution/page.tsx`

**Produces:** Day-grouped list; expand/edit one session; mark 验收

- [ ] **Step 1:** Add tab key `changes` next to 项目发版 / 板块演进
- [ ] **Step 2:** Group sessions by `day`; header `# YYYY-MM-DD` + count
- [ ] **Step 3:** Card shows goal / reason / expected / ✅❌ / aiOps / result / acceptance badge
- [ ] **Step 4:** Inline edit +「通过 / 退回」buttons → PATCH `humanAcceptance`
- [ ] **Step 5:**「+ 开一条变更」form → POST start (optional; MCP is primary writer)

---

### Task 6: Verify + PM note

- [ ] **Step 1:** `npx tsc --noEmit`
- [ ] **Step 2:** Manual: open project evolution → AI 变更 → create → finish → accept
- [ ] **Step 3:** `add_evolution` on proj-star-pm: shipped ChangeSession v1; bump app version if repo convention requires

---

## Out of scope (next plans)

- Requirement status: 想法 → 规划 → AI开发中 → 待验收 → 完成
- Acceptance screenshots before/after
- Impact scope checkboxes (前端/数据/UI/Prompt)
- Auto-link finish session → convert pending into evolution

## Test plan

- [ ] Create open session via API/MCP with goal+reason+expected
- [ ] Finish with done/pending/aiOps; acceptance stays unreviewed
- [ ] List groups under correct day
- [ ] UI sets passed/rejected
- [ ] Evolution tab unchanged
