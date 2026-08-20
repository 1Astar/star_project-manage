# StarPM Method — Skill v0.1

> **StarPM remembers why your project became what it is.**  
> **StarPM 记住项目为什么变成今天这样。**

Not another task UI. Capture / Change / Recover all serve one job: **project context doesn't disappear.**

---

## Four layers

| Layer | What it is | v0.1 strategy |
|-------|------------|----------------|
| **StarPM Method** | Your PM thought system / rules | Core principles public; full method expands over time |
| **StarPM Skill** | Teaches Method to an Agent | **Basic free** (this folder) |
| **StarPM MCP Interface** | How Agents operate StarPM | **Interface docs public**; **Server closed** |
| **StarPM Core** | Data, memory, cloud, UI, collab | **Closed source** |

MCP is a **door**, not the business.  
Users pay (later) for: **StarPM keeping, organizing, and restoring project context.**  
If a host uses API / Plugin / SDK instead of MCP, the model still holds.

```text
     Method  →  Skill (free v0.1)
                    │
                    ▼
            MCP Interface (docs open)
                    │
                    ▼
                 Core (closed)
            memory · why · timeline
```

---

## Two decisions (now)

1. **Skill v0.1 is free to publish.**  
2. **StarPM Core + MCP Server are not open-sourced.**

Do not debate pricing or full open-source this week. Ship Method → Skill → three flows → your server → MAS → real users first.

---

## v0.1 scope (narrow)

Only three flows:

| Flow | English | What |
|------|---------|------|
| ① | **Capture** | Casual Idea + Original Thought |
| ② | **Change** | Priority/scope flip + Decision trail |
| ③ | **Recover** | Where / why paused / next |

Scripts: [`EXAMPLES.md`](./EXAMPLES.md) · Rules: [`SKILL.md`](./SKILL.md)

---

## Install

**Public Skill repo:** https://github.com/1Astar/starpm-method  

From this folder (or clone of `starpm-method`):

```powershell
.\install.ps1
```

```bash
bash ./install.sh
```

If you are inside the StarPM app monorepo:

```powershell
.\method\starpm-skill\install.ps1
```

Or copy to `~/.cursor/skills/starpm-method/` · [`INSTALL.md`](./INSTALL.md)

Connect persistence: [`CONNECT_MCP.md`](./CONNECT_MCP.md) · intents [`TOOLS.md`](./TOOLS.md)  
No MCP → Skill still emits a **StarPM draft** and asks to connect Core via the door you have.

---

## Demo & MAS

- 晨光手记 sandbox: [`DEMO_CHENGGUANG.md`](./DEMO_CHENGGUANG.md)  
- MAS「项目管家」: [`MAS_HOST.md`](./MAS_HOST.md)

---

## Success metric (before pricing)

Find **2–5 real people**. Don't ask “how much would you pay?” first.

**Harsher signal:** in week 2, do they still throw project stuff in?

- Yes → real behavior.  
- No → come back and find why.  

Only after a second person depends on **Recover** for context, talk Pro / Team / price.

Soft capability roadmap (no ¥): later Method depth, hosted Core, collab — still closed Core + closed MCP Server.

---

## Philosophy

- **Original Thought** is sacred; AI interprets, never erases “为什么”.  
- Tasks are surface; **why the project became what it is** is the product.  
- Skill teaches; Interface is a door; Core remembers.

---

## Version

- **Method Skill:** v0.1 (Capture / Change / Recover)  
- **Parent:** StarPM app repo (`README.md` / `CHANGELOG.md`)
