---
title: "AlphaTex 编辑体验增强路线与 LSP 诊断落地"
date: 2026-05-29
tags:
  - alphatex
  - editor
  - lsp
  - diagnostics
  - roadmap
---

## 背景

本轮调研比较了当前 Obsidian Tab Flow 插件与 `F:\Code\Tabst.app` 的 AlphaTex 编辑/打谱能力，目标是明确后续开发方向，并先落地最能提升 `.atex` 编辑体验的能力。

当前插件已有基础：独立 `.atex` 编辑视图、CodeMirror 6 编辑器、实时 alphaTab 预览、单小节模式、Markdown `alphatex` 代码块渲染、可配置高亮、播放/导出/打印链路。主要短板集中在“像 IDE 一样写 AlphaTex”：诊断、补全、源码与谱面同步、结构导航、格式化和模板化输入。

## 候选方向、优先级与排序理由

### P0：AlphaTex LSP / 实时诊断高亮

**目标**：编辑时直接显示 AlphaTex 语法/语义错误，提供红线、错误 tooltip、lint gutter。

**排序理由**：

- 这是所有编辑体验的地基。没有行内诊断，用户只能等预览失败后从错误文本猜位置。
- alphaTab 1.8.x 已提供 `AlphaTexImporter`、`AlphaTexParser`、`lexerDiagnostics`、`parserDiagnostics`、`semanticDiagnostics`，可直接转成 CodeMirror diagnostics。
- `@coderline/alphatab-language-server` 提供后续补全、hover、TextMate grammar 的官方数据源；但完整 Worker LSP 在 Obsidian 中有打包和协议复杂度，第一步采用 LSP 同源的 importer diagnostics 更稳。
- 对现有 UI 侵入最小，只需在 `AlphaTexCodeMirrorEditor` 和嵌入式编辑器中加入 lint 扩展。

**落地策略**：

1. 安装 `@codemirror/lint` 与 `@coderline/alphatab-language-server`。
2. 新增 `src/editor/alphaTexDiagnostics.ts`，用 `AlphaTexImporter` 读取文档并收集 lexer/parser/semantic diagnostics。
3. 将 diagnostics 映射到 CodeMirror 的 `{ from, to, severity, message }`。
4. `.atex` 专用编辑器先接入；嵌入式 Markdown playground 同步接入。

### P1：AlphaTex 补全、hover 与 snippet

**目标**：输入 `\` 时补全 metadata；在 `{}` 中补全 beat/note properties；为命令显示文档；支持 `cho`、`bar`、`sec` 等缩写展开。

**排序理由**：

- AlphaTex 记忆成本高，补全能显著降低入门门槛。
- 当前项目已安装 `@codemirror/autocomplete`，已有基础依赖。
- `@coderline/alphatab-language-server` 的 `documentation` map 可直接提供 metadata / property 说明。
- 可在 P0 的诊断基础上继续扩展，不需要先重构播放器。

**参考**：Tabst.app 的 `alphatex-completion.ts`、`alphatex-abbreviations.ts`、`alphatex-commands.json`。

### P1：源码与谱面双向同步

**目标**：源码光标定位到谱面小节/beat；点击谱面跳转源码；播放时源码高亮当前 beat/小节。

**排序理由**：

- 这是“打谱体验”从预览变成交互式编辑的关键。
- 当前插件已有单小节模式和完整播放器，说明已有大部分渲染基础。
- 实现需要 beat-to-source mapping，复杂度高于诊断/补全，因此排在 P0 之后。

**参考**：Tabst.app 的 `alphatex-parse-positions.ts`、`alphatex-selection-sync.ts`、`alphatex-cursor-tracking.ts`、`alphatex-playback-sync.ts`。

### P2：GP → AlphaTex 创作入口

**目标**：把 `.gp/.gp3/.gp4/.gp5/.gpx` 转为 `.atex`，作为可编辑文本谱打开。

**排序理由**：

- 实现成本低，alphaTab 已有 `ScoreLoader.loadScoreFromBytes` 与 `AlphaTexExporter.exportToString`。
- 能把插件从播放器扩展为“把现有谱转成文本继续创作”的入口。
- 与 P0/P1 配合后，导入后的 `.atex` 能立即享受诊断、补全和预览。

### P2：结构导航、小节跳转与 section folding

**目标**：提供歌曲结构大纲、跳转到第 N 小节、按 section dot 折叠。

**排序理由**：

- 长谱维护时收益明显。
- 当前已有 `barHighlightPlugin` 与 `getBarNumberAtOffset`，可增量实现。
- 需要与未来 AST/beat mapping 合流，适合在 P1 的同步基础完成后深化。

### P2：AlphaTex formatter / bar-aware formatting

**目标**：格式化 metadata、统一小节线空格、整理 duration 区段、对齐 bars、格式化当前小节/选区。

**排序理由**：

- 文本打谱很依赖可读性。
- 需要较多格式约定和用户偏好设置，需谨慎设计避免破坏创作习惯。
- 建议在诊断稳定后再做，保证 formatter 输出能立即被 parser 校验。

### P3：ATDOC 文件内配置系统

**目标**：通过 `.atex` 注释写入每首谱自己的 display/player/print/staff/coloring 配置。

**排序理由**：

- 对高级用户和可分享谱面很有价值。
- 当前已有 Markdown `%%{init: ...}%%`，但 `.atex` 文件级配置尚未系统化。
- 涉及全局设置、工作区设置和文件内设置的优先级，需要先厘清配置模型。

### P3：和弦/指板辅助输入

**目标**：提供 chord 搜索、常用和弦库、指板预览、从指板生成 note/chord AlphaTex。

**排序理由**：

- 对吉他手非常有差异化价值。
- UI 与乐理/指法数据复杂度较高，不应阻塞基础编辑能力。

### P3：命令面板与快捷键体系

**目标**：插入小节、插入 section、插入 track/staff/voice、格式化、跳错误、跳小节等命令统一管理。

**排序理由**：

- Obsidian 自身已有命令系统，初期可先注册少量稳定命令。
- 完整 inline command palette 属于体验深化，适合等补全/snippet 和 formatter 稳定后再统一。

## 本次落地决策

本次先推进 **P0：AlphaTex LSP / 实时诊断高亮**。

实现上不直接启动完整 Web Worker LSP，而是采用 alphaTab LSP 同源的 `AlphaTexImporter` diagnostics：

- 避免 Obsidian 插件中 Worker URL、CJS bundle、LSP 初始化握手和移动端兼容问题。
- 诊断来源与官方 LSP 一致，包含 lexer/parser/semantic 三层。
- 保留 `@coderline/alphatab-language-server` 依赖，后续补全/hover 可继续使用其 `documentation`、`languageConfiguration`、`textMateGrammar`。

## 后续验证重点

- `.atex` 编辑视图中输入无效 AlphaTex 后，编辑器内出现 diagnostics 高亮和 gutter 标记。
- 修复文本后 diagnostics 自动消失。
- 原有实时预览和自动保存不被阻塞。
- 构建通过，`main.js` bundle 未出现无法解析的 Worker/LSP 运行时依赖。
