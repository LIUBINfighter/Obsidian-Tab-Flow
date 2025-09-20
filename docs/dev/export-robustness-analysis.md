# 导出截断与健壮性分析 (Export Robustness Analysis)

更新时间: 2025-09-13

## 1. 问题描述

在 `ShareCardModal` 预览区中，用户可以对乐谱进行 **拖动 (pan)** 与 **缩放 (zoom)**。当前导出逻辑（`generateImageBlob`）尝试直接捕获 `.inmarkdown-preview.tabflow-doc-main-content` 以获得完整谱面，并忽略 pan/zoom 的 transform。

仍然出现两类反馈：

1. **截断**：输出图片底部或后续“页面”缺失。表现为预览中实际渲染比导出结果更长。
2. **捕获区域不完整/不稳定**：偶发只导出首屏或高度不足。

截图示例（Score.png）显示：顶部 chord diagrams 存在，后续多行内容在图片中被提前截断。

## 2. 现有实现关键点回顾

- 预览区结构：

```text
.share-card-preview (overflow:hidden, 有平移缩放场景)
  .share-card-pan-wrapper (应用 translate + scale)
    .share-card-root (固定宽度, padding)
      .alphatex-playground
        .inmarkdown-preview.tabflow-doc-main-content
          .alphatex-block
            .alphatex-score (内部逐步插入 SVG)
```

- 导出节点：`getCaptureElement()` 返回 `.inmarkdown-preview.tabflow-doc-main-content`。
- 等待布局稳定：`waitForStableLayout()` 仅轮询 **高度** 若连续两次相同（阈值 < 1）即判定稳定。
- 使用 `dom-to-image-more.toBlob(captureEl, { width, height, style: { transform: scale(resolution) } })` 直接抓 DOM。
- Pan/Zoom transform 未被作用到最终 scale（忽略是正确意图）。

## 3. 潜在截断根因列表 (Hypotheses)

| # | 可能根因 | 说明 | 证据/风险点 | 影响概率 | 影响程度 |
|---|----------|------|-------------|----------|----------|
| H1 | AlphaTab 渐进渲染/异步排版未完成 | scoreLoaded 之后仍可能继续追加或调整 SVG 高度 | 仅用高度稳定轮询，未监听 render 完成事件 | 高 | 高 |
| H2 | WebFont (Bravura) 或度量字体延迟 | 字体加载后 glyph 重排导致高度变化，但在轮询窗口外发生 | 轮询次数固定 6 * 70ms ≈ 420ms，字体可能 > 500ms | 中 | 中 |
| H3 | `dom-to-image-more` 对包含内部 `<svg>` 的容器截取时遇到 `max-width: 100%` 约束 | `alphatex-score svg { max-width:100%; height:auto; }` 可能在克隆节点中产生不同布局 | CSS 来自 `doc.css` | 中 | 中 |
| H4 | 容器在渲染期使用 `overflow` 限制导致 clone 计算高度不完整 | 捕获节点祖先不含 overflow:hidden (该属性在更外层 share-card-preview)；clone 时若计算依赖 scrollHeight 而非布局树可能受影响 | 需验证库实现 | 低 | 中 |
| H5 | 目标元素使用 margin/padding 影响 height 测量 vs. 实际内容 | `getBoundingClientRect()` 返回视觉盒，不含溢出内容 | 内容若延伸产生滚动但未增高（可能性低） | 低 | 低 |
| H6 | 超大尺寸导致 Canvas 或内存限制而被截断 | 大谱高度 * 分辨率 可能 > 16K 像素，浏览器限制 | 尚未检测 size 上限 | 中 | 高 |
| H7 | Pan/Zoom 期间用户触发再次渲染，导出时处于“中间帧” | 没有锁定渲染；导出与新 `api.render()` 重叠 | 可能在调节宽度或 scale 时 | 低 | 中 |
| H8 | AlphaTab 多页 (Page Layout) 与 Horizontal 混合模式差异 | layoutMode 不一致时内部渲染方式不同 | 当前默认 Continuous 模式；需确认 | 低 | 中 |
| H9 | `dom-to-image-more` clone 时丢失外链资源或 deferred 节点 | 资源加载抖动造成实际高度 < 目标 | 字体/图片 | 中 | 中 |
| H10 | `scoreEl` 内部绝对定位或虚拟滚动 | 若 AlphaTab 采用分段/懒加载 | 代码未见，但可能 | 低 | 高 |

## 4. 核心根因优先级评估

综合概率与影响，首要攻克：H1, H2, H6, H3, H9。

## 5. 针对根因的解决路径

### 5.1 监听渲染完成 (解决 H1)

AlphaTab 常见事件：`scoreLoaded`，还可尝试 `renderFinished` (若存在) 或在 `api.render()` 后使用 `requestAnimationFrame` 多次确认。

方案：

1. 如果存在 `(api as any).renderFinished?.on(cb)` → 直接 await 该事件。
2. 若不存在：在 `scoreLoaded` 后再进行 2–3 帧 (rAF) + 轮询高度（直到连续 2 次静止且间隔 > 120ms）。
3. 为保险：添加最大等待超时（默认 2s，可配置）。

### 5.2 字体与资源完整性保证 (解决 H2/H9)

1. 检测 `document.fonts` (Font Loading API) 存在时：
   - `await document.fonts.ready;`
   - 指定 "Bravura"：`document.fonts.load('12px Bravura')` 并确认 `check()`。
2. 资源缺失 fallback：若字体尚未 ready 超过 1.5s，提示用户“字体仍在加载，等待以确保导出完整”并展示延迟按钮。
3. 对外链图片（如果 AlphaTex 内嵌资源）可选：遍历 `img`，确保 `complete && naturalWidth > 0`。

### 5.3 大尺寸安全护栏 (解决 H6)

1. 预估导出像素：`totalPixels = width * height * resolution^2`。
2. 设置阈值（例如：单边 <= 16384 且 totalPixels <= 10000 * 10000 ≈ 100M 像素，或基于浏览器经验值）。
3. 超限策略：
   - 降低 resolution (提示用户)
   - 分段拼接（进阶方案）
   - 强退导出：提示“谱面过长，请分段导出或降低分辨率”。

### 5.4 CSS 影响隔离 (解决 H3)

1. 离屏克隆：深度 clone captureEl 到一个临时 `div`：
   - `position:fixed; left:-99999px; top:0;` 或 `visibility:hidden;`，移除会影响布局的 `max-width:100%` 限制（覆盖 style）。
   - 将所有 `svg[width][height]` 设置为固有大小；移除 `max-width` 限制。
2. 然后对克隆节点调用 `dom-to-image-more`，避免受预览区 CSS 继承。
3. 结束后移除临时节点。

### 5.5 额外稳定机制 (与 5.1 叠加)

- 高度稳定判定从“连续两次”升级为：
  - 连续 `N` 次 (N >= 2) 高度差 < 0.5px；并且最后一次与第一次间隔 >= 300ms。
- 记录高度增长方向，如持续增长则继续等待（防止还在 append）。

### 5.6 分片拼接 (扩展，解决超长谱 H6)

1. 当高度 > `MAX_SAFE_HEIGHT` (例如 12000px * resolution) 时：
   - 克隆节点 → 修改 `style.transform` 进行分段偏移或使用 `clip-path`，多次截图。
   - 使用 Canvas 逐段 `drawImage` 合并。
2. 输出单一 Blob；内存压力管理：每段导出后释放 URL。

### 5.7 渲染锁 (避免 H7)

- 导出期间禁用 UI 与新的渲染：设置 `this.isExporting = true`，在 `playgroundHandle.refresh()` / resize 回调中如果 `isExporting` 就延迟。

### 5.8 统一导出流水线 (组合)

顺序建议：

1. `lockExport()` 标志 & 禁用按钮
2. `await ensureFontsReady()`
3. `await waitAlphaTabStable(api)`（事件 + 高度 + rAF）
4. `const { node, width, height } = prepareClone(captureEl, resolution)`（离屏克隆 + 清除限制 CSS）
5. `enforceSizeGuard(width,height,resolution)`
6. `blob = await domtoimage.toBlob(clone, options)`
7. 清理克隆 & 解锁

## 6. 方案矩阵对比

| 方案 | 解决根因 | 复杂度 | 性能影响 | 风险 | 推荐等级 |
|------|----------|--------|----------|------|----------|
| A: 仅改进高度轮询 (N+间隔) | H1 部分 | 低 | 低 | 仍可能错过字体延迟 | 中 |
| B: 事件 + 字体 + 轮询三合一 | H1 H2 | 中 | 低 | 需探测事件存在性 | 高 |
| C: 离屏克隆 + B | H1 H2 H3 | 中偏高 | 中 | 代码增加 | 高 |
| D: 分片拼接 + C | H1 H2 H3 H6 | 高 | 中-高 | 内存复杂度/测试成本 | 中 |
| E: 添加尺寸上限降级 (配合 B/C) | H6 | 低 | 低 | 用户体验需提示 | 高 |

推荐主路径：**B + C + E**。D 作为下一阶段扩展。

## 7. 拟添加的核心辅助函数 (草图)

```ts
async function ensureFontsReady(timeoutMs = 2000) {
  if (!(document as any).fonts) return; // 不支持跳过
  try { await (document as any).fonts.ready; } catch {}
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if ((document as any).fonts.check('12px Bravura')) break;
    await new Promise(r => setTimeout(r, 80));
  }
}

async function waitAlphaTabStable(api: any, el: HTMLElement, maxMs = 2500) {
  // 1) 等待 scoreLoaded 或 renderFinished
  await waitScoreLoaded(api, maxMs * 0.4);
  // 2) 高度多帧稳定
  let last = -1; let stableCount = 0; const start = performance.now();
  while (performance.now() - start < maxMs) {
    const h = el.getBoundingClientRect().height;
    if (Math.abs(h - last) < 0.5) stableCount++; else stableCount = 0;
    last = h;
    if (stableCount >= 3) break; // 连续 3 次稳定
    await new Promise(r => requestAnimationFrame(() => r(null)));
  }
}
```

## 8. 立即可实施的最小增量 (MVP Patch 计划)

1. 在 `ShareCardModal` 中增加 `ensureFontsReady` 与 `waitAlphaTabStable` 调用；调用 `this.playgroundHandle?.getApi()` 获取 API。
2. 扩展 `generateImageBlob`：
   - 调用上述等待
   - 加入像素上限检测
   - 离屏克隆 captureEl（浅复制 style）
3. 失败时回退至原逻辑并给出 Notice：“回退到快速导出（可能不完整）”。

## 9. 后续扩展

- 分片拼接超长谱
- 导出过程进度 UI
- 复制时自动降级分辨率 (内存保护)
- 自动保存调试日志 (高度序列、等待时间)

## 10. 下一步建议

执行 MVP Patch (B + C + E 的子集) 验证是否彻底消除截断；若仍存在极端长谱问题，推进分片。

---

本文档可随问题演化更新，后续实现与测试完成后附加性能与兼容性基准。
