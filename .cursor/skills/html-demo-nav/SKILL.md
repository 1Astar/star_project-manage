---
name: html-demo-nav
description: >-
  HTML 单页演示稿右侧大纲进度条导航：默认只显示短线，悬停出标题；
  大章节长标题、小节短标题。Use when 做宣传上手版/对外介绍 HTML deck、
  横向翻页演示导航、进度条大纲、右侧短线悬停标题，或改 MAS/产品介绍类
  单文件 HTML 的页码导航。
---

# HTML 演示导航（大纲进度条）

## 何时用

- 单文件 HTML 演示稿（1280×720 canvas、键盘/滚轮翻页）页数 ≥ 10
- 用户不要一排圆点，要「进度条 / 大纲」感
- 需要可跳章、又不挡内容

## 交互硬约定

| 规则 | 说明 |
|------|------|
| 默认 | 右侧**只显示短线**，无常驻文字侧栏 |
| 悬停 | 移到某一条才展开该条标题（左侧） |
| 大章节 | `nav-sec`：**长标题**；短线略宽 |
| 小节 | `nav-page`：**短标题**；短线略细；一页一条 |
| 状态 | `active` 当前页；`in-section` 所在大章；`done` 已翻过 |
| 点击 | 小节 → 该页；大章 → 该节首页 |

## 实现坑（必避）

1. **禁止**父容器 `overflow-y: auto` 再 `position:absolute` 往左弹标题——会被裁切、悬停无字。  
2. 标题用 **flex 流内展开**（`max-width:0` → 悬停变宽 + `opacity`），或保证 `overflow:visible`。  
3. `z-index` ≥ **100**，避免被 `.deck` 盖住。  
4. 短线加透明热区（`::after` inset），否则难点中。

## 怎么接进稿子

1. 粘贴 [`snippet.md`](./snippet.md) 里的 **CSS** + **HTML 容器** + **JS**。  
2. 把 `navSpec` 改成你这篇的大章/小节；`idx` 与 `.slide` 下标对齐（0-based）。  
3. 保证翻页函数 `go(idx)` 与现有键盘/滚轮共用。

## 参考实现

`E:\文档\star\产品\产品介绍\MAS平台\MAS平台对外介绍_宣传上手版_v1.2.html`  
（类名：`.nav-outline` / `.nav-sec` / `.nav-page`）

## 与文档交付关系

总入口仍是 `doc-delivery-formats`。做 **HTML 演示稿导航**时再加载本 skill。
