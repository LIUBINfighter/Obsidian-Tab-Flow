---
title: "PrintPreview 首开字体加载 Debug 纪录"
date: 2025-11-22
tags:
  - debug
  - print-preview
  - alphatab
  - fonts
---

## 背景

为 TabFlow 新增 `PrintPreviewView`，通过 iframe 提供一个干净的打印预览环境，用 AlphaTab 渲染 SVG 乐谱。

实现后遇到一个稳定重现的问题：

- 主播放器视图（ReactView）乐谱显示正常；
- PrintPreview 首次打开时，乐谱符号经常显示为方块（“豆腐块”）；
- 关闭后再次打开同一文件的 PrintPreview，乐谱又能正常显示。

## 现象与线索

### 1. 网络请求行为

在 DevTools Network 面板观察 Bravura 字体（`Bravura.woff2`）：

- 有时会出现一条大小约 `189 kB` 的请求记录，说明浏览器真正从磁盘读取并 decode 了字体；
- 更多时候显示为“内存缓存”或根本不出现新请求，但此时 PrintPreview 首开往往会出现符号变方块的情况；
- 第二次打开 PrintPreview 时，即使没有新的 189 kB 请求，乐谱通常可以正常显示。

结论：**问题不在于“字体文件不存在”，而在于“AlphaTab 首次在 iframe 内渲染时，是否已经有一套可用的字体管线可以用”。**

### 2. 多种加载路径尝试

调试过程中试过几种路径：

1. **iframe 内手写 `@font-face` + `app://` URL**
   - 通过 `this.plugin.resources.bravuraUri` 生成 CSS：
     ```css
     @font-face {
       font-family: 'Bravura';
       src: url(app://.../Bravura.woff2) format('woff2');
     }
     ```
   - 在某些环境下会看到 `net::ERR_FILE_NOT_FOUND`，推测 Electron/Obsidian 在子 frame 里的 `app://` 权限与主文档不完全一致。

2. **Base64 data URL 注入**
   - 直接从 `assets/Bravura.woff2` 读取二进制，转 base64，写入 iframe 的 `<style>`：
     ```css
     @font-face {
       font-family: 'Bravura';
       src: url(data:font/woff2;base64,...) format('woff2');
     }
     ```
   - 这样虽然可以绕开 `app://`，但 Network 面板就看不到 189 kB 的条目了，只能看到“内存缓存”或毫无记录。
   - 更关键的是：**这仍然无法保证 AlphaTab 首次渲染时，浏览器已经把这段 `@font-face` 完整解析并注册到 `document.fonts` 里。**

3. **完全依赖 AlphaTab 自己的 `smuflFontSources`**
   - 在 `createPrintSettings` 中：
     ```ts
     settings.core.smuflFontSources = new Map([
       [alphaTab.FontFileFormat.Woff2, resources.bravuraUri],
     ]);
     ```
   - 这条路径在 React 主视图是稳定工作过的，但在 iframe 中仍然会受到缓存与时序影响：
     - 当浏览器认为字体已经在“内存缓存”中时，AlphaTab 这一次的 fetch 生命周期与 iframe 的可见状态并不总是对齐；
     - 导致首帧 layout 时未能正确关联到字形，即出现“豆腐块”。

### 3. 问题本质分析

综合以上现象：

- 只要某一次确实发生了“189 kB 下载行为”，这次之后的渲染通常是正常的；
- 当 Network 面板只显示“内存缓存”而没有新的下载时，首开 PrintPreview 更容易出现符号方块；
- 第二次打开时因为缓存已经命中，多数情况下又可以正常显示。

由此推断：

> **问题本质不是“字体有没有”，而是“AlphaTab 第一次在这个 iframe 环境中渲染时，是否刚好踩在字体加载完成之后”。**

换句话说：

- 浏览器内部有多层缓存（磁盘、内存、进程级字体缓存等）；
- Obsidian 主文档和 PrintPreview iframe 共享部分缓存，但 CSS/`document.fonts` 的可见性与 AlphaTab 的请求时机存在“竞速”；
- 当前 `ensureFontsReady()` 仅仅是一个 `setTimeout(150ms)`，不足以充当“字体 ready 条件”。

## 最终解决方案：PrintPreview 内对 Bravura 做按视图的 cache-busting

### 核心思路

既然争议点在于“浏览器是否认真执行了一次字体加载生命周期”，那就让 PrintPreview **每次打开都“看起来像是一个全新的字体 URL”**，从而强制浏览器走一遍完整流程，而不是依赖某个不透明的内存缓存命中。

实现方式：

- 在 `PrintPreviewView` 内部，不动全局的 `plugin.resources.bravuraUri`；
- 在 `createPrintSettings` 中，对传入的 `bravuraUri` 添加一个基于时间戳的查询参数：

```ts
// src/views/PrintPreviewView.ts

private createPrintSettings(resources: {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
}): alphaTab.Settings {
	// 为打印视图单独构造一个带时间戳的 Bravura 字体 URL，避免与其他视图共享缓存
	// 这样每次打开 PrintPreview，浏览器都会认为是一个"新"的字体请求，
	// 有助于稳定触发一次完整的字体加载流程，降低首开豆腐块概率。
	const ts = Date.now();
	const sep = resources.bravuraUri.includes('?') ? '&' : '?';
	const bravuraWithTs = `${resources.bravuraUri}${sep}_print_ts=${ts}`;

	const settingsJson = { /* ...display/core/player 配置同原来... */ };

	const settings = new alphaTab.Settings();
	settings.fillFromJson(settingsJson);

	// 配置字体：使用带时间戳的 Bravura URL，强制 PrintPreview 每次打开都触发一次字体加载
	if (resources.bravuraUri) {
		settings.core.smuflFontSources = new Map([
			[alphaTab.FontFileFormat.Woff2, bravuraWithTs],
		]);
	}

	return settings;
}
```

### 效果

- 每次打开 PrintPreview：
  - `AlphaTab` 在内部会看到一个形如 `app://.../Bravura.woff2?_print_ts=1732260000000` 的新 URL；
  - 对底层文件系统来说，这仍然映射到同一个 `Bravura.woff2` 文件；
  - 对浏览器缓存系统来说，这是一个从未见过的新键，必须真实走一遍读取与 decode 流程；
- 在 DevTools Network 面板中可以看到：
  - 每次打开 PrintPreview，都会有一条带 `_print_ts=...` 的字体请求，大小约 `189 kB`；
- 实际表现：
  - PrintPreview 首开不再出现稳定的“豆腐块”现象；
  - 后续再次打开同一文件仍能正常显示。

## 方案的边界与后续优化空间

### 优点

- **改动局部**：
  - 只在 `PrintPreviewView` 中对 `bravuraUri` 做 cache-busting；
  - React 主播放器、Markdown 代码块仍然使用缓存友好的原始 URL；
- **行为可观测**：
  - Network 面板中可以清楚看到每次 PrintPreview 打开时的字体请求；
- **实用性强**：
  - 避免与 Obsidian/Electron 的 `app://` + iframe 权限细节过度纠缠，用一个足够稳定的工程手段解决用户可见问题。

### 潜在代价

- 每次打开 PrintPreview，都会触发一次字体 decode：
  - 文件体积约 `189 kB`，频率是“用户有意识地点打印预览”，总体可接受；
- 并没有从根本上解决“字体加载时序判定”的问题：
  - 当前版本的 `ensureFontsReady()` 仍然只是一个小延时；
  - 更稳健的做法是将来在 iframe 中使用 `document.fonts.check('12px alphaTab')` / `load()` 等 API，把 AlphaTab 的首帧渲染挂在一个明确的“字体 ready 条件”之后。

## 总结

- PrintPreview 的首开豆腐块问题，本质是“AlphaTab 在 iframe 环境中的首帧渲染，踩在了字体加载前面”，而不是“字体文件不存在”。
- 经过多轮尝试（手写 `@font-face`、data URL 注入、单纯依赖 `smuflFontSources` 等），最终采用的方案是：
  - **在 PrintPreview 内对 Bravura 字体 URL 做按视图的 cache-busting（时间戳 query）**，
  - 迫使浏览器每次为打印视图执行一次完整的字体加载流程。
- 该方案简单、局部、易于观测，实际使用中已经稳定解决了首开显示符号方块的问题。

后续若要进一步完善，可以在此基础上叠加：

- 在 iframe 内用 `document.fonts.check('12px alphaTab')` 等方式，显式等待字体 ready 再初始化 AlphaTab；
- 将这套“打印视图字体加载策略”的经验抽取到通用组件/文档中，避免未来在其他 iframe 场景里重蹈覆辙。
