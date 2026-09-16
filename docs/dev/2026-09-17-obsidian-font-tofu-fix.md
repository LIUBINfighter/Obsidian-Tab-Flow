---
title: "音符字体豆腐块修复：FontFileFormat 静默降级 + 资源 URL 运行时验证"
date: 2026-09-17
tags:
  - debug
  - alphatab
  - fonts
  - obsidian-update
  - asset-loading
---

## 症状

Obsidian 中渲染 alphaTex 乐谱时，谱线、数字、标题正常，但**所有音乐符号（音符头、符干、谱号等）显示为方块/叉号（豆腐块）**。截图见 issue #173（`[Bug] Update of Obsidian break the process of loading fonts`）。

受影响视图：文档面板（DocView / AlphaTexPlayground）、Markdown `alphatex` 代码块（两者都走 `mountAlphaTexBlock`）。

## 根因（本次定位）

`src/markdown/AlphaTexBlock.ts` 与 `src/services/AlphaTabService.ts` 中通过内部路径读取枚举：

```ts
(alphaTab as { rendering?: { glyphs?: { FontFileFormat?: { Woff2?: number } } } })
	.rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0
```

alphaTab 1.8.3 中 `alphaTab.rendering.glyphs` **不再导出 `FontFileFormat`**（顶层 `alphaTab.FontFileFormat` 才是正确位置），于是表达式恒为 `undefined ?? 0`。

`0` 不是「无字体」，而是 `FontFileFormat.EmbeddedOpenType`。alphaTab 据此生成的 `@font-face` 为：

```css
@font-face {
  font-family: 'alphaTab';
  src: url("app://.../Bravura.woff2?<mtime>") format('embedded-opentype');
}
```

Chromium 不支持 `embedded-opentype`，会跳过该 source 并且**不注册 FontFace**，导致 `document.fonts` 中不存在 `alphaTab` 族，`FontLoadingChecker` 永远等不到字体 → 豆腐块。

关键点：`?? 0` 的静默降级把一个「读取失败」伪装成了一个合法的枚举值，所以不报错、只画豆腐。

## 实证（在真实 Obsidian 1.13.7 / Electron 32 中探针采样）

诊断命令 `tab-flow:debug-font-probe`（`src/debug/fontProbe.ts`）在运行中的 Obsidian 里采样：

修复前：

| 检查项 | 结果 |
| --- | --- |
| `fetch(bravuraUri)` | 200，189444 bytes，`application/octet-stream` |
| `new FontFace(..., url(...) format('woff2')).load()` | `loaded` |
| alphaTab 注入的 `@font-face` | `format('embedded-opentype')` |
| `document.fonts` 中的 `alphaTab` 族 | **不存在** |
| `document.fonts.load('12px alphaTab')` | **0 个 face** |
| 注入 `format('embedded-opentype')` 的测试 @font-face | `registered: []`，load 0 个 |
| 注入 `format('woff2')` 的测试 @font-face | registered，load 1 个 `loaded` |

修复后（同一环境）：

| 检查项 | 结果 |
| --- | --- |
| `resources.bravuraSource` | `app-url`（运行时验证通过） |
| 全局后备 `@font-face`（main.ts 注入） | `format('woff2')` |
| `document.fonts` 中的 `alphaTab` 族 | 存在（unloaded → 渲染时 loaded） |
| `document.fonts.load('12px alphaTab')` | **1 个 face，status=loaded** |

结论：`app://` URL 本身在 1.13.7 下是可用且可验证的；本次豆腐块与 Obsidian 版本无关，而是 alphaTab 枚举路径变更后被 `?? 0` 静默吞掉。

## 修复内容

### 1. 统一字体源工具 `src/utils/fontSource.ts`（新增）

- `resolveWoff2FontFormat()`：顶层 `FontFileFormat.Woff2` → 旧内部路径 → 最后兜底 `2`，绝不返回 0。
- `createSmuflFontSources(uri)`：所有视图统一用它构造 `Map<FontFileFormat, string>`。
- `verifyFontUri(uri, timeout)`：用 `FontFace.load()` 在运行时验证字体 URL 是否真的可解码（带超时）。
- `injectGlobalAlphaTabFontFace(uri)` / `removeGlobalAlphaTabFontFace()`：全局后备 `@font-face`（`format('woff2')`），供 alphaTab 自身的 `FontLoadingChecker` 命中。

### 2. 资源加载加运行时验证与降级 `src/services/ResourceLoaderService.ts`

- 启动时对 `getResourcePath()` 得到的 `app://` URL 做 `FontFace` 验证；
- 失败则通过 `vault.adapter.readBinary()` 读取字体并转成 data URL 再验证；
- 结果记录在 `AlphaTabResources.bravuraSource`（`app-url` | `data-url` | `unresolved`），可观测、可诊断。

### 3. 清理错误写法

- `AlphaTexBlock.ts`、`AlphaTabService.ts`（两处）、`PlayerController.ts`：全部改用 `createSmuflFontSources`。
- `main.ts`：删除无效的 `--tabflow-bravura-font-src` CSS 变量方案（CSS 变量不能用于 `@font-face` 的 `src`），改为 JS 注入 `<style>`；`onunload` 对应清理。
- `src/styles/fonts.css`：移除无法生效的 `@font-face { src: var(...) }`。
- `ReactView.ts`：移除重复的全局字体注入（统一由 main.ts 注入）。
- `PrintPreviewView.ts`：cache-busting 时间戳跳过 data URL（追加 query 会破坏 data URL 数据）。

### 4. 保留诊断命令

`tab-flow:debug-font-probe`：在 Obsidian 内落盘 `_debug/font-probe-*.json`，包含 fetch/FontFace/formatHints/document.fonts/渲染探针（key=0/2/'woff2' 三种对照）结果。CLI 可触发：`obsidian command id=tab-flow:debug-font-probe`。

## 验证

- `npm run build`（含 `tsc -noEmit`）通过。
- 在真实 Obsidian（1.13.7 app 包 + Electron 32.2.5）中通过 CLI 重载插件并执行探针，修复前/后结果见上表。
- 修复后 `document.fonts.load('12px alphaTab')` 返回 loaded face；渲染探针 key=2 的 `@font-face` 为 `format('woff2')`。

## 经验

1. **永远不要对枚举查找做 `?? 0` 降级**：0 通常是合法枚举值，静默降级会把 bug 藏到渲染层。
2. **同一症状（豆腐块）有多个根因**：URL 失效、format hint 错误、iframe 文档隔离、时序竞态。按 `docs/dev/obsidian-asset-loading-methodology.md` 的分层模型逐层排除。
3. **URL 能力要运行时验证**：Obsidian 的 `app://` 行为不在公开契约内，先验证再使用，失败自动降级 data URL。
