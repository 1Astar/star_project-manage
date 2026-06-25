import Link from "next/link";

const directions = [
  {
    id: "document",
    name: "方向 A · 文档型",
    desc: "类 Notion / Airtable，表格 + 侧栏，适合与 Excel 工时表心智一致",
    accent: "bg-amber-50 border-amber-200",
    tag: "推荐：导入迁移成本低",
  },
  {
    id: "kanban",
    name: "方向 B · 看板型",
    desc: "Jira / Linear 风格，状态列 + 紧凑卡片，适合开发日常更新",
    accent: "bg-blue-50 border-blue-200",
    tag: "推荐：协作更新最快",
  },
  {
    id: "prototype",
    name: "方向 C · 原型优先",
    desc: "大预览区 + 浮动任务面板，适合验收时对照原型逐项核对",
    accent: "bg-violet-50 border-violet-200",
    tag: "推荐：产品验收场景",
  },
];

function DocumentPreview() {
  return (
    <div className="flex h-64 overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
      <aside className="w-28 border-r border-slate-100 bg-slate-50 p-2">
        <div className="font-semibold text-slate-700">AI 宠物</div>
        <div className="mt-2 space-y-1 text-slate-500">
          <div>总览</div>
          <div className="font-medium text-blue-600">需求表</div>
          <div>工时</div>
        </div>
      </aside>
      <div className="flex-1 p-2">
        <table className="w-full">
          <thead>
            <tr className="text-left text-slate-400">
              <th className="p-1">一级模块</th>
              <th className="p-1">需求</th>
              <th className="p-1">后端</th>
              <th className="p-1">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="p-1">宠物详情</td>
              <td className="p-1">专注横幅</td>
              <td className="p-1">16h</td>
              <td className="p-1"><span className="rounded bg-amber-100 px-1 text-amber-700">待测试</span></td>
            </tr>
            <tr className="border-t border-slate-100">
              <td className="p-1">推送</td>
              <td className="p-1">模块级 40h</td>
              <td className="p-1">40h</td>
              <td className="p-1"><span className="rounded bg-blue-100 px-1 text-blue-700">开发中</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanPreview() {
  const cols = ["待开始", "开发中", "待测试", "待验收"];
  return (
    <div className="grid h-64 grid-cols-4 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
      {cols.map((col, i) => (
        <div key={col} className="rounded bg-white p-2">
          <div className="mb-2 font-semibold text-slate-600">{col}</div>
          {i < 3 ? (
            <div className="rounded border border-slate-200 bg-white p-2 shadow-sm">
              <div className="font-medium">专注横幅</div>
              <div className="mt-1 text-slate-400">前端 · 陈伟平</div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PrototypePreview() {
  return (
    <div className="relative h-64 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 text-xs">
      <div className="flex h-full items-center justify-center text-slate-500">原型 iframe 预览区</div>
      <div className="absolute right-2 top-2 w-36 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        <div className="font-semibold text-slate-700">需求面板</div>
        <div className="mt-1 text-slate-500">专注横幅</div>
        <div className="mt-2 rounded bg-green-100 px-1 text-green-700">验收通过</div>
      </div>
    </div>
  );
}

const previews: Record<string, () => React.ReactNode> = {
  document: DocumentPreview,
  kanban: KanbanPreview,
  prototype: PrototypePreview,
};

export default function UiPreviewPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="text-sm font-semibold text-blue-600">Phase 0 · 视觉方向</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Star PM 三套 UI 方向</h1>
          <p className="mt-2 text-slate-600">
            正式版采用「文档型表格 + 看板协作 + 原型侧栏」融合布局。确认后可进入项目总览。
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            进入 Star PM →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-1">
          {directions.map((d) => {
            const Preview = previews[d.id];
            return (
              <section key={d.id} className={`card border-2 p-5 ${d.accent}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{d.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{d.desc}</p>
                    <span className="mt-2 inline-block rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {d.tag}
                    </span>
                  </div>
                </div>
                <div className="mt-4">{Preview()}</div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
