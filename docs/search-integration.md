## 概要

本文档简要介绍仓库中两个相关组件：`EmbeddableMarkdownEditor` 与 `AlphaTexPlayground`，并提供在 Playground 中实现“搜索”功能的可行方案、示例与注意事项，方便在插件中快速集成和维护搜索/定位能力。

## 组件简介

### `EmbeddableMarkdownEditor`（`src/editor/EmbeddableMarkdownEditor.ts`）

- 功能：在自定义 UI 中嵌入 Obsidian 的 Markdown 编辑器（CodeMirror），并注入自定义扩展（高亮、键位、事件处理等）。
- 常用接口：
  - 创建：`createEmbeddableMarkdownEditor(app, container, options)` 返回 `EmbeddableMarkdownEditor` 实例
  - 主要属性/方法：`value`（getter）、`set(content, focus?)`、`focus()`、`destroy()`、`register(cb)`、`activeCM`（CodeMirror `EditorView`）
  - 关键选项：`placeholder`, `singleLine`, `onEnter`, `onEscape`, `onBlur`, `onPaste`, `onChange`, `highlightSettings`
- 实现要点：通过 monkey-around 动态扩展 Obsidian 编辑器原型的 `buildLocalExtensions`，注入 placeholder、键位映射、禁用拼写检查、和一组高亮插件；并通过 ViewPlugin/MutationObserver 确保 `.cm-content` 的属性一致性。

### `AlphaTexPlayground`（`src/components/AlphaTexPlayground.ts`）

- 功能：复合控件，包含上方的嵌入式 Markdown（AlphaTex）编辑器与下方的实时谱面渲染区（AlphaTab）。提供工具栏（复制、重置、新建笔记、格式化 init JSON），支持多种布局与事件总线控制。
- 常用接口：
  - 创建：`createAlphaTexPlayground(plugin, container, initialSource, options)` → 返回 `AlphaTexPlaygroundHandle`
  - Handle 方法：`getValue()`, `setValue(v)`, `destroy()`, `refresh()`, `getApi()`, `updateCurrentBarInfo(info)`
- 实现要点：编辑器变化后采用 debounce 触发 `mountAlphaTexBlock` 进行渲染；若资源缺失提供下载按钮；通过 `eventBus` 支持播放/停止/缩放/滚动等远程命令。

## 在 Playground 中实现“搜索”的可行方案

以下方案从简单到完整，按复杂度排序，可根据需求逐步实现：

1) 基本文本查找（简单、安全）

- 思路：直接从编辑器获取文本（`embedded.value` 或 `playground.getValue()`），用字符串或正则查找匹配索引，然后用 CodeMirror 的 `dispatch` 将 selection 设置到匹配位置并调用 `embedded.focus()`。
- 优点：实现简单，无需改动编辑器内部或复杂插件。
- 缺点：只能以 selection 方式定位，无法高亮所有匹配或在谱面上做标注。

2) 在编辑器中高亮所有匹配（更好 UX）

- 思路：在 `embedded.activeCM` 上创建一个 CodeMirror ViewPlugin，使用 Decoration 将所有匹配范围装饰成带特定样式的节点（比如 `cm-search-match`）。当查询词或文档变化时更新 decorations。
- 优点：用户能看到所有匹配并可点击跳转；交互丰富。
- 注意：匹配数量过多时要限制或分页；在大型文件中应 debounce 并异步计算匹配。

3) 在谱面视图（AlphaTab）中定位与标注（针对谱面元素搜索）

- 思路：如果搜索目标与谱面元素（小节编号、tick、和弦 id 等）相关，先从文本解析得到目标的逻辑位置（例如对应的 tick 或 bar index），然后通过 `AlphaTabApi`（从 `playground.getApi()` 获取）设置 `api.tickPosition` 或调用相关滚动方法以聚焦对应位置；如需高亮也可在谱面渲染层插入覆盖元素。
- 优点：实现编辑器与谱面双向定位（点击文本可让谱面滚动，点击谱面可让编辑器定位）。

## UI 集成建议

- 在 `AlphaTexPlayground` 的工具栏或上方区域添加一个搜索输入框与“上一个/下一个”按钮与匹配计数显示。
- 在输入框使用短 debounce（如 150ms）避免频繁计算。
- 支持正则搜索与大小写选项，提供“全部高亮”与“逐个跳转”两种查看模式。

## 简要示例代码片段（伪代码，供实现参考）

1) 定位并跳转到首个匹配（基于 `embedded`）

```ts
const value = embedded ? embedded.value : playground.getValue();
const idx = value.indexOf(query);
if (idx >= 0) {
  // 将 selection 设置为匹配范围
  embedded.editor.editor.cm.dispatch({
    selection: EditorSelection.range(idx, idx + query.length),
  });
  embedded.focus();
  // 同时尝试让谱面滚动到当前光标（若 API 可用）
  playground.getApi()?.scrollToCursor?.();
}
```

2) 高亮所有匹配（思路）

- 创建 CodeMirror ViewPlugin，维护当前匹配数组并返回对应 Decoration；当 query 或文档变化时更新并刷新视图。

（需要把插件注入到 `embedded.activeCM` 的 extensions 中或通过 `around` 动态挂载）

## 边界情况与注意事项

- single-bar 模式：`onChange` 回调若直接写回宿主文件会覆盖其他小节，必须在调用方层面做防护或禁用自动写回。
- activeEditor 管理：`EmbeddableMarkdownEditor` 有 `USE_ACTIVE_EDITOR` 开关，开启时需注意多个实例间的竞争以及在卸载时清理 `activeEditor`。
- 资源依赖：谱面渲染前需确保 `AlphaTabResources` 完整（bravura 字体、worker 等），否则无法在谱面上定位。
- 性能：全文高亮或大量匹配在大文件上会消耗显著 CPU/内存，建议限制最大匹配数并采用 debounce/异步处理。

## 小结

这两个组件已经提供了足够的钩子用于实现从简单的查找到复杂的跨视图定位与高亮的搜索功能。常见实现路径是先实现基于 selection 的跳转，然后按需为编辑器添加 CodeMirror decoration 插件，再将谱面定位与编辑器选择做双向绑定。

如需我可以：
- 在 `AlphaTexPlayground` 中添加一个搜索栏并实现“高亮所有匹配 + 上/下一个跳转”的完整 TypeScript 实现；
- 或者演示如何在谱面层（`AlphaTexBlock` / `AlphaTabApi`）上做定位与标注（需要查看 `src/markdown/AlphaTexBlock.ts`）。

文件已创建：`docs/search-integration.md`。
