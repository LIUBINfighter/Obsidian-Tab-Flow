# 2025-11-16 EditorView 生命周期问题复盘

## 问题概述

- 日期：2025-11-16
- 模块：`EmbeddableMarkdownEditor` / `EditorView`
- 现象：关闭 AlphaTex EditorView 后，Obsidian 无法再打开任何 View，控制台报错：

```text
Uncaught (in promise) Error: Embedded markdown editor not initialised yet.
    at Ml.requireEditor (plugin:tab-flow:68:13656)
    at get activeCM (plugin:tab-flow:68:13871)
    at t.eval (plugin:tab-flow:68:13137)
    at t.o (plugin:tab-flow:68:9430)
    at t.eval (plugin:tab-flow:68:13165)
    at t.o [as setActiveLeaf] (plugin:tab-flow:68:9430)
    ...
```

## 根因分析

- `EmbeddableMarkdownEditor` 在构造函数中使用 `monkey-around` 对 `app.workspace.setActiveLeaf` 进行了 monkey patch：
  - 在 wrapper 内部通过 `this.activeCM?.hasFocus` 判断当前嵌入编辑器是否拥有焦点。
  - 其中 `activeCM` 是一个 getter，内部调用 `requireEditor()`，当 `this.editor` 为 `undefined` 时抛出 `Embedded markdown editor not initialised yet.`。
- `EditorView` 关闭时会调用 `EmbeddableMarkdownEditor.destroy()`，其中将内部 `editor` 卸载并置为 `undefined`。
- 但 monkey patch 绑定在全局 `app.workspace.setActiveLeaf` 上，视图销毁后仍然生效。
- 因此：
  - View 关闭 → `this.editor` 被清空；
  - 之后任何地方调用 `setActiveLeaf` → 进入 wrapper → 访问 `this.activeCM` → `requireEditor()` 抛错；
  - 导致 Obsidian 的导航链路被中断，所有 View 打开都失败。

## 修复方案

### 1. 增加销毁状态标记

在 `EmbeddableMarkdownEditor` 中新增字段：

- `private isDestroyed = false;`

并在 `destroy()` 中第一时间设置：

```ts
this.isDestroyed = true;
```

### 2. 安全重写 setActiveLeaf hook

重写 monkey patch 的回调逻辑：

- 封装 `callOriginal()`，用于安全调用原始 `setActiveLeaf`：
  - 任何异常或不满足拦截条件时立即回退。
- 若 `this.isDestroyed` 为 `true`：
  - 不再尝试访问任何 editor 状态，直接 `callOriginal()`。
- 避免通过 `this.activeCM` getter 访问内部状态：
  - 改为：

```ts
let hasFocus = false;
try {
  const currentEditor = this.editor;
  if (currentEditor?.activeCM) {
    hasFocus = currentEditor.activeCM.hasFocus;
  }
} catch {
  callOriginal();
  return;
}

if (!hasFocus) {
  callOriginal();
}
```

- 保留原设计意图：
  - 当嵌入编辑器拥有焦点时，可以阻止部分 `setActiveLeaf` 调用；
  - 但不再因为实例已销毁或状态异常而阻断全局导航。

### 3. 验证

- 执行 `npm run build` 构建通过，无类型或编译错误。
- 手动测试用例：
  1. 打开 AlphaTex EditorView，编辑内容；
  2. 关闭该 View；
  3. 尝试打开普通 Markdown 文件以及其他插件视图；
  4. 观察：
     - 控制台不再出现 `Embedded markdown editor not initialised yet.`；
     - 各类 View 能正常打开、切换。

## 经验教训

- 在 Obsidian 这类长期运行的应用中，对核心 API（如 `setActiveLeaf`）做 monkey patch 时必须明确设计生命周期：
  - 如何解绑 / 失效；
  - 销毁后的实例不能继续参与全局逻辑决策。
- 任何在 getter 中可能抛异常的逻辑，都不宜直接用于全局 hook 的条件判断，应先用更安全的内部状态检查并加上 `try/catch`。
- 对于私有 / 非公开 API 的访问（如 `activeEditor`），要始终提供“失败即回退到默认行为”的保护线路，避免把整个工作区锁死。
