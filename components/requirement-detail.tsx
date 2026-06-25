"use client";

import { useTransition } from "react";
import { saveAcceptanceAction, submitTestAction } from "@/lib/actions";
import type { AcceptanceItem } from "@/lib/types";

export function RequirementDetailClient({
  projectId,
  requirementId,
  acceptanceItems,
}: {
  projectId: string;
  requirementId: string;
  acceptanceItems: AcceptanceItem[];
}) {
  const [pending, startTransition] = useTransition();

  function reviewItem(itemId: string, passed: boolean, note?: string) {
    startTransition(async () => {
      await saveAcceptanceAction({
        itemId,
        passed,
        note,
        actorName: "产品",
        projectId,
        requirementId,
      });
    });
  }

  function submitTest(passed: boolean) {
    const issueDescription = passed
      ? undefined
      : prompt("请填写不通过原因") ?? "测试不通过";
    startTransition(async () => {
      await submitTestAction({
        requirementId,
        passed,
        issueDescription,
        testerName: "测试",
        projectId,
      });
    });
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">测试核对</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => submitTest(true)}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            通过
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submitTest(false)}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            不通过
          </button>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">产品验收（逐项绑定）</h2>
        {acceptanceItems.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-medium">{item.description}</div>
            {item.note ? <div className="mt-1 text-sm text-red-600">{item.note}</div> : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => reviewItem(item.id, true)}
                className={`rounded-md px-2 py-1 text-xs ${
                  item.passed === true
                    ? "bg-green-100 text-green-700"
                    : "border border-slate-200"
                }`}
              >
                验收通过
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const note = prompt("退回原因") ?? "验收不通过";
                  reviewItem(item.id, false, note);
                }}
                className={`rounded-md px-2 py-1 text-xs ${
                  item.passed === false
                    ? "bg-red-100 text-red-700"
                    : "border border-slate-200"
                }`}
              >
                退回开发
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
