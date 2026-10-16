---
name: word-docx-professional
description: >-
  用 Node.js + docx 生成专业商务 Word（.docx）：版式、配色、表格、标题层级。
  Use when 生成或改版调研报告、PRD、方案书、商务 Word 交付物时。
---

# 专业 Word 生成（Node + docx）

与 `doc-delivery-formats`、`version-management` 联用。  
本地格式参考（若存在）：`工具/private/产品/prd文档/格式/Word_docx生成样式提示词_商务Node版.md`

## 技术栈

- **库**：`docx`（Node.js），`Packer.toBuffer` 输出 `.docx`
- **结构**：样式 helper 独立模块（如 `styles.mjs`）+ 生成脚本（如 `generate-*.mjs`）
- **数据**：长章节可从 JSON 导出后回放（先 export 再 generate）

## 配色（商务 / 科技蓝系）

- 主色深 / 中 / 浅三档区分 H1 / H2 / H3（示例：**#1F3864 / #365F91 / #8FAADC**）
- 表头：深底 **#1F3864** + 白字加粗居中
- 重要行浅底 **#E7EEF7**；合计行 **#FFF2CC**；结论数字 **#C00000** 加粗
- 警告 **#C00000**；注释 **#666666** 斜体
- 正文 **#333333**；不超过 3 种主色色相；禁止荧光色
- 写入 `docx` 的 `color` **不要带 `#`**

## 字体

- 中文：**Microsoft YaHei**（`eastAsia`）
- 英数：**Times New Roman**（`ascii` / `hAnsi` / `cs`）
- 所有 `TextRun` 显式指定，避免回退宋体

## 字号与段落

- 正文：**五号** 10.5pt = **21 半磅**
- 注释小字：**20** 半磅
- 行距：`line: 320`, `lineRule: EXACTLY`
- H1 前后 **480/200**；H2 **320/160**；H3 **240/120** twips
- 标题必须设 `heading: HeadingLevel.HEADING_1|2|3` 供导航窗格识别

## 表格

- 边框 `SINGLE` size **4** 色 **BFBFBF**
- 单元格 padding 上下 **100** 左右 **120**
- 列宽 `WidthType.DXA`，A4 正文区常用总宽 **9360**
- 单元格支持 `{ text, bold, color, fill, parts }` 混排

## 页面

- A4：**11906 × 16838** twips；页边距四周 **1080**

## 封面与页脚

- 封面大标题：居中、**56** 半磅×2、加粗、色 **1F3864**
- 页脚页码：小字灰色 **BBBBBB** 居中

## 工作流

1. 读 `version-management`：小改同文件 / 大改新文件名  
2. 读用户现行 docx（若存在）再改  
3. `npm install`（项目内 generator 目录）  
4. 生成到 `outputs/` 或 `OUTPUT_DIR`  
5. 验证文件可打开、大纲层级正确  
6. 成品路径记入 PM（可选）

## 禁止

- 用 Word 默认样式偷懒、不指定字体  
- 用对话旧稿覆盖用户已改 docx  
- 在交付目录旁堆过程 md
