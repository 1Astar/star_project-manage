"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  StudioCustomFieldValue,
  StudioProjectColumnDef,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

function displayValue(value: StudioCustomFieldValue | undefined, type: string) {
  if (value === null || value === undefined || value === "") return "空白";
  if (type === "checkbox") return value ? "是" : "否";
  return String(value);
}

export function InlineCustomFieldCell({
  projectId,
  def,
  value,
}: {
  projectId: string;
  def: StudioProjectColumnDef;
  value: StudioCustomFieldValue | undefined;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? (def.columnType === "checkbox" ? false : ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value ?? (def.columnType === "checkbox" ? false : ""));
  }, [value, editing, def.columnType]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save(next: StudioCustomFieldValue) {
    const prev = value ?? null;
    const normalized =
      def.columnType === "number"
        ? next === "" || next === null
          ? null
          : Number(next)
        : next === ""
          ? null
          : next;
    if (normalized === prev || (normalized == null && prev == null)) {
      setEditing(false);
      return;
    }
    if (def.columnType === "number" && normalized !== null && Number.isNaN(normalized)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: { [def.key]: normalized } }),
      });
      if (!res.ok) return;
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (def.columnType === "checkbox") {
    return (
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={saving}
          onChange={(e) => void save(e.target.checked)}
        />
        {Boolean(value) ? "是" : "否"}
      </label>
    );
  }

  if (editing) {
    if (def.columnType === "select") {
      return (
        <select
          ref={inputRef as RefObject<HTMLSelectElement>}
          value={String(draft ?? "")}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save(String(draft ?? "").trim() || null)}
          className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-xs outline-none ring-2 ring-indigo-100"
        >
          <option value="">空白</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        type={def.columnType === "number" ? "number" : def.columnType === "date" ? "date" : "text"}
        value={String(draft ?? "")}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save(String(draft ?? "").trim() || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save(String(draft ?? "").trim() || null);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-xs outline-none ring-2 ring-indigo-100"
      />
    );
  }

  const empty = value === null || value === undefined || value === "";
  const text = displayValue(value, def.columnType);

  if (def.columnType === "url" && !empty && typeof value === "string") {
    return (
      <div className="flex items-center gap-1">
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-indigo-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value.replace(/^https?:\/\//, "").slice(0, 24)}
        </a>
        <button
          type="button"
          title="编辑"
          onClick={() => setEditing(true)}
          className="text-[10px] text-slate-400 hover:text-slate-600"
        >
          改
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      title="点击编辑"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full rounded px-1.5 py-0.5 text-left text-xs hover:bg-white/80 hover:ring-1 hover:ring-slate-200",
        empty ? "text-slate-300" : "text-slate-600"
      )}
    >
      {text}
    </button>
  );
}
