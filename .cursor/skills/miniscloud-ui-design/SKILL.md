---
name: miniscloud-ui-design
description: >-
  MinisCloud OS 设计系统：PC Web 客户端 + iOS；蓝主色/token/组件/状态。
  Use when 设计或改 MinisCloud/MinisNAS 页面、组件、空态、文案、HTML 原型视觉；
  或用户提到 MinisCloud OS UI、Design-SKILL、PC 窗内 UI。不要用于 Lab（mystic-lab-ui）
  或通用 Star 营销页/默认前端审美规则。
---

# MinisCloud OS · UI Design System（产品分域）

**产品域：仅 MinisCloud OS（PC Web 客户端 + iOS）。**  
激活后，布局、颜色、字体、组件、交互、文案均须符合本设计系统；与通用「少卡片 / 避紫蓝默认审美」冲突时，**本 skill 优先**。

- Lab / 随心而行 → `mystic-lab-ui`  
- MinisCloud PRD / 原型壳 / 评审 → `miniscloud-prd-agents`（八章 + **Web 实现 + 原生窗观感**）  
- 完整 token / 组件 / 模式 → 同目录 **`reference.md`**（必读；本 SKILL 只作入口与冲突消歧）

源文件：`Documents/miniscloud-ui-design.md`；入库后以本 skill 为准。

---

## 何时用 / 不用

**用：** 新页面/流程/组件；空态/错态/加载；设计评审；UI 文案；在两方案间按本系统择一。

**不用：** 后端/API 规格；营销落地页；真正的原生 macOS/Windows 工程（本系统是 **Web UI**，PC 原型窗壳见 `miniscloud-prd-agents`）。

---

## 与 PRD / 窗壳的关系（消歧义）

| 层 | 规则来源 |
|----|----------|
| PC 原型外层窗壳（桌面背景、标题栏、三按钮、阴影） | `miniscloud-prd-agents`：**Web 实现 + 原生窗观感** |
| 窗口内部颜色、字号、间距、组件、状态 | **本 skill / `reference.md`** |

旧文档中的 `Design-SKILL.md` = 本 skill。用户当场明确要求 > 本系统；「只改指定内容」仍优先于扩大美化范围。

---

## 动手前

1. `Read` 本目录 **`reference.md`**（完整 Design Tokens + Component Rules）。  
2. 做 HTML 原型时同时加载 `miniscloud-prd-agents`。  
3. 宣布：`Using miniscloud-ui-design to [purpose]`。  
4. 禁止凭通用审美发明新色值/圆角；就近取 token。

---

## 速记（细节以 reference 为准）

- Primary：`#3D86F8`；UI 字体 PingFang SC；品牌字 Afacad Flux 仅 splash 字标。  
- 交互控件默认圆角 12px；PC 主窗约 26px。  
- Mobile elevation：内容卡默认扁平面，阴影留给浮层。  
- 一页一个 Primary；Danger 仅不可逆操作。
