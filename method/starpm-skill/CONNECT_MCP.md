# Connect StarPM (MCP is one door)

Skill alone drafts structure. **Core persists** project context.

**MCP** (or later API / Plugin / SDK) is only how Agents reach Core.  
You are not selling “an MCP”; you are selling **long-term memory of why the project became what it is.**

**Never put real tokens in git, README, or chat logs.** Use env vars / local config only.

## Interface vs Server

| | Public now | Closed |
|--|------------|--------|
| **MCP Interface** | Tool intent docs (`TOOLS.md`), connect recipes below | — |
| **MCP Server + Core** | — | Implementation, auth, multi-tenant, your data plane |

## Endpoints (reference)

| Path | Who |
|------|-----|
| `POST /api/mcp` | Cursor / Codex — `Authorization: Bearer <token>` |
| `/api/mcp-oauth/mcp` | ChatGPT Connectors — OAuth (different from Bearer) |
| Local stdio | Dev only — see repo `mcp/run-stdio.mjs` |

Replace `<YOUR_STARPM_ORIGIN>` with your deployed origin (example shape: `https://your-starpm.example.com`).

Without Bearer on `/api/mcp`, many deployments fall back to a **demo sandbox** (read/write demo only — do not treat as your private projects).

---

## Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "star-pm": {
      "url": "https://<YOUR_STARPM_ORIGIN>/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}
```

Restart Cursor / reload MCP after editing. Server may show as `user-star-pm` / `star-pm`.

Repo template (no secrets): `.cursor/mcp.json.example` in the StarPM app repo.

---

## Codex

```bash
codex mcp add star-pm \
  --url https://<YOUR_STARPM_ORIGIN>/api/mcp \
  --bearer-token-env-var STAR_PM_MCP_TOKEN
```

Set user env `STAR_PM_MCP_TOKEN`, then restart Codex.

---

## Smoke test

1. `list_projects` — see projects (or demo).  
2. `capture_idea` with a test title + **rawThought** = your exact sentence.  
3. Open StarPM UI / `get_idea` — Original Thought must match, not a polished rewrite.

Fail → fix auth; do not pretend data was saved.

---

## Tool intents

See [`TOOLS.md`](./TOOLS.md). Full admin/DDL tools exist on some instances; Method v0.1 only needs the steward subset.
