# Task 3 Review: MCP, Cron, Excel, acceptance

**Reviewer:** SDD review agent (read-only)  
**Base:** `2b0d76b0a3d42c931e8c400c911555510adedcb6`  
**Head:** `1b8ef682d60d6a179d07b80cad87d235762d97d2`  
**Commit:** `feat(deploy): Cloudflare cron + MCP/Excel Workers notes`

---

## Verdict

| Dimension | Result |
|-----------|--------|
| **Spec compliance** | ✅ |
| **Approval** | **Approved** (ship with noted follow-ups) |

All five brief steps are satisfied: Cron Triggers + custom `scheduled` handler, MCP SSE documentation (behavior unchanged), OpenNext build smoke (including `exceljs` routes), README acceptance checklist, and correct commit message. Diff is minimal (109 lines, 9 files) and aligned with global constraints.

---

## Spec checklist

| Step | Requirement | Status | Evidence |
|------|-------------|--------|----------|
| 1 | CF Cron → three `/api/cron/*` routes with `CRON_SECRET` | ✅ | `wrangler.jsonc` crons 9/10/11 UTC; `cloudflare-worker.ts` maps expressions → routes; self-fetch via `WORKER_SELF_REFERENCE` + Bearer |
| 2 | MCP without TCP Redis; SSE documented off on CF | ✅ | `lib/mcp/config.ts` docblock; route comments; pre-existing `disableSse: !getMcpRedisUrl()`; README MCP section |
| 3 | OpenNext build; minimal `exceljs` fix if broken | ✅ | Build passes (reviewer verified); export/import routes in bundle; no lib swap |
| 4 | README CF acceptance checklist (7 items) | ✅ | Table covers health, login, Studio, board, MCP Bearer, prototype ZIP, Excel, cron curl |
| 5 | Commit message | ✅ | `feat(deploy): Cloudflare cron + MCP/Excel Workers notes` |

Schedules match Vercel parity (`vercel.json`: same UTC 9/10/11 → reminders / sync-ideas / sync-git).

---

## Findings

### Critical

None.

### Important

**[I1] Cron failures are silent to Cloudflare — `cloudflare-worker.ts:38–53`**

The `scheduled` handler delegates work to `ctx.waitUntil(run())` and only `console.error`s on non-OK responses. Cloudflare Cron Triggers treat the invocation as successful once `scheduled` returns, so repeated 401/500 from inner routes will not surface in CF cron metrics or trigger alerts. Recommend logging with a distinct prefix (already present), optionally re-throwing after logging in non-`waitUntil` path for synchronous failures, or adding a post-deploy smoke that hits `/cdn-cgi/handler/scheduled` on preview.

**[I2] End-to-end cron path unverified on Workers — operational gap**

Self-fetch through `WORKER_SELF_REFERENCE` + OpenNext `handler.fetch` + `process.env.CRON_SECRET` in cron routes is the correct documented pattern, but no deployed/preview run confirms the binding, secret bridging, and Bearer match. Acceptance checklist covers manual `curl` to cron routes (handler auth only), not the scheduled → service-binding path. Post-deploy: trigger scheduled handler once per route before relying on production crons.

**[I3] README Windows build warning is stale — `README.md:76,101`**

Task 3 excluded `cloudflare-worker.ts` from Next `tsc` and OpenNext build now succeeds on Windows (reviewer: exit 0, ~3 min). Keeping “Windows build may fail” without qualifying “after Task 3 tsconfig exclude” may discourage valid local verification. Soft doc drift, not a functional defect.

### Minor

**[M1] Referenced script missing — `cloudflare-worker.ts:1`**

Comment mentions `npm run cf-typecheck`; `package.json` only defines `cf-typegen`. Either add the script or fix the comment.

**[M2] Incomplete `CloudflareEnv` typing — `types/cloudflare-secrets.d.ts`**

Only `CRON_SECRET` is declared; `WORKER_SELF_REFERENCE` service binding is untyped (worker uses `@ts-nocheck`). Low impact given exclusion from Next tsc.

**[M3] Hardcoded service name coupling — `wrangler.jsonc:17–18`**

`WORKER_SELF_REFERENCE.service` must stay in sync with top-level `"name": "star-pm"`. Renaming the worker without updating the binding breaks cron silently (logged as missing binding). Consider a one-line README note.

**[M4] MCP route comments only — no behavioral change**

Task 2 already had `disableSse: !getMcpRedisUrl()`. Task 3 adds documentation/comments only for MCP routes; spec “ensure routes work without Redis URL” is satisfied by pre-existing logic, not new code. Acceptable given minimal-diff constraint.

---

## Strengths

1. **Correct OpenNext custom-worker pattern** — Re-exports `fetch` and required DO handlers (`DOQueueHandler`, `DOShardedTagCache`, `BucketCachePurge`) per [OpenNext custom worker howto](https://opennext.js.org/cloudflare/howtos/custom-worker); `main` switched to `cloudflare-worker.ts` cleanly.

2. **Feature parity cron mapping** — Three schedules and paths mirror `vercel.json` exactly; auth reuses existing Bearer check in cron routes (no duplicate cron logic).

3. **Minimal, focused diff** — No drive-by refactors; optional `isServerlessRuntime()` correctly skipped (`lib/runtime/serverless.ts` from Task 2 suffices).

4. **MCP CF story is clear** — `lib/mcp/config.ts` distinguishes TCP Redis (SSE) vs Upstash REST (OAuth); README states Streamable HTTP + Bearer/OAuth default on Workers.

5. **Acceptance checklist is complete and actionable** — All plan items present with concrete curl/UI steps; cron manual test documented separately from CF Triggers.

6. **Excel / build validated** — `npx opennextjs-cloudflare build` passes; `/api/projects/[id]/export`, `import/preview`, `import/commit` appear in route manifest; `exceljs` unchanged.

7. **Sensible tsconfig / gitignore hygiene** — Excluding `cloudflare-worker.ts` and generated `cloudflare-env.d.ts` from Next tsc avoids Windows/build breakage without affecting app typecheck (`npx tsc --noEmit` pass).

---

## Verification (reviewer)

| Check | Result |
|-------|--------|
| `git rev-parse 1b8ef682` | Matches head |
| `npx tsc --noEmit` | PASS |
| `npx opennextjs-cloudflare build` | PASS (Windows; OpenNext warns non-WSL) |
| Cron routes in build output | `/api/cron/reminders`, `sync-ideas`, `sync-git` present |
| Excel routes in build output | `export`, `import/preview`, `import/commit` present |

Not run: `wrangler deploy`, scheduled-handler smoke, live MCP Bearer calls, Excel runtime on Worker.

---

## Residual risks

- Production cron depends on `wrangler secret put CRON_SECRET` (documented in prior report; not in `wrangler.jsonc` vars — correct).
- Pre-existing `dev-cron-secret` fallback in cron routes if `CRON_SECRET` unset in Next env (not introduced by Task 3; outer handler guards missing secret).
- Full CF acceptance remains manual per README checklist.

---

## Recommendation

**Merge Task 3.** Address I1/I3 when convenient (observability + doc tweak); run I2 once on preview/deploy before calling cron production-ready.

---

## Follow-up (I1 + I3)

**Commit:** `fix(deploy): surface CF cron failures; refresh OpenNext Windows note`

| Item | Fix |
|------|-----|
| **I1** | `cloudflare-worker.ts`: config/route failures log + `throw new Error(...)`; removed `ctx.waitUntil` so cron invocation fails visibly in CF metrics |
| **I3** | `README.md`: Windows OpenNext build note updated — build passes; still recommend preview/deploy smoke |

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |

I2 (scheduled-handler smoke on preview/deploy) intentionally not run per scope.
