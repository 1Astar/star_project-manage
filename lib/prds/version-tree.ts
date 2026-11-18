/**
 * PRD 列表按「版本根」折叠：外层只显示 APP重构1.0 这类根，
 * 展开后是板块 → 文档/原型（与编辑器左侧树同级）。
 */
import { unpackPrdDocument, type PrdDocPage } from "@/lib/prds/doc-pages";
import type { ProjectPrd, Prototype } from "@/lib/types";
import { resolvePrototypeUrl } from "@/lib/prototypes/resolve-url";

export function versionRootOf(prd: ProjectPrd): string {
  const raw = (prd.module_path?.trim() || prd.title.trim() || "未分版本").trim();
  const parts = raw.split("·").map((s) => s.trim()).filter(Boolean);
  return parts[0] || "未分版本";
}

/** module_path 去掉版本根后的剩余路径（可多层 ·） */
export function moduleTailOf(prd: ProjectPrd): string {
  const raw = (prd.module_path?.trim() || "").trim();
  const parts = raw.split("·").map((s) => s.trim()).filter(Boolean);
  return parts.slice(1).join("·");
}

export type VersionGroup = {
  key: string;
  prds: ProjectPrd[];
};

export function groupPrdsByVersion(prds: ProjectPrd[]): VersionGroup[] {
  const map = new Map<string, ProjectPrd[]>();
  for (const prd of prds) {
    const key = versionRootOf(prd);
    const list = map.get(key) ?? [];
    list.push(prd);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, items]) => ({ key, prds: items }));
}

export function docPagesOf(prd: ProjectPrd): PrdDocPage[] | null {
  return unpackPrdDocument(prd.html_content).pages;
}

export function isMultiPageDoc(prd: ProjectPrd): boolean {
  const pages = docPagesOf(prd);
  return Boolean(pages && pages.length > 1);
}

/** 多页文档：若唯一根页标题≈版本名，列表展开时从子页开始，避免再叠一层同名根 */
export function listRootsForVersion(
  pages: PrdDocPage[],
  versionKey: string
): { roots: PrdDocPage[]; hideRootIds: Set<string> } {
  const top = pages
    .filter((p) => !p.parentId)
    .sort((a, b) => a.order - b.order);
  const hideRootIds = new Set<string>();
  if (top.length === 1) {
    const only = top[0];
    const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    if (
      norm(only.title) === norm(versionKey) ||
      norm(only.title).startsWith(norm(versionKey)) ||
      norm(versionKey).startsWith(norm(only.title))
    ) {
      hideRootIds.add(only.id);
      const children = pages
        .filter((p) => p.parentId === only.id)
        .sort((a, b) => a.order - b.order);
      if (children.length > 0) {
        return { roots: children, hideRootIds };
      }
    }
  }
  return { roots: top, hideRootIds };
}

export type VersionOutlineNode =
  | {
      kind: "folder";
      id: string;
      title: string;
      children: VersionOutlineNode[];
    }
  | {
      kind: "prd";
      id: string;
      title: string;
      prd: ProjectPrd;
      pageId?: string;
      children?: VersionOutlineNode[];
    }
  | {
      kind: "proto";
      id: string;
      title: string;
      prd: ProjectPrd;
      protoId: string;
      url?: string;
    };

function protoNodesForPrd(
  prd: ProjectPrd,
  protoList: Prototype[],
  idPrefix: string
): Extract<VersionOutlineNode, { kind: "proto" }>[] {
  const out: Extract<VersionOutlineNode, { kind: "proto" }>[] = [];
  prd.linked_prototypes.forEach((link, index) => {
    const proto = protoList.find((p) => p.id === link.prototype_id);
    if (!proto) return;
    const url =
      proto.external_url || resolvePrototypeUrl(proto.storage_path) || undefined;
    out.push({
      kind: "proto",
      id: `${idPrefix}:proto:${proto.id}:${index}`,
      title: proto.name.startsWith("Prototype")
        ? proto.name
        : `Prototype｜${proto.name}`,
      prd,
      protoId: proto.id,
      url,
    });
  });
  return out;
}

function pageSubtree(
  prd: ProjectPrd,
  pages: PrdDocPage[],
  page: PrdDocPage,
  hideRootIds: Set<string>
): VersionOutlineNode {
  const children = pages
    .filter((p) => p.parentId === page.id && !hideRootIds.has(p.id))
    .sort((a, b) => a.order - b.order)
    .map((child) => pageSubtree(prd, pages, child, hideRootIds));

  const isProto =
    Boolean(page.prototypeUrl) ||
    /^Prototype[｜|\-]/i.test(page.title) ||
    page.title.startsWith("Prototype");

  if (isProto) {
    return {
      kind: "proto",
      id: `${prd.id}:page:${page.id}`,
      title: page.title,
      prd,
      protoId: page.id,
      url: page.prototypeUrl,
    };
  }

  if (children.length > 0) {
    const textLen = page.content
      ? page.content.replace(/<[^>]+>/g, "").trim().length
      : 0;
    const selfLeaf: VersionOutlineNode | null =
      textLen > 40
        ? {
            kind: "prd",
            id: `${prd.id}:page:${page.id}`,
            title: /PRD/i.test(page.title)
              ? page.title
              : `${page.title} PRD`,
            prd,
            pageId: page.id,
          }
        : null;
    return {
      kind: "folder",
      id: `${prd.id}:folder:${page.id}`,
      title: page.title,
      children: selfLeaf ? [selfLeaf, ...children] : children,
    };
  }

  return {
    kind: "prd",
    id: `${prd.id}:page:${page.id}`,
    title: page.title,
    prd,
    pageId: page.id,
  };
}

/**
 * 某个版本根展开后的大纲（板块 → PRD / 原型）。
 * 多页包优先用文档内页面树；否则按 module_path 去掉版本后的尾段分组。
 */
export function buildVersionOutline(
  group: VersionGroup,
  protoList: Prototype[]
): VersionOutlineNode[] {
  if (group.prds.length === 1 && isMultiPageDoc(group.prds[0])) {
    const prd = group.prds[0];
    const pages = docPagesOf(prd)!;
    const { roots, hideRootIds } = listRootsForVersion(pages, group.key);
    const tree = roots.map((p) => pageSubtree(prd, pages, p, hideRootIds));
    const pageIds = new Set(pages.map((p) => p.id));
    const extraProtos = protoNodesForPrd(prd, protoList, prd.id).filter(
      (n) => !pageIds.has(n.protoId)
    );
    return extraProtos.length ? [...tree, ...extraProtos] : tree;
  }

  const byTail = new Map<string, ProjectPrd[]>();
  for (const prd of group.prds) {
    const tail = moduleTailOf(prd);
    const list = byTail.get(tail) ?? [];
    list.push(prd);
    byTail.set(tail, list);
  }

  const nodes: VersionOutlineNode[] = [];
  for (const [tail, items] of byTail) {
    const leaves: Extract<VersionOutlineNode, { kind: "prd" }>[] = [];
    for (const prd of items) {
      leaves.push({
        kind: "prd",
        id: `prd:${prd.id}`,
        title: prd.title,
        prd,
        children: protoNodesForPrd(prd, protoList, prd.id),
      });
    }
    if (!tail) {
      nodes.push(...leaves);
      continue;
    }
    const folderChildren: VersionOutlineNode[] = leaves.flatMap((leaf) => {
      const protos = leaf.children ?? [];
      const head: VersionOutlineNode = {
        kind: "prd",
        id: leaf.id,
        title: leaf.title,
        prd: leaf.prd,
        pageId: leaf.pageId,
      };
      return protos.length ? [head, ...protos] : [head];
    });
    nodes.push({
      kind: "folder",
      id: `mod:${group.key}:${tail}`,
      title: tail,
      children: folderChildren,
    });
  }
  return nodes;
}
