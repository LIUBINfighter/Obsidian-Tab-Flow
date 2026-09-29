# alphaTab 无头（Node.js/服务器端）渲染 SOP

> 来源：goldline 数据集项目（单行六线谱图像合成）实测，2026-09-29。完整案例存档于 goldline `docs/headless-rendering.md`。

## 结论

服务器端把 alphaTab 渲染成位图（PNG）时，**唯一正确的路径是官方 alphaSkia 方案**（`engine='skia'`）。不要用「SVG 引擎 + 外部栅格器（resvg/sharp/ImageMagick）」，也不要手搓 headless Chromium + 裸 ScoreRenderer——两者都会在字体上翻车。

## 两个已源码级确认的坑

1. **Node 下 SVG 引擎的文本布局用假字体度量**：`FontSizes.generateFontLookup`（`platform/svg/FontSizes.ts`）在浏览器里用 canvas `measureText` 逐字符实测，在 Node.js 退化为常量表（每字符宽 8px、高 10px @11px），比真实字体宽约 30%。品位数字居中、beat 间距等全部因此偏移。
2. **SVG 输出的音乐字体依赖注入 CSS**：谱号/拍号/休止符等 SMuFL 字形是无内联字体属性的 `<text>`（`<g class="at">` 包裹），字体与字号（musicFontSize，默认 36px 量级）由浏览器端 `BrowserUiFacade` 注入的 `@font-face` + `.at` CSS 提供。脱离浏览器后这份 CSS 不存在，外部栅格器按默认字体/16px 绘制——符号尺寸整体失真。手搓 Chromium 路径若不走完整 AlphaTabApi（它才注入 CSS），PUA 码点直接不可见。

## 正确做法（生产验证）

参考实现：`strip-render` 项目 `scripts/render_with_alphatab.js`（alphatab 1.8.1 + alphaskia 3.5.147）。

```js
const alphaTab = require('@coderline/alphatab');
const alphaSkia = require('@coderline/alphaskia'); // 另装 @coderline/alphaskia-linux

// 1. SMuFL 字体：Bravura 随 @coderline/alphatab 包分发
const bravura = fs.readFileSync(require.resolve('@coderline/alphatab/font/Bravura.otf'));
alphaTab.Environment.enableAlphaSkia(
  bravura.buffer.slice(bravura.byteOffset, bravura.byteOffset + bravura.byteLength),
  alphaSkia);
// 2. 文本字体用系统字体（无 Arial 的 Linux 建议装 fonts-liberation，与 Arial 度量兼容）
alphaSkia.AlphaSkiaCanvas.switchToOperatingSystemFonts();

// 3. skia 引擎、关 worker、同步渲染
settings.core.engine = 'skia';
settings.core.useWorkers = false;
```

partial 合成总图：`partialLayoutFinished` 收集 id → `renderFinished` 时 `canvas.beginRender(totalWidth, totalHeight)` 填白底并逐个 `renderer.renderResult(id)` → `partialRenderFinished` 里 `canvas.drawImage(result.renderResult, ...)` 并 `Symbol.dispose()` → `endRender().toPng()`。

## 验收 checklist

- 同一输入渲染两次，PNG 逐字节一致（确定性）。
- 与已知正确渲染并排目检：TAB 谱号、拍号大小、品位数字与线间距的比例、力度记号字形。
- 单行/单系统判定用 `renderer.boundsLookup.staffSystems`，不要用图像高度猜测。

## 什么时候才需要 Chromium

只有当目标域就是「用户在浏览器里的真实截图」本身（需要浏览器排版引擎的像素细节、CSS 主题、页面上下文）时，才用完整 `AlphaTabApi` + headless Chromium，并且必须等 `document.fonts.ready` 再截图。数据集合成、批量导出等场景一律 alphaSkia。
