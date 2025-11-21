---
title: "Print Tracks Panel 眼睛按钮右对齐调整"
date: 2025-11-22
author: tab-flow-dev
category: ui-layout
---

## 背景

在打印预览视图中，`PrintTracksPanelDom` 左侧的 Track 行包含：轨道名称、简称以及一个“显示/隐藏”用的小眼睛按钮。

之前的实现中，小眼睛按钮紧跟在文本之后，并且整行使用 `justify-content: flex-start`，导致在轨道名称长度不一致时，眼睛按钮在垂直方向上看起来是“歪歪斜斜”的，不在同一列。

用户希望：

- 轨道名称和简称依然贴左对齐；
- 所有 Track 行的小眼睛按钮在右侧形成一条竖直对齐的列，避免视觉上的参差感。

## 修改点

### 1. CSS 对齐方式调整

文件：`src/styles/editor/print.css`

在 Track header 行对应的样式基础上新增了一条规则，使眼睛按钮在 flex 布局中靠右对齐：

```css
.tabflow-print-preview-view .tabflow-print-track-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    margin-left: 0;
    padding-left: 0;
}

.tabflow-print-preview-view .tabflow-print-tracks-meta {
    font-size: 11px;
    opacity: 0.7;
    margin-left: 4px; /* 轨名与简称之间留一点间距 */
}

.tabflow-print-preview-view .tabflow-print-track-toggle {
    margin-left: auto; /* 将眼睛按钮推到行最右侧 */
}
```

关键点：

- 继续保持整行 `justify-content: flex-start`，保证 `[Track Name][Short Name]` 从左侧开始排布；
- 给 `.tabflow-print-track-toggle` 加上 `margin-left: auto`，利用 flex 布局自动把眼睛按钮推到行尾；
- `.tabflow-print-tracks-meta` 增加少量 `margin-left`，避免轨名和简称太过紧贴。

### 2. DOM 结构前置调整（前置工作回顾）

在本次 CSS 调整之前，`PrintTracksPanelDom.refreshTracks()` 已经做过一次 DOM 顺序调整：

- Track header 行中，渲染顺序从原先的 `eye -> label -> meta` 改为 `label -> meta -> eye`；
- 这样可以确保眼睛按钮自然地处在文本右侧，再配合 `margin-left: auto` 完成“文本在左、按钮在右”的布局。

相关文件：`src/player/components/PrintTracksPanel.ts`。

## 效果

- 不同长度的轨名（例如 `Lead Guitar`、`Rhythm Guitar` 等）在左侧依旧对齐；
- 右侧的小眼睛按钮现在在视觉上形成一条垂直的直线列，不再随文本长度变化而左右漂移；
- Staff 行（例如 `Staff 1` 和四个记谱模式按钮）的布局未受影响。

## 备注

- 本次修改只涉及布局与视觉对齐，没有改动任何与 AlphaTab 状态同步或渲染相关的逻辑；
- 若后续需要进一步微调与右边边缘的距离，可以通过在容器或按钮上增加适量 `padding-right` 或设置固定宽度来控制。
