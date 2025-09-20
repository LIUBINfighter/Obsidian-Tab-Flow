# 导出实现对比分析 (Export Implementation Comparison)

更新时间: 2025-09-13

## 1. 问题复述

用户参考的 **Export Image 插件** 在缩放/拖拽预览后导出始终获得完整 DOM（无截断），而我们当前的 **ShareCard 导出** 偶发出现底部截断或只截取首部分的情况。核心疑问：为什么两者行为不同？

## 2. 核心流程对照

| 维度 | Export Image 插件 | ShareCard 当前实现 | 差异点评 |
|------|------------------|--------------------|-----------|
| 预览交互 | `react-zoom-pan-pinch` 在外层包裹，变换只作用在预览层，不直接影响被截图根节点尺寸 (`.export-image-root`) | 手写 pan/zoom 作用在 `.share-card-pan-wrapper`，截图根节点是内部 `.inmarkdown-preview.tabflow-doc-main-content`，其祖先仍受 transform 影响（即使未直接使用 pan/zoom 计算） | 外层 transform 可能影响布局阶段的异步扩展与测量时机（较小但存在）。 |
| 构建待导出节点 | React 组件同步生成：`Target` 克隆 Markdown + 配置，内部尺寸在初次渲染完成后趋于稳定 | AlphaTab 渲染为异步：`scoreLoaded` 后仍追加/调整 SVG；我们只轮询高度 6 次 | AlphaTab 异步特性未被完整等待 (关键差异 #1) |
| 等待策略 | 有内容装载事件 + `ResizeObserver` 持续更新 `rootHeight`; 导出调用时直接读取稳定后的 `clientHeight`；无复杂异步渲染 | 简单 `waitForStableLayout` 420ms 左右；可能早于 AlphaTab 最终高度 | 不充分的稳定判定 (关键差异 #2) |
| 字体/资源 | Markdown 样式字体基本已缓存；未依赖大型 SMuFL 字体 | 依赖 Bravura / Worker / SoundFont，字体加载可能延后造成二次 reflow | 字体就绪未等待 (差异 #3) |
| DOM 限制 CSS | 目标节点 `.export-image-root` 没有 `max-width:100%` 限制内部 SVG 尺寸（其内容以固定宽度配置） | `.alphatex-score svg { max-width:100%; height:auto; }` 可能在 clone 时重新计算，产生与高度测量时不同的布局 | CSS 约束+克隆差异 (差异 #4) |
| 截图尺寸来源 | 直接使用 `el.clientWidth/Height` 传入 `dom-to-image-more`，不自算 transform scale; resolution 通过库内部 `scale` 选项 | 用 `getBoundingClientRect()` 获取 width/height 再乘 resolution，同时传自定义 `style.transform=scale(resolution)` | 双重缩放与 clientHeight/BCR 差异组合可能引发 rounding/截断 (次要) |
| 分片/分页 | 内置多模式 split，高度剪裁逻辑明确 | 暂无分片；一次性导出超长谱 | 超长高度内存/上限风险 (差异 #5) |
| 渲染锁 | 导出时设置 processing 状态，UI 控件禁用，避免并发修改 | 导出期间仍可触发 refresh (width change) | 竞争条件 (次要) |

## 3. 直接导致截断的主因归类

优先级 (高→低)：

1. (差异 #1 + #2) AlphaTab 渐进渲染 / 缺少渲染完成与多帧稳定等待。
2. (差异 #3) Bravura 字体与度量资源加载后的二次布局未等待。
3. (差异 #4) 导出节点含 `max-width:100%` 的 SVG 在克隆/缩放环境下可能被再计算导致高度减小或截断。
4. (差异 #5) 超长谱 (高像素高度) 触发浏览器内部限制或内存失败后库 silent fallback 输出部分画布。
5. 次要：同时使用 `width/height * resolution` + `style.transform(scale(resolution))` 的策略与库自身 scale 机制叠加可能造成误差；导出时仍在进行 pan/zoom 重绘导致中间状态。

## 4. Export Image 插件“稳定”的关键点总结

- 截图根节点结构简单，无持续异步追加节点。
- 依赖的字体资源基本与 Obsidian UI 共用，已加载完成；无需额外等待。
- 计算尺寸采用 `clientHeight`（不受 transform 影响）并与实际渲染节点一一对应。
- 没有外层 `max-width` 动态压缩 SVG 的情况。
- 有 `ResizeObserver` 持续刷新高度，减少“早截”风险。

## 5. 我们当前实现的薄弱点机制分析

| 机制 | 现状 | 风险 | 结果 |
|------|------|------|------|
| 渲染完成判定 | 固定 6 次高度轮询 | AlphaTab 继续 append | 高度不足 -> 底部缺失 |
| 字体就绪 | 未等待 | 字体替换触发 reflow | 导出时机过早 |
| SVG 自适应宽度 | `max-width:100%` + auto height | 克隆环境不含原 flex 宽度约束时可能再布局 | 部分 SVG 折行或缩放，整体高度变短 |
| 超尺寸保护 | 缺失 | Canvas 超限或内存失败 | 库内部 fallback 输出部分图像 |
| 并发渲染 | 导出中可刷新 | 中间帧截取 | 图像缺尾或布局错位 |

## 6. 改进路径分层

### 6.1 快速修补 (MVP)

1. 导出前：`await ensureFontsReady()` + `await waitAlphaTabStable(api, captureEl)`：
   - 等待 `scoreLoaded` / `renderFinished` / 多帧高度稳定 (连续 3 次，高度差 < 0.5px，总时长上限 2.5s)。
2. 添加导出锁：`this.exporting = true`，期间忽略 refresh/width 变化事件。
3. 使用 `clientWidth/clientHeight` 而非 BCR；避免重复缩放，只保留 `dom-to-image-more` 提供的 scale 或我们自定义 transform 二选一（推荐用库的 scale）。
4. 基础尺寸检查：若 `resolution * max(side)` > 16384 或总像素 > 120M，提示降级 resolution。

### 6.2 稳定增强

1. 离屏克隆：
   - 克隆 captureEl 到隐藏容器，移除 `max-width:100%`，对每个 `svg` 若存在 `viewBox` 则补充 `width/height` 数字属性。
   - 应用统一背景与字体 class，避免继承差异。
2. 高度验证：克隆后再次测量克隆节点高度，若与原始差异 > 2px，等待一帧并重测，仍差异则记录日志并用原节点 fallback。
3. 渲染日志：记录等待阶段的高度序列（调试模式下写到 console）。

### 6.3 超长谱与分片 (进阶)

1. 若最终高度 > `LONG_SCORE_THRESHOLD` (例如 12000px * resolution)：自动分片策略：切块高 ~ 4000–6000px，逐段截图再拼接。
2. 拼接：使用离屏 `<canvas>` `drawImage`，生成单一 Blob。

### 6.4 进一步优化

- 将 `AlphaTexBlock` 内部在 `api.render()` 之后发布一个自定义事件 (e.g. `alphatex-render-finished`)；外部监听简化等待逻辑。
- 可选：在 `mountAlphaTexBlock` 中注入 `api.renderFinished?.on()` 监听（若 API 存在）。

## 7. 推荐实施优先级

| 阶段 | 内容 | 目标 | 预期收益 |
|------|------|------|----------|
| P1 | MVP (6.1 全部) | 立即消除大部分早截 | >90% 截断问题消失 |
| P2 | 离屏克隆 + 高度验证 | 排除 CSS 约束差异 | 剩余字体/布局引起的小概率截断消失 |
| P3 | 分片拼接 | 超长乐谱可靠导出 | 支持任意长度 |
| P4 | 自定义事件 & 日志 | 可维护性 | 更快定位后续问题 |

## 8. 直接回答“为什么参考实现能而本实现不能”

> 因为参考实现的被截图内容在截图前已经达到静态、确定的高度（同步构建 + 依赖资源即时可用），并通过 `ResizeObserver` 与用户交互分离的变换层保证截图根节点的尺寸测量不受外层缩放影响；而我们当前的实现面对 **异步渐进渲染 (AlphaTab) + 字体延迟 + CSS 自适应宽度 + 缺少充分等待与尺寸上限保护**，导致在尚未达到最终高度就开始截取或在克隆/缩放过程中重新计算布局，引发截断。简言之：我们缺乏“最终稳定态”的可靠检测与隔离。

## 9. 下一步执行建议 (可直接落地)

- 新增 `ensureFontsReady`, `waitAlphaTabStable`, `withExportLock` 三个辅助。
- 重写 `generateImageBlob` 流水线：等待 → 尺寸/阈值 → (可选)离屏克隆 → 单一缩放方式 → 捕获。
- 添加调试开关：`TABFLOW_DEBUG_EXPORT=1` 时输出高度序列与耗时。
- 后续迭代：超长谱分片 + 自定义事件。

## 10. 辅助函数接口草案

```ts
interface ExportWaitOptions { maxWaitMs?: number; minStableCount?: number; debug?: boolean; }
async function waitAlphaTabStable(api: any, el: HTMLElement, opts: ExportWaitOptions = {}): Promise<void>;
async function ensureFontsReady(fonts: string[] = ['12px Bravura'], timeoutMs=2000): Promise<void>;
function withExportLock<T>(ctx: ShareCardModal, task: () => Promise<T>): Promise<T>;
```

---
(文档可随实施进度更新)
