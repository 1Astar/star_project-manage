import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star PM · 轻量原型项目管理",
  description: "原型 → 需求 → 开发 → 测试 → 产品验收",
};

/** 页面依赖 Supabase/本地库，构建时不做静态预渲染 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
