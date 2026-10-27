"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";
import { saveLinkedViewPeekAction } from "@/lib/linked-views/actions";
import type { LinkedViewModuleChoice } from "@/lib/linked-views/module-path";
import { peekModuleFields } from "@/lib/linked-views/module-path";
import type { LinkedViewRow } from "@/lib/linked-views/query";

export function useLinkedViewPeek(
  projectSlug: string,
  canSave: boolean,
  options?: {
    projectId?: string;
    moduleOptions?: string[];
    moduleTree?: LinkedViewModuleChoice[];
  }
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moduleOptions = options?.moduleOptions ?? [];
  const moduleTree = options?.moduleTree ?? [];

  function openPeek(item: EntityPeekPayload) {
    setError(null);
    setPeek({
      ...item,
      moduleOptions: item.moduleOptions?.length ? item.moduleOptions : moduleOptions,
      moduleTree: item.moduleTree?.length ? item.moduleTree : moduleTree,
    });
  }

  function openRow(row: LinkedViewRow) {
    if (!row.peekKind) return;
    const fields = [...(row.fields ?? [])];
    const hasModule = fields.some(
      (f) => f.key === "module_path" || f.key === "module"
    );
    if (!hasModule && row.cells?.module) {
      fields.push(...peekModuleFields(row.cells.module));
    }
    openPeek({
      kind: row.peekKind,
      id: row.id,
      title: row.title,
      href: row.href,
      badge: row.badge,
      titlePlaceholder: row.titlePlaceholder,
      titleHint: row.titleHint,
      moduleOptions: row.moduleOptions,
      moduleTree,
      fields,
    });
  }

  async function savePeek(patch: {
    title: string;
    fields: Record<string, string>;
  }) {
    if (!peek) return;
    setPending(true);
    setError(null);
    try {
      await saveLinkedViewPeekAction({
        projectSlug,
        projectId: options?.projectId,
        kind: peek.kind,
        id: peek.id,
        title: patch.title,
        fields: patch.fields,
      });
      setPeek(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  const peekNode = peek ? (
    <EntitySidePeek
      item={peek}
      pending={pending}
      onClose={() => setPeek(null)}
      onSave={canSave ? savePeek : undefined}
    />
  ) : null;

  return { peek, openRow, openPeek, peekNode, peekError: error, pending };
}
