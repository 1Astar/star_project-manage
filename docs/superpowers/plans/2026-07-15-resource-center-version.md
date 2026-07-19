# Resource Center + Version — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. P0 first; stop for review before P1/P2 unless user says continue.

**Goal:** Ship half-auto project resource center with 9 categories; then GitHub Release versions; then iteration↔version + module summary.

**Architecture:** Expand `AssetType` + normalize legacy; resources page as category hub; auto cards from Studio `Project` fields; later `studio_releases` sync from GitHub API.

**Tech stack:** Next.js App Router, existing `studio_assets`, `AddAssetForm`, GitHub client.

---

## File map (P0)

| File | Responsibility |
|---|---|
| `lib/studio/types.ts` | New AssetType + labels + legacy normalize |
| `lib/studio/asset-categories.ts` | 9 hub defs, auto vs manual, normalize helper |
| `app/projects/[id]/resources/page.tsx` | Hub UI |
| `components/studio/resource-center.tsx` | Client filter by category + lists |
| `components/studio/add-asset-form.tsx` | New type options; default by section |
| `components/studio/project-assets-table.tsx` | Show normalized labels |
| `lib/notion/import-studio.ts` | Map old→new on import if needed |

---

### Task 0: Types + category hub constants

- [ ] Expand `AssetType` with experience/repo/design/doc/material/prompt/api/deploy/video
- [ ] Keep reading old enums via `normalizeAssetType()`
- [ ] Export `RESOURCE_CATEGORIES` ordered hub config

### Task 1: Resource center UI

- [ ] Replace “文档库两卡片” with 9 category cards (count + desc)
- [ ] Auto rows for experience/repo/deploy from project fields
- [ ] Group/filter manual assets under remaining categories
- [ ] AddAssetForm accepts default `assetType` from card

### Task 2: Smoke

- [ ] Open `/projects/<id>/resources`：九类可见；缺 demo/repo 时空态文案；新增链接可选新类型

### Task 3 (P1): Release sync

- [x] `fetchGitHubReleases` / `fetchGitHubTags` in `lib/github/client.ts`
- [x] Migration `025_releases_and_iteration_version.sql` → `studio_releases` + iteration columns
- [x] Sync API + 资源中心版本选择器

### Task 4 (P2): Iteration module summary

- [x] Optional `release_tag` / `start_date` / `end_date` on iterations
- [x] Iteration plan panel：挂版本 + 本期模块概况
