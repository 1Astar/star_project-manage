import assert from "node:assert/strict";
import {
  bundlePmAcceptanceItems,
  modulePathFromRequirement,
  normalizeModulePath,
  splitModuleMajorMinor,
  UNCATEGORIZED_MODULE,
} from "@/lib/workbench/acceptance-bundles";
import type { PmAcceptanceItem } from "@/lib/workbench/pm-inbox";

assert.equal(normalizeModulePath(""), UNCATEGORIZED_MODULE);
assert.equal(normalizeModulePath("六爻/笔记"), "六爻·笔记");
{
  const s = splitModuleMajorMinor("八字·图鉴·大运流年");
  assert.equal(s.major, "八字");
  assert.equal(s.minor, "图鉴·大运流年");
}
assert.equal(normalizeModulePath("工作台 · 验收"), "工作台·验收");

{
  const path = modulePathFromRequirement(
    { module_l1_id: "m1", module_l2_id: "m2" },
    [
      {
        id: "m1",
        iteration_id: "i",
        parent_id: null,
        name: "工作台",
        level: 1,
        estimate_level: "module",
        module_estimate_hours: null,
        sort_order: 0,
      },
      {
        id: "m2",
        iteration_id: "i",
        parent_id: "m1",
        name: "验收",
        level: 2,
        estimate_level: "module",
        module_estimate_hours: null,
        sort_order: 0,
      },
    ]
  );
  assert.equal(path, "工作台·验收");
}

function item(partial: Partial<PmAcceptanceItem> & Pick<PmAcceptanceItem, "id" | "title" | "module">): PmAcceptanceItem {
  return {
    projectId: "proj-a",
    pmProjectId: "pm-a",
    projectTitle: "Star PM",
    href: "/x",
    source: "change_session",
    sourceLabel: "变更会话",
    at: "2026-08-12T10:00:00+08:00",
    why: partial.why ?? partial.title,
    result: partial.result ?? "done",
    howToVerify: partial.howToVerify ?? ["打开工作台"],
    ...partial,
  };
}

{
  const bundles = bundlePmAcceptanceItems([
    item({
      id: "1",
      title: "A",
      module: "工作台·验收",
      why: "减负",
      howToVerify: ["看清单"],
    }),
    item({
      id: "2",
      title: "B",
      module: "工作台/验收",
      why: "汇总",
      howToVerify: ["点通过"],
    }),
    item({
      id: "3",
      title: "C",
      module: "",
      projectId: "proj-a",
    }),
  ]);
  assert.equal(bundles.length, 2);
  const main = bundles.find((b) => b.module === "工作台·验收");
  assert.ok(main);
  assert.equal(main!.itemCount, 2);
  assert.match(main!.why, /减负|汇总/);
  assert.ok(main!.howToVerify.includes("看清单"));
  const unc = bundles.find((b) => b.module === UNCATEGORIZED_MODULE);
  assert.ok(unc);
  assert.equal(unc!.itemCount, 1);
}

console.log("lib/workbench/acceptance-bundles.test.ts ok");
