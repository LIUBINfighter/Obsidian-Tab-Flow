---
title: "Obsidian 插件静态资源加载：一般规律与调试方法论"
date: 2026-09-17
tags:
  - methodology
  - assets
  - fonts
  - worker
  - soundfont
  - obsidian-update
---

## 1. 为什么这类问题会反复出现

Obsidian 是 Electron 应用，插件运行在 renderer 进程（文档 origin 为 `app://obsidian.md`）。
插件目录中的静态资源（字体 / Worker / SoundFont）通过：

```ts
app.vault.adapter.getResourcePath(relativePath)
// → app://<随机36位token>/<绝对路径>?<mtime>
```

暴露给浏览器引擎。**这个 URL 格式不是公开稳定契约**（官方文档只说明「Returns a URI for the browser engine to use, for example to embed an image」，并未承诺 font / worker / CORS / iframe 语义）。历史上 Obsidian 大版本更新多次改动它：

| 变化 | 影响 |
| --- | --- |
| `app://local/...` → `app://<36hex>/...`（每次启动随机 token） | 任何缓存/持久化该 URL 的代码会失效 |
| `protocol.registerFileProtocol` → `protocol.handle` | 响应头行为变化（例如不再带 Content-Type） |
| iframe / 子 frame 中的 `app://` 权限与主文档不一致 | PrintPreview 等 iframe 场景字体加载失败 |
| CSP 调整 | `font-src` / `style-src` 行为可能变化 |

同时 alphaTab 的字体链路很长，任一环节出问题都表现为同一种可见症状——「豆腐块」。

## 2. 加载链路分层模型（自下而上）

排查时**从底层往上逐层验证**，不要跳层猜测：

```
L0 文件层     adapter.exists(相对路径)                 文件真的在插件目录里吗？
L1 URL 层     getResourcePath → app://...             浏览器能读这个 URL 吗？
L2 配置层     alphaTab settings                        smuflFontSources / fontDirectory / scriptFile / soundFont
L3 注册层     @font-face 解析进 document.fonts          format() hint 受支持吗？规则被丢弃了吗？
L4 就绪层     document.fonts.load() / FontLoadingChecker 字体 status 是 loaded 还是 error/不存在？
L5 渲染层     SVG <text class="at"> 的 computed font-family 是否命中字体族
```

各层的典型失败特征：

- L1 失败：`fetch(uri)` 非 200 / `FontFace.load()` 抛 NetworkError。
- L2 失败：`smuflFontSources` 的 **key 不是 `FontFileFormat.Woff2`**（典型错误：`?? 0` → `EmbeddedOpenType`）。
- L3 失败：`@font-face` 的 `format('embedded-opentype')` 等不受 Chromium 支持的 hint → 规则不注册（`document.fonts` 里查无此族）。
- L4 失败：`document.fonts.load('12px alphaTab')` 返回 0 个 face，或 alphaTab 日志 `Loading Failed ... NetworkError`。
- L5 失败：字体已 loaded，但 CSS 未把字体族应用到 `.at` 元素（选择器/样式被主题覆盖）。

## 3. 调试方法论（可直接照做）

### 3.1 在运行中的 Obsidian 内取证，而不是靠猜

插件里放一个诊断命令（本仓库：`tab-flow:debug-font-probe`，源码 `src/debug/fontProbe.ts`），落盘 JSON，然后用 Obsidian CLI 驱动：

```bash
obsidian plugin:reload id=tab-flow
obsidian command id=tab-flow:debug-font-probe
# 读取 .obsidian/plugins/tab-flow/_debug/font-probe-*.json
```

探针应采集：

1. `navigator.userAgent` / `location.origin`（确认运行环境）
2. `plugin.resources`（含 `bravuraUri` 与 `bravuraSource` 策略）
3. `fetch(bravuraUri)` → status / content-type / bytes
4. `new FontFace('x', 'url(...) format("woff2")').load()` → 直接验证 URL 可解码性
5. **format hint 对照矩阵**：同一 URL 分别注入 `format('embedded-opentype')` / `format('woff2')` / 无 hint 的 `@font-face`，记录 `document.fonts` 注册情况与 `fonts.load()` 结果
6. alphaTab 实际注入的 `style#alphaTabStyle*` 原文（看 URL 与 format hint）
7. 渲染探针：用不同 Map key（`0` / `2` / `'woff2'`）分别 `new AlphaTabApi(...).tex(...)`，记录事件序列、`document.fonts` 状态、SVG/文本节点数量

### 3.2 对照实验优于单点观察

豆腐块症状相同但根因不同，务必做**对照**：

- 同一 URL，不同 `format()` hint → 判定是否 hint 问题
- 同一 hint，app:// URL vs data URL vs 二进制 `FontFace` → 判定是否 URL 问题
- 主文档 vs iframe 文档 → 判定是否文档隔离问题
- `FontFileFormat` 数值 key vs 字符串 key → 注意：字符串 key 只有在经 `fillFromJson` 反序列化时才会被 `parseEnum` 归一化；直接给 `settings.core.smuflFontSources` 赋值字符串 key 会得到 `format('undefined')`

### 3.3 已知坑位清单

| 坑 | 现象 | 正确做法 |
| --- | --- | --- |
| `?.Woff2 ?? 0` 静默降级 | `format('embedded-opentype')`，不注册字体 | 用顶层 `alphaTab.FontFileFormat.Woff2`；禁止 `?? 0` |
| `@font-face { src: var(--x) }` | 规则无效（规范不支持） | JS 注入 `<style>` 写死真实 URL |
| 直接赋值字符串 key `'woff2'` | `format('undefined')` | 用数值枚举，或走 `fillFromJson` |
| data URL 追加 `?_ts=...` | 数据被破坏 | cache-busting 必须跳过 data URL |
| iframe 内 `app://` 失败 | 首开豆腐块 | 视图内 cache-busting；必要时 data URL；等待 `fonts.load` |
| `document.fonts.check()` 判存在性 | 未注册的族也返回 true | 用 `fonts.load()` 的返回数量/status 判断 |

## 4. 工程原则（防回归）

1. **单一事实来源**：字体源统一由 `src/utils/fontSource.ts` 产出（`createSmuflFontSources` / `resolveWoff2FontFormat`），禁止各视图手写枚举。
2. **永不静默降级枚举**：读取不到就报错或走显式兜底常量，并留下可观测字段。
3. **运行时验证 + 降级**：`ResourceLoaderService` 启动时验证 `app://` URL，失败自动回退 data URL，并在 `AlphaTabResources.bravuraSource` 中暴露策略。
4. **全局后备字体**：main.ts 注入 `format('woff2')` 的 `@font-face`（family `alphaTab`），即使 alphaTab 自身样式异常也能命中字体族。
5. **保留诊断入口**：`tab-flow:debug-font-probe` 是这类问题的「黑匣子」，修复后可继续保留。
6. **文档化每次根因**：每次修复都在 `docs/dev/` 记录「症状 / 根因 / 实证 / 修复 / 验证」，见 `2026-09-17-obsidian-font-tofu-fix.md`。

## 5. Obsidian 官方文档要点摘录

- `Vault.getResourcePath(file)`：`Returns a URI for the browser engine to use, for example to embed an image.`
- `DataAdapter.getResourcePath(normalizedPath)`：同上（传入 `normalizePath()` 处理过的路径）。
- 开发者政策：默认本地/离线运行；不执行远程代码。因此字体/SoundFont/Worker 由用户在设置面板点击下载到插件目录，再经 `getResourcePath` 提供给浏览器引擎。

> 注意：官方没有承诺 `getResourcePath` 对 `@font-face`、Worker、iframe、CORS 的兼容性。凡依赖这些语义的地方，都应做运行时验证与降级。

## 6. 历史修复时间线（仓库内证据）

| 时间 | 问题 | 方案 | 文档 |
| --- | --- | --- | --- |
| 2025-06 | app:// 在 `@font-face` 中不可靠，音符头缺失 | data URL + 手动 `@font-face` + 虚拟 `fontDirectory` | `docs/archived/mvp/dev/app-url/solution.md` |
| 2025-11-22 | PrintPreview iframe 首开豆腐块 | 打印视图按视图 cache-busting | `docs/dev/2025-11-22-print-preview-font-debug.md` |
| 2026-05-29 | smuflFontSources 配置路径不统一 | `Settings` + `fillFromJson` + 顶层 `FontFileFormat.Woff2`（hephaestus 分支） | `docs/dev/2026-05-29-alphatab-cursor-svg-runtime-errors.md` |
| 2026-09-17 | dev 分支仍存在 `?? 0` → `format('embedded-opentype')` → 豆腐块 | 统一 `fontSource` 工具 + 运行时 URL 验证 + data URL 兜底 + 诊断命令 | `docs/dev/2026-09-17-obsidian-font-tofu-fix.md` |
