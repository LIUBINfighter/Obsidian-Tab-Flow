---
title: Print Preview 分页探索小结
date: 2025-11-22
category: dev-log
---

## 背景

Print Preview 需要在 Obsidian 中提供一个干净的打印视图，并尽量让页面布局与导出的 PDF 一致。AlphaTab 使用 `LayoutMode.Page` 和内部的 `systemsLayout` 机制来安排系统/小节，但并没有直接按照物理 A4 纸张高度进行分页。

## 尝试过的方案

1. **DOM 级拆分分页**
   - 思路：在 AlphaTab 渲染完成后，将 `alphaRoot.children` 按高度分组，包裹到多个 `.tabflow-print-page` 容器中，每页一个。
   - 结果：AlphaTab 内部大量使用绝对定位/transform，搬动这些容器会破坏原有坐标系，导致被“挪到下一页”的小节与原位置发生重叠。

2. **视窗裁切分页**
   - 思路：保留一份完整的 AlphaTab DOM，创建多个固定高度的视窗，每个视窗克隆一份 AlphaTab 内容，并用 `translateY` 裁切不同的纵向区间。
   - 结果：避免了坐标系被破坏，但本质还是对同一逻辑内容的多次“截屏”。当 AlphaTab 认为某些小节属于第 1 页时，它们在第 2 页视窗中会以重复/覆盖的方式出现，无法做到严格“顺位挤下去”。

3. **只信任 AlphaTab Page 布局**
   - 思路：移除浏览器端的所有二次分页逻辑，让 Print Preview 只负责：
     - 提供独立 iframe 环境；
     - 配置打印优化参数（字体、`scale`、`stretchForce`、禁用懒加载等）；
     - 将 AlphaTab 的 `LayoutMode.Page` 结果原样呈现。
   - 结果：预览与 AlphaTab 自身的 Page 逻辑保持一致，但与浏览器物理分页之间仍存在一定偏差，尤其在长谱子后几页会出现“渐渐漂移”。这一点属于 AlphaTab Page 设计与浏览器打印模型之间的天然差异。

## 结论

- 在不深入修改 AlphaTab 内部数据模型（例如 `score.systemsLayout`、`defaultSystemsLayout`、`displayScale` 等）的前提下，**DOM 层的后处理分页很难同时满足：不破坏布局 + 不重复/裁断内容 + 严格对齐 PDF 页数**。
- 当前插件版本选择：
  - 不在 DOM 层做分页，只展示 AlphaTab 的 Page 布局结果；
  - 通过打印设置（`scale`、`stretchForce` 等）提供一定的“布局松紧度”可调节空间；
  - 将更精细的分页控制留给未来如果需要时，通过 `scoreLoaded` 事件和 `systemsLayout` 等属性在 AlphaTab 数据层面实现。

## 后续可能方向

- 在 `scoreLoaded` 中读取并调整 `score.systemsLayout` / `defaultSystemsLayout`，按小节数或系统高度自定义每页行数。
- 为打印添加更丰富的设置项（例如：目标每页行数、是否启用 `model` 布局模式等），前提是充分验证与 AlphaTab 行为的兼容性。
