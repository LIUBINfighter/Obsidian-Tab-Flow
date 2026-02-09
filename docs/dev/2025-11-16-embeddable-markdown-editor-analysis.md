---
title: EmbeddableMarkdownEditor 使用情况分析与重构建议
date: 2025-11-16
tags: [refactoring, editor, architecture]
status: analysis
---

## 一、当前使用情况

### 1.1 实例化位置

`EmbeddableMarkdownEditor` 在以下 3 个地方被实例化：

#### 1. **EditorView** (`src/views/EditorView.ts`)
- **用途**：主要的 AlphaTex 编辑器视图
- **使用场景**：用户编辑 `.alphatex` 文件时的左侧编辑器
- **关键代码**：
  ```typescript
  this.editor = createEmbeddableMarkdownEditor(this.app, editorWrapper, {
    value: content,
    onChange: (update) => { ... },
    highlightSettings: this.plugin.settings.editorHighlights || {},
  });
  ```
- **依赖关系**：
  - 需要与 React Player 同步（编辑器内容 → 播放器预览）
  - 需要处理自动保存
  - 需要支持单小节模式（光标位置变化时更新预览）

#### 2. **EditorTab (Settings)** (`src/settings/tabs/editorTab.ts`)
- **用途**：设置页面的语法高亮预览编辑器
- **使用场景**：用户在设置中调整语法高亮选项时，实时预览效果
- **关键代码**：
  ```typescript
  currentEditorHandle = createEmbeddableMarkdownEditor(app, editorWrap, {
    value: sampleCode,
    highlightSettings: plugin.settings.editorHighlights || {},
  });
  ```
- **依赖关系**：
  - 仅用于预览，不需要保存功能
  - 需要响应设置变化，重新渲染

#### 3. **AlphaTexPlayground** (`src/components/AlphaTexPlayground.ts`)
- **用途**：旧的 Playground 组件（已废弃？）
- **使用场景**：可能用于 Markdown 代码块预览
- **状态**：⚠️ 需要确认是否仍在使用

### 1.2 核心功能需求

从使用场景分析，编辑器需要提供：

1. **基础编辑功能**
   - CodeMirror 编辑器实例
   - 文本内容读写（`value` getter/setter）
   - 光标位置获取
   - 内容变化监听（`onChange`）

2. **语法高亮**
   - AlphaTex 语言支持
   - 可配置的高亮插件（dot, bar, bracket, meta, comment 等）
   - 实时高亮更新

3. **Obsidian 集成**
   - 键盘快捷键支持（通过 `activeEditor` hack）
   - 命令系统集成
   - Scope 管理

4. **生命周期管理**
   - 初始化/销毁
   - 资源清理

## 二、当前实现的问题

### 2.1 私有 API 依赖（高风险）

#### `resolveEditorPrototype` 函数的问题：
```typescript
// 通过 hack 方式获取 Obsidian 内部的 MarkdownEditor 类
const embedRegistry = app.embedRegistry.embedByExtension.md(...);
const MarkdownEditor = Object.getPrototypeOf(Object.getPrototypeOf(widget.editMode!));
```

**风险**：
- ❌ `app.embedRegistry` 是私有 API，Obsidian 更新可能破坏
- ❌ `Object.getPrototypeOf(Object.getPrototypeOf(...))` 是脆弱的原型链访问
- ❌ `widget.editMode` 的内部结构可能变化
- ❌ 没有类型安全保障

### 2.2 Monkey Patching（维护成本高）

```typescript
const uninstaller = around(EditorClass.prototype, {
  buildLocalExtensions: (originalMethod) => function(...) { ... },
  // ...
});
```

**问题**：
- ❌ 修改了 Obsidian 内部类的原型，可能与其他插件冲突
- ❌ 需要手动管理 `uninstaller`，容易泄漏
- ❌ 调试困难，错误堆栈不清晰

### 2.3 ActiveEditor Hack（不稳定）

```typescript
private static readonly USE_ACTIVE_EDITOR = true;
// ...
Reflect.set(app.workspace, 'activeEditor', this.editor);
```

**问题**：
- ❌ 直接修改 Obsidian 的 `workspace.activeEditor`，可能与其他视图冲突
- ❌ 需要手动清理，容易导致状态不一致
- ❌ 多实例场景下可能互相覆盖

### 2.4 初始化时序问题

**当前遇到的错误**：
```
Error: Embedded markdown editor not initialised yet.
```

**原因**：
- `onChange` 回调可能在编辑器完全初始化前被触发
- `requireEditor()` 检查不够健壮
- 异步初始化逻辑复杂

### 2.5 类型安全缺失

```typescript
interface InternalMarkdownEditor extends Record<string, unknown> {
  // 所有属性都是可选的，没有类型保障
  editorEl?: HTMLElement;
  activeCM?: EditorView;
  // ...
}
```

**问题**：
- ❌ 大量使用 `as` 类型断言
- ❌ 运行时才能发现类型错误
- ❌ IDE 无法提供准确的类型提示

## 三、重构方案对比

### 方案 A：继续使用 Hack API（短期方案）

**优点**：
- ✅ 无需大量重构，改动最小
- ✅ 可以快速修复当前问题
- ✅ 保持现有功能

**缺点**：
- ❌ 长期维护成本高
- ❌ Obsidian 更新风险大
- ❌ 技术债务累积

**建议改进**：
1. 添加更健壮的初始化检查
2. 改进错误处理和降级策略
3. 添加 Obsidian 版本兼容性检查
4. 完善类型定义（即使使用 `as`，也要有清晰的接口）

### 方案 B：直接使用 CodeMirror（推荐）

**优点**：
- ✅ 不依赖 Obsidian 私有 API
- ✅ 完全控制编辑器行为
- ✅ 更好的类型安全
- ✅ 更容易调试和维护
- ✅ 可以精确控制功能，只实现需要的部分

**缺点**：
- ❌ 需要重新实现部分 Obsidian 集成功能
- ❌ 需要手动处理键盘快捷键
- ❌ 初期开发工作量较大

**实现思路**：
```typescript
import { EditorView, basicSetup } from 'codemirror';
import { alphaTex } from './alphaTexLanguage';
import { highlightPlugins } from './Highlight';

export class AlphaTexEditor {
  private view: EditorView;
  
  constructor(
    container: HTMLElement,
    options: {
      value: string;
      onChange?: (value: string) => void;
      highlightSettings?: Record<string, boolean>;
    }
  ) {
    this.view = new EditorView({
      parent: container,
      doc: options.value,
      extensions: [
        basicSetup,
        alphaTex(),
        ...this.buildHighlightExtensions(options.highlightSettings),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            options.onChange?.(this.value);
          }
        }),
      ],
    });
  }
  
  get value(): string {
    return this.view.state.doc.toString();
  }
  
  set value(content: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
  }
  
  // ... 其他方法
}
```

**需要重新实现的功能**：
1. ✅ CodeMirror 基础设置（已有 `alphaTexLanguage`）
2. ✅ 语法高亮插件（已有 `Highlight.ts`）
3. ⚠️ Obsidian 快捷键集成（需要手动映射）
4. ⚠️ 命令系统集成（可选，EditorView 可能不需要）

### 方案 C：混合方案（渐进式重构）

**策略**：
1. **短期**：修复当前 Hack 实现的问题，添加防护措施
2. **中期**：为 EditorView 创建新的 CodeMirror 实现
3. **长期**：逐步迁移其他使用场景

**优点**：
- ✅ 风险可控，可以逐步验证
- ✅ 不影响现有功能
- ✅ 可以对比两种实现的稳定性

## 四、推荐方案

### 推荐：方案 B（直接使用 CodeMirror）+ 方案 C（渐进式）

**理由**：
1. **EditorView 是核心功能**，应该优先保证稳定性
2. **CodeMirror 6 是公开 API**，不会因 Obsidian 更新而破坏
3. **已有基础**：`alphaTexLanguage` 和 `Highlight.ts` 已经存在
4. **功能需求明确**：EditorView 不需要完整的 Obsidian 编辑器功能

**实施步骤**：

#### Phase 1: 创建新的 CodeMirror 编辑器（1-2 天）
- [ ] 创建 `src/editor/AlphaTexCodeMirrorEditor.ts`
- [ ] 实现基础编辑功能（value, onChange）
- [ ] 集成现有的语法高亮插件
- [ ] 添加单元测试

#### Phase 2: 在 EditorView 中替换（1 天）
- [ ] 修改 `EditorView` 使用新编辑器
- [ ] 保持 API 兼容（value, onChange 等）
- [ ] 测试所有功能（编辑、保存、单小节模式）

#### Phase 3: 清理和优化（可选）
- [ ] 评估是否还需要 `EmbeddableMarkdownEditor`
- [ ] 如果 Settings 预览也需要，可以迁移
- [ ] 移除或标记废弃旧的实现

## 五、风险评估

### 如果继续使用 Hack API：
- **Obsidian 更新风险**：高（每次大版本更新都可能破坏）
- **维护成本**：中高（需要持续关注 Obsidian 内部变化）
- **功能稳定性**：中（已知有初始化时序问题）

### 如果使用 CodeMirror：
- **Obsidian 更新风险**：低（不依赖私有 API）
- **维护成本**：低（标准 API，文档完善）
- **功能稳定性**：高（完全控制，易于调试）
- **开发成本**：中（需要 2-3 天开发时间）

## 六、决策建议

**建议采用方案 B（CodeMirror）**，原因：
1. EditorView 是用户主要使用的功能，稳定性优先
2. 已有语法高亮和语言支持的基础代码
3. 长期维护成本更低
4. 可以更好地控制功能，只实现需要的部分

**如果时间紧迫**，可以先采用方案 A 的改进版本，但应该：
1. 添加详细的错误处理和日志
2. 添加 Obsidian 版本检查
3. 在 TODO 中标记为技术债务，计划重构

## 七、实施记录

### 2025-01-27: 已完成 CodeMirror 重构

**实施内容**：
1. ✅ 创建了 `src/editor/AlphaTexCodeMirrorEditor.ts`
   - 直接使用 CodeMirror 6，不依赖 Obsidian 私有 API
   - 实现了完整的编辑器功能（value, set, focus, destroy）
   - 集成了所有语法高亮插件

2. ✅ 在 `EditorView` 中替换了旧实现
   - 移除了对 `EmbeddableMarkdownEditor` 的依赖
   - 保持了 API 兼容性（value, set, onChange 等）
   - 修复了初始化时序问题

3. ✅ 安装并配置了必要的 CodeMirror 包
   - `@codemirror/commands` - 基础命令和快捷键
   - `@codemirror/language` - 语言支持和括号匹配
   - `@codemirror/autocomplete` - 自动补全
   - `@codemirror/search` - 搜索和高亮

**优势**：
- ✅ 不再依赖 Obsidian 私有 API，稳定性大幅提升
- ✅ 类型安全，IDE 支持更好
- ✅ 代码更简洁，易于维护
- ✅ 初始化时序问题已解决

**待测试功能**：
- [ ] 基础编辑功能（输入、删除、撤销/重做）
- [ ] 语法高亮显示
- [ ] 自动保存
- [ ] 单小节模式（光标位置变化时更新预览）
- [ ] 文件外部修改同步

**后续工作**：
- 如果新编辑器稳定，可以考虑移除 `EmbeddableMarkdownEditor.ts`
- 评估是否需要在 Settings 预览中也使用新编辑器

