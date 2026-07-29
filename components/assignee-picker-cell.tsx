"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  options: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

export function AssigneePickerCell({ value, options, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(name: string) {
    if (value.includes(name)) onChange(value.filter((v) => v !== name));
    else onChange([...value, name]);
  }

  function addCustom() {
    const name = draft.trim();
    if (!name) return;
    if (!value.includes(name)) onChange([...value, name]);
    setDraft("");
  }

  const label = value.length ? value.join("、") : "";

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-slate-50",
          label ? "text-slate-700" : "text-slate-300",
          open ? "ring-1 ring-indigo-300 bg-indigo-50/40" : ""
        )}
        title="点击选择指派人"
      >
        {label || "空白"}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            点选人员
          </p>
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {options.map((name) => {
              const on = value.includes(name);
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => toggle(name)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                      on
                        ? "bg-violet-50 text-violet-800"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px]",
                        on
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {on ? "✓" : ""}
                    </span>
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="其他人回车添加"
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={addCustom}
              className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
            >
              加
            </button>
          </div>
          {value.length ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1.5 w-full rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              清空指派
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
