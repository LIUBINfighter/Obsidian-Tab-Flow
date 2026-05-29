---
title: "alphaTab 播放光标、SVG 错位与 Worker 运行时错误修复"
date: 2026-05-29
tags:
  - debug
  - alphatab
  - player
  - worker
  - cursor
  - svg
  - runtime
---

## 背景

React Player 中同时出现了几类问题：

- 播放器光标不可见或不跟随乐谱显示；
- SVG 曲谱渲染错位，六线谱线条与数字对不上；
- alphaTab Worker/播放器运行时报错，包括 `e.get is not a function`、`currentTime` 读取失败、`modifiedTempo` 读取失败。

该问题发生在 Obsidian 插件环境中，不能用普通浏览器页面作为最终验证面。有效验证面应是 Obsidian 内加载插件后的播放器视图。

## 根因

### 1. 光标定位被插件 CSS 改写

`.at-cursor-bar`、`.at-cursor-beat`、`.at-selection div` 被额外设置了 `position: relative`。这些元素由 alphaTab 自己按坐标定位，插件 CSS 修改定位上下文后会影响光标覆盖层位置与可见性。

### 2. 主题或通用 SVG 样式影响 alphaTab 几何

Obsidian 主题和插件常对通用 `svg` 元素设置 `width`、`max-width`、`height` 等规则。alphaTab 输出的曲谱 SVG 需要保留自身几何尺寸；被外层样式压缩或拉伸后，谱线与数字会出现相对错位。

### 3. alphaTab 主包与 Worker 资产版本不一致

本地 `assets/alphaTab.min.js` 与 `node_modules/@coderline/alphatab/dist/alphaTab.min.js` 哈希不一致。主线程 bundle 与 Worker 脚本版本不同，会导致 Worker 消息、设置反序列化和播放器事件对象不匹配。

### 4. `smuflFontSources` 配置路径不统一

alphaTab 运行时要求 `settings.core.smuflFontSources` 是 `Map<FontFileFormat, string>`。虽然 alphaTab 的 JSON 反序列化可处理部分 Map/对象结构，但为了降低 Worker 初始化时的序列化风险，插件内统一改为：

1. 先创建 `new alphaTab.Settings()`；
2. 用 `fillFromJson(...)` 填入不含 `smuflFontSources` 的普通配置；
3. 再直接设置 `settings.core.smuflFontSources = new Map([[alphaTab.FontFileFormat.Woff2, bravuraUri]])`。

### 5. 播放位置事件缺少空值保护

Worker 初始化或播放器状态异常时，`playerPositionChanged` 可能传播空事件对象。旧代码直接访问 `event.currentTime`，会放大上游错误并导致 UI 控制器继续崩溃。

## 修复内容

### CSS 与渲染

- 从 `src/styles/new-react-player/player-cursor.css` 移除 alphaTab 光标元素上的 `position: relative`。
- 在 `src/styles/new-react-player/tablature-view.css` 中限定 `.tablature-view .alphatab-main svg`，让 alphaTab SVG 使用自身尺寸：`display: block`、`max-width: none`、`max-height: none`、`width: auto`、`height: auto`、`overflow: visible`。

### Worker 与资源

- 将 `assets/alphaTab.min.js` 同步为 `node_modules/@coderline/alphatab/dist/alphaTab.min.js` 当前版本内容。
- 将缺失资源下载地址从旧 GitHub release 固定资产改为 `@coderline/alphatab@1.8.3` 的 jsDelivr dist 路径，避免后续重新下载回旧 Worker。

### 设置构造

- `src/player/PlayerController.ts`：`smuflFontSources` 改为在 `fillFromJson` 后直接挂到 `settings.core`。
- `src/services/AlphaTabService.ts`：提取 `createAlphaTabSettings(...)`，构造函数与 `reconstructApi()` 复用同一套 Settings 构造逻辑。
- `src/markdown/AlphaTexBlock.ts`：改为先构造 `Settings`，再设置 Bravura WOFF2 字体源。

### 运行时保护

- `src/player/PlayerController.ts`、`src/services/AlphaTabService.ts`、`src/views/TabView.ts` 的 `playerPositionChanged` 监听器增加空事件保护。

### QA 收尾加固

- `src/services/AlphaTabService.ts` 记录并在 `destroy()` 时注销 EventBus 订阅，避免旧服务销毁后继续响应命令。
- `src/views/TabView.ts` 保存旧 PlayBar 的 `playerPositionChanged` disposer，重复挂载 PlayBar 或关闭视图时先释放旧监听。
- `src/player/PlayerController.ts` 初始化时应用全局 `playbackSpeed` 与 `staveProfile`，避免设置面板值被静默忽略。
- `src/markdown/AlphaTexBlock.ts` 只在确实禁用懒加载时传入 `enableLazyLoading: false`，避免向 `fillFromJson` 传递显式 `undefined`。

## 验证

已完成：

- `npm run build` 通过，包含 `tsc -noEmit -skipLibCheck` 与 esbuild 生产构建。
- 变更 TypeScript 文件的 LSP diagnostics 通过。
- 使用 Node driver 验证 `Settings -> fillFromJson -> settings.core.smuflFontSources = Map` 模式可正常读取 `FontFileFormat.Woff2`。
- 对比 `assets/alphaTab.min.js` 与 `node_modules/@coderline/alphatab/dist/alphaTab.min.js`，SHA256 一致。
- 质量检查代理复核后补齐了旧服务/旧视图的监听释放逻辑，并再次完成构建验证。

未完成：

- 当前环境找不到 Obsidian 可执行命令，无法在本机直接打开 Obsidian 做插件级人工回归。
- 该插件不能用普通浏览器页面代替最终验收。最终表面验证仍应在 Obsidian 中重载插件并打开同一曲谱确认：光标可见、谱线与数字对齐、控制台不再出现上述 alphaTab Worker/位置事件错误。

## 后续注意

- 如果以后升级 `@coderline/alphatab`，必须同时同步根目录 `assets/alphaTab.min.js`，否则主线程代码与 Worker 脚本会再次漂移。
- 新增 alphaTab API 入口时，优先复用“先 `Settings.fillFromJson`，再设置 `settings.core.smuflFontSources`”的模式。
- `styles.css` 是构建生成产物；如果工作区存在其他样式源码改动，重新构建会把这些改动一起合入 `styles.css`。
