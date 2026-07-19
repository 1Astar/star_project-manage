import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star PM · 轻量原型项目管理",
  description: "原型 → 需求 → 开发 → 测试 → 产品验收",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
