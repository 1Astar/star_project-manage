"use client";

import { cn } from "@/lib/utils";

export type ViewSwitchOption<T extends string> = {
  id: T;
  label: string;
};

export function ViewSwitch<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ViewSwitchOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1",
        className
      )}
      role="tablist"
    >
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            value === item.id
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
