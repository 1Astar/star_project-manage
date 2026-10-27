/** 一级模块 / 二级分区：路径用 ·，标题里用户可写成 [设置-网络] */

export type SplitModulePath = { l1: string; l2: string };

export function splitModulePath(raw: string | null | undefined): SplitModulePath {
  const parts = (raw ?? "")
    .trim()
    .split(/[>/·\-|／]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { l1: parts[0] ?? "", l2: parts[1] ?? "" };
}

export function joinModulePath(l1: string, l2: string): string {
  const a = l1.trim();
  const b = l2.trim();
  if (!a) return "";
  if (!b) return a;
  return `${a}·${b}`;
}

export type LinkedViewModuleChoice = {
  name: string;
  partitions: string[];
};

export function peekModuleFields(path: string) {
  const { l1, l2 } = splitModulePath(path);
  return [
    {
      key: "module_path",
      label: "功能模块",
      value: joinModulePath(l1, l2) || path,
    },
    { key: "partition", label: "功能分区", value: l2 },
  ];
}

export function withPartitionTag(tagsRaw: string, l2: string): string {
  const parts = tagsRaw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const n = l2.trim();
  if (n && !parts.includes(n)) parts.push(n);
  return parts.join("、");
}

export function moduleTreeFromNodes(
  modules: Array<{
    id: string;
    name: string;
    level: number;
    parent_id: string | null;
  }>
): LinkedViewModuleChoice[] {
  const l1s = modules.filter((m) => m.level === 1 && m.name.trim());
  return l1s
    .map((l1) => ({
      name: l1.name.trim(),
      partitions: modules
        .filter((m) => m.parent_id === l1.id && m.name.trim())
        .map((m) => m.name.trim()),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"))
    .map((c) => ({
      ...c,
      partitions: [...c.partitions].sort((a, b) => a.localeCompare(b, "zh")),
    }));
}

export function mergeModuleChoices(
  trees: LinkedViewModuleChoice[],
  extras: string[] = []
): LinkedViewModuleChoice[] {
  const map = new Map<string, Set<string>>();
  function addL1(name: string) {
    const n = name.trim();
    if (!n) return;
    if (!map.has(n)) map.set(n, new Set());
  }
  function add(choice: LinkedViewModuleChoice) {
    addL1(choice.name);
    const set = map.get(choice.name.trim());
    if (!set) return;
    for (const p of choice.partitions) {
      const t = p.trim();
      if (t) set.add(t);
    }
  }
  for (const extra of extras) addL1(extra);
  for (const tree of trees) add(tree);
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "zh"))
    .map(([name, parts]) => ({
      name,
      partitions: Array.from(parts).sort((a, b) => a.localeCompare(b, "zh")),
    }));
}
