---
title: "Print Preview 无限重排：iframe 滚动条与 alphaTab 重排的反馈环"
date: 2026-09-19
tags:
  - bugfix
  - print-preview
  - layout
  - alphatab
---

# 现象

Print Preview 视图出现样式闪烁：A4 页面右缘左右跳动，伴随持续重排与卡顿。

# 根因

一个自持的反馈环：

1. `setupAutoResize` 的 MutationObserver 以 `{ childList, subtree, attributes: true }` 监听 iframe body，alphaTab 渲染时每次写 SVG 属性/内联样式都会触发回调；
2. 回调调用 `adjustIframeHeight()`，读取 `body.scrollHeight` 并写回 `iframe.style.height`；
3. srcdoc 中 `html, body { overflow: visible }`，而根元素上的 `visible` 按规范会被当作 `auto`，因此 iframe 视口在内容比设定高度多出哪怕 1px 时就会显示自己的竖向滚动条；
4. 滚动条出现/消失使 iframe 内部可用宽度变化约一个滚动条宽度（Windows Chromium ~15px），而 alphaTab 容器是 `width: 100%`，其 `HtmlElementContainer._resizeObserver`（ResizeObserver）随即触发整谱 Page 布局重排；
5. 重排后内容高度变化 → 回到第 2 步 → 无限振荡。亚像素取整使高度恰好卡在滚动条阈值上，振荡可以自持。

# 修复

`src/views/PrintPreviewView.ts`：

1. srcdoc 屏幕样式改为 `html, body { overflow: hidden; }`（`@media print` 内保留 `overflow: visible`），iframe 不再出现自身滚动条，内部宽度恒定；
2. `adjustIframeHeight()` 高度取 `Math.ceil(max(body.scrollHeight, documentElement.scrollHeight))` 并加幂等保护（高度未变化直接返回）；
3. 新增 `scheduleIframeHeightAdjust()`，用 `requestAnimationFrame` 合并同一帧内的多次请求；`onClose` 取消待执行帧；
4. MutationObserver 去掉 `attributes: true`，只监听结构变化（渲染完成另有 `renderFinished` 事件兜底）。

# 验证

- 打开 Print Preview：页面右缘稳定，无闪烁；
- 切换轨道/谱表、折叠侧栏、缩放窗口后高度正常跟随；
- 打印对话框预览正常（`@media print` 仍为 `overflow: visible`）。
