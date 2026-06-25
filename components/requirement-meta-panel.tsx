"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveRequirementMetaAction } from "@/lib/actions";
import type { PoolColumnDef, Requirement } from "@/lib/types";

export function RequirementMetaPanel({
  requirement,
  projectSlug,
  poolColumnDefs,
  tagOptions,
}: {
  requirement: Requirement;
  projectSlug: string;
  poolColumnDefs: PoolColumnDef[];
  tagOptions: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(updates: Parameters<typeof saveRequirementMetaAction>[0]["updates"]) {
    startTransition(async () => {
      await saveRequirementMetaAction({
        requirementId: requirement.id,
        projectSlug,
        updates,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const tags = requirement.tags ?? [];
  const allTags = Array.from(new Set([...tagOptions, ...tags]));

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">链接与规划</h2>
        {saved ? <span className="text-xs text-green-600">已保存</span> : null}
      </div>

      <label className="block text-sm">
        <span className="text-slate-500">PRD / 文档链接</span>
        <input
          defaultValue={requirement.prd_link ?? ""}
          disabled={pending}
          onBlur={(e) => {
            if (e.target.value !== (requirement.prd_link ?? "")) {
              save({ prd_link: e.target.value || null });
            }
          }}
          placeholder="Notion / 飞书 / Google Doc"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-slate-500">原型链接</span>
        <input
          defaultValue={requirement.prototype_link ?? ""}
          disabled={pending}
          onBlur={(e) => {
            if (e.target.value !== (requirement.prototype_link ?? "")) {
              save({ prototype_link: e.target.value || null });
            }
          }}
          placeholder="Figma / HTML 原型地址"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        {requirement.prd_link ? (
          <a
            href={requirement.prd_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            打开 PRD →
          </a>
        ) : null}
        {requirement.prototype_link ? (
          <a
            href={requirement.prototype_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            打开原型 →
          </a>
        ) : null}
        <Link
          href={`/projects/${projectSlug}/prototype`}
          className="text-sm text-slate-500 hover:text-blue-600"
        >
          原型工作区
        </Link>
      </div>

      <label className="block text-sm">
        <span className="text-slate-500">产品预估工时（h）</span>
        <input
          type="number"
          min={0}
          step={0.5}
          defaultValue={requirement.product_estimate_hours ?? ""}
          disabled={pending}
          onBlur={(e) => {
            const val = e.target.value ? Number(e.target.value) : null;
            if (val !== requirement.product_estimate_hours) {
              save({ product_estimate_hours: val });
            }
          }}
          className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2"
        />
      </label>

      <div>
        <div className="text-sm text-slate-500">标签</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                disabled={pending}
                onClick={() => {
                  const next = active ? tags.filter((t) => t !== tag) : [...tags, tag];
                  save({ tags: next });
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {poolColumnDefs.length > 0 ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="text-sm font-medium">自定义字段</div>
          {poolColumnDefs.map((def) => (
            <CustomMetaField
              key={def.id}
              def={def}
              value={requirement.custom_fields?.[def.key] ?? null}
              disabled={pending}
              onSave={(value) => save({ custom_fields: { [def.key]: value } })}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CustomMetaField({
  def,
  value,
  disabled,
  onSave,
}: {
  def: PoolColumnDef;
  value: string | number | boolean | null;
  disabled: boolean;
  onSave: (value: string | number | boolean | null) => void;
}) {
  if (def.column_type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onSave(e.target.checked)}
        />
        {def.label}
      </label>
    );
  }

  if (def.column_type === "select") {
    return (
      <label className="block text-sm">
        <span className="text-slate-500">{def.label}</span>
        <select
          defaultValue={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onSave(e.target.value || null)}
          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2"
        >
          <option value="">—</option>
          {def.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm">
      <span className="text-slate-500">{def.label}</span>
      <input
        type={
          def.column_type === "number"
            ? "number"
            : def.column_type === "date"
              ? "date"
              : "text"
        }
        defaultValue={value != null ? String(value) : ""}
        disabled={disabled}
        onBlur={(e) => {
          const raw = e.target.value;
          if (def.column_type === "number") {
            onSave(raw ? Number(raw) : null);
          } else {
            onSave(raw || null);
          }
        }}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
      />
    </label>
  );
}
