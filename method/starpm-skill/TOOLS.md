# StarPM MCP — tool intents (public)

This is an **intent map**, not a full OpenAPI dump of every parameter.  
Hosts may expose a subset. Method v0.1 only requires the **Steward core**.

## Steward core (v0.1)

| Intent | Tool | Notes |
|--------|------|--------|
| Find projects | `list_projects` | Pick `relatedProjectId` |
| Capture spark | `capture_idea` | Always pass original words (`rawThought`) |
| Read / list ideas | `get_idea` / `list_ideas` / `search` | Restore context |
| Update idea memory | `update_idea` | Status, next step, decision notes |
| Commit work | `create_requirement` / `update_requirement` / `list_requirements` | Idea ≠ Requirement |
| Decision trail | `add_decision` | Priority flips, “don't do X” |
| Project briefing | `summarize_project` / `summarize_day` / `generate_brief` | Scenario ③ |
| Orient rules | `get_ai_rules` | Instance writing standards |

## Change / shipping (later Method versions)

| Intent | Tool |
|--------|------|
| Open / finish change | `start_change_session` / `finish_change_session` / `list_change_sessions` |
| Evolution narrative | `add_evolution` / `list_evolution` |
| Release | `publish_release` |
| Tasks | `create_task` / `update_task` / `list_tasks` |

## Extended (instance-dependent)

Bugs, interviews, planning iterations, Git sync suggestions, dynamic MCP meta-tools, controlled DDL (`list_tables` / `create_table` / …) — **not required** for Method v0.1 demos.

## Agent rule

If a tool is missing: fall back to the **StarPM draft** block in `SKILL.md` and ask the user to connect/upgrade MCP — never invent a successful write.
