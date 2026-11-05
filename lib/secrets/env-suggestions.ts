/** 常用环境变量名建议：可一键复制名 / 填入表单，值由用户自行填写 */

export type EnvNameSuggestion = {
  key: string;
  purpose: string;
};

export const ENV_NAME_SUGGESTIONS: EnvNameSuggestion[] = [
  { key: "ADMIN_USERNAME", purpose: "后台登录（管理员）" },
  { key: "ADMIN_PASSWORD", purpose: "后台登录（管理员）" },
  { key: "VIEWER_USERNAME", purpose: "观看者登录" },
  { key: "VIEWER_PASSWORD", purpose: "观看者登录" },
  { key: "ADMIN_SESSION_SECRET", purpose: "Session 签名" },
  { key: "GITHUB_TOKEN", purpose: "Git 同步 · Issue 灵感捕捉" },
  { key: "STUDIO_IDEAS_REPO", purpose: "灵感 Issue 仓库" },
  { key: "IDEAS_CAPTURE_SECRET", purpose: "ChatGPT → Issue 回调密钥" },
  { key: "CRON_SECRET", purpose: "定时同步 / 提醒" },
  { key: "PUSHPLUS_TOKEN", purpose: "PushPlus 微信推送" },
  { key: "NEXT_PUBLIC_APP_URL", purpose: "推送正文链接根地址" },
  { key: "NOTION_TOKEN", purpose: "Notion 导入" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Supabase URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", purpose: "Supabase anon key" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Supabase 服务端读写" },
  { key: "SECRETS_ENCRYPTION_KEY", purpose: "项目密钥 AES 主密钥" },
  { key: "OPENAI_API_KEY", purpose: "OpenAI / 兼容 API" },
  { key: "VERCEL_TOKEN", purpose: "Vercel API" },
];
