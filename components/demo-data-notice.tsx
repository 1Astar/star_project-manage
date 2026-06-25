import Link from "next/link";

export function DemoDataNotice({ projectSlug }: { projectSlug?: string }) {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <strong>当前为演示种子数据</strong>
      <span className="ml-2">
        「AI 宠物」「AI 控制器」来自数据库初始化脚本，便于体验功能。请通过
        {projectSlug ? (
          <Link href={`/projects/${projectSlug}/import`} className="mx-1 font-medium underline">
            Excel 导入
          </Link>
        ) : (
          " Excel 导入"
        )}
        写入真实工时表；导入时可勾选「清空本项目已有需求」替换演示数据。
      </span>
    </div>
  );
}
