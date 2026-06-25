"use client";

import { useState, useTransition } from "react";
import { saveRequirementNoteAction } from "@/lib/actions";

export function RequirementNoteEditor({
  projectId,
  projectSlug,
  requirementId,
  initialNote,
}: {
  projectId: string;
  projectSlug: string;
  requirementId: string;
  initialNote: string | null;
}) {
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveRequirementNoteAction({
        requirementId,
        note,
        projectId,
        projectSlug,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="pinmark-editor-block">
      <div className="pinmark-editor-label">原型备注（可补充说明，与标注一并留存）</div>
      <textarea
        className="pinmark-note-input"
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="例如：此模块交互需与 PRD 第 3 节对齐；横屏需再验收…"
      />
      <button
        type="button"
        className="pinmark-mini-btn primary"
        disabled={pending}
        onClick={save}
      >
        {pending ? "保存中…" : saved ? "已保存" : "保存备注"}
      </button>
    </div>
  );
}
