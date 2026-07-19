import type { Asset, AssetType, Project } from "@/lib/studio/types";
import { ASSET_TYPE_LABELS } from "@/lib/studio/types";

function githubRepoUrl(repoFullName: string) {
  return `https://github.com/${repoFullName}`;
}

export type ResourceCategoryId =
  | "experience"
  | "repo"
  | "design"
  | "doc"
  | "material"
  | "prompt"
  | "api"
  | "deploy"
  | "video";

export type ResourceCategoryDef = {
  id: ResourceCategoryId;
  label: string;
  desc: string;
  /** 半自动：从项目字段生成条目 */
  auto: boolean;
};

export const RESOURCE_CATEGORIES: ResourceCategoryDef[] = [
  { id: "experience", label: "在线体验", desc: "演示站 / Demo 入口", auto: true },
  { id: "repo", label: "代码仓库", desc: "GitHub 绑定仓库", auto: true },
  { id: "design", label: "设计稿", desc: "Figma / 设计文件", auto: false },
  { id: "doc", label: "文档", desc: "PRD / 技术说明", auto: false },
  { id: "material", label: "素材", desc: "图片 / 竞品 / 参考素材", auto: false },
  { id: "prompt", label: "Prompt", desc: "提示词与 Agent 配置", auto: false },
  { id: "api", label: "API", desc: "接口文档与密钥说明链接", auto: false },
  { id: "deploy", label: "部署", desc: "Vercel / 启动说明", auto: true },
  { id: "video", label: "视频", desc: "演示与讲解视频", auto: false },
];

const LEGACY_TO_CATEGORY: Record<string, ResourceCategoryId> = {
  experience: "experience",
  repo: "repo",
  design: "design",
  doc: "doc",
  material: "material",
  prompt: "prompt",
  api: "api",
  deploy: "deploy",
  video: "video",
  competitor: "material",
  ui_ref: "design",
  tech_doc: "doc",
  inspiration: "material",
};

export function normalizeAssetCategory(type: string | null | undefined): ResourceCategoryId {
  if (!type) return "material";
  return LEGACY_TO_CATEGORY[type] ?? "material";
}

export function normalizeAssetType(type: string | null | undefined): AssetType {
  return normalizeAssetCategory(type) as AssetType;
}

export function assetTypeLabel(type: string | null | undefined): string {
  const cat = normalizeAssetCategory(type);
  return ASSET_TYPE_LABELS[cat] ?? type ?? "素材";
}

export type ResourceAutoItem = {
  id: string;
  title: string;
  url: string | null;
  note?: string;
  source: "project";
};

export function buildAutoResourceItems(
  project: Project,
  opts?: { releaseTag?: string | null }
): Record<"experience" | "repo" | "deploy", ResourceAutoItem[]> {
  const experience: ResourceAutoItem[] = [];
  if (project.demoUrl?.trim()) {
    experience.push({
      id: "auto-demo",
      title: "演示 / 在线体验",
      url: project.demoUrl.trim(),
      source: "project",
    });
  }

  const repo: ResourceAutoItem[] = [];
  if (project.githubRepo?.trim()) {
    const full = project.githubRepo.trim();
    const tag = opts?.releaseTag?.trim();
    repo.push({
      id: "auto-repo",
      title: tag ? `${full} @ ${tag}` : full,
      url: tag
        ? `${githubRepoUrl(full)}/tree/${encodeURIComponent(tag)}`
        : githubRepoUrl(full),
      note: tag
        ? `版本 ${tag}`
        : project.githubBranch
          ? `分支 ${project.githubBranch}`
          : undefined,
      source: "project",
    });
  }

  const deploy: ResourceAutoItem[] = [];
  if (project.vercelUrl?.trim()) {
    deploy.push({
      id: "auto-vercel",
      title: "Vercel 部署",
      url: project.vercelUrl.trim(),
      source: "project",
    });
  }
  if (project.localRunGuide?.trim()) {
    deploy.push({
      id: "auto-local-run",
      title: "本地启动说明",
      url: null,
      note: project.localRunGuide.trim(),
      source: "project",
    });
  }

  return { experience, repo, deploy };
}

export function countAssetsInCategory(assets: Asset[], categoryId: ResourceCategoryId): number {
  return assets.filter((a) => normalizeAssetCategory(a.assetType) === categoryId).length;
}
