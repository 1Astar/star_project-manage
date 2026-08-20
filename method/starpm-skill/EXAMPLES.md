# Examples — Capture / Change / Recover

Use with Skill loaded. Prefer Core writes via MCP (or other door) when connected; otherwise expect a **StarPM draft** block.

Project for demos: **晨光手记** / `proj-demo-showcase` when available.

---

## ① Capture

**You:**  
记录一下，登录页以后考虑支持 Passkey。

**Expect:**
- Kind = Idea (not a sprint commitment)
- Original Thought = exact sentence above
- Short AI interpretation
- MCP: `capture_idea` with `rawThought` filled
- Reply summary + one next step (e.g. convert when prioritized)

---

## ② Change

**You:**  
晨光手记那个分享功能先别做了，领导说这周优先做导出。

**Expect:**
- Identify project + related item (“分享”)
- `add_decision` (or Decision in draft) with Original Thought
- Park/defer 分享; raise 导出 only as stated
- Short change summary to you
- Do not invent unrelated scope

---

## ③ Recover

**You:**  
我两个月没碰晨光手记了，现在做到哪、为什么停、下一步是什么？

**Expect:**
- Uses `search` / `summarize_project` / recent decisions when connected
- Answer in three beats: **Where** → **Why paused** → **Next**
- Quotes Original Thoughts when they explain the pause
- If data is thin: say what's missing — no fake history

---

## Acceptance checklist

| Check | Pass |
|-------|------|
| Raw user sentence still stored | ☐ |
| Idea vs Requirement distinguished | ☐ |
| Change left a Decision | ☐ |
| No silent “saved” when write failed | ☐ |
