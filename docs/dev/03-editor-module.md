# AlphaTex 编辑器模块

## 相关代码文件
- `src/editor/EmbeddableMarkdownEditor.ts` - 嵌入式 Markdown 编辑器包装器
- `src/components/AlphaTexPlayground.ts` - AlphaTex 编辑器主组件
- `src/components/controls/StaveProfileButton.ts` - 谱表配置控件

## 编辑器架构设计

### 嵌入式 Markdown 编辑器 (EmbeddableMarkdownEditor)

`EmbeddableMarkdownEditor` 是一个高级包装器，用于在插件中嵌入 Obsidian 的原生 Markdown 编辑器：

#### 核心功能
- **动态编辑器解析**: 运行时解析 Obsidian 的编辑器原型
- **自定义扩展**: 通过 monkey-around 库扩展编辑器行为
- **事件处理**: 完整的键盘事件和用户交互处理
- **作用域管理**: 独立的键盘作用域避免冲突

#### 配置选项
```typescript
interface MarkdownEditorProps {
  cursorLocation?: { anchor: number; head: number };
  value?: string;
  cls?: string;
  placeholder?: string;
  singleLine?: boolean;
  onEnter?: (editor: EmbeddableMarkdownEditor, mod: boolean, shift: boolean) => boolean;
  onEscape?: (editor: EmbeddableMarkdownEditor) => void;
  onSubmit?: (editor: EmbeddableMarkdownEditor) => void;
  onBlur?: (editor: EmbeddableMarkdownEditor) => void;
  onPaste?: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
  onChange?: (update: ViewUpdate) => void;
}
```

### 编辑器创建流程

```typescript
export function createEmbeddableMarkdownEditor(
  app: App, 
  container: HTMLElement, 
  options: Partial<MarkdownEditorProps> = {}
): EmbeddableMarkdownEditor {
  const EditorClass = resolveEditorPrototype(app);
  return new EmbeddableMarkdownEditor(app, EditorClass, container, options);
}
```

### 原型解析机制

```typescript
function resolveEditorPrototype(app: App): any {
  // 创建临时嵌入视图
  const widgetEditorView = app.embedRegistry.embedByExtension.md(
    { app, containerEl: createDiv() }, 
    null as unknown as TFile, 
    ''
  );
  
  // 设置为可编辑模式并显示编辑器
  widgetEditorView.editable = true;
  widgetEditorView.showEditor();
  
  // 获取编辑器原型
  const MarkdownEditor = Object.getPrototypeOf(
    Object.getPrototypeOf(widgetEditorView.editMode!)
  );
  
  // 清理临时实例
  widgetEditorView.unload();
  
  return MarkdownEditor.constructor;
}
```

### 编辑器扩展系统

使用 monkey-around 库进行动态方法拦截：

```typescript
const uninstaller = around(EditorClass.prototype, {
  buildLocalExtensions: (originalMethod) => function (this: InternalMarkdownEditor) {
    const extensions = originalMethod.call(this) || [];
    
    // 添加自定义扩展
    if (this === selfRef.editor) {
      // 添加占位符
      if (selfRef.options.placeholder) {
        extensions.push(placeholder(selfRef.options.placeholder));
      }
      
      // 添加 DOM 事件处理器
      extensions.push(EditorView.domEventHandlers({
        paste: (event) => selfRef.options.onPaste?.(event, selfRef),
        blur: () => {
          app.keymap.popScope(selfRef.scope);
          selfRef.options.onBlur?.(selfRef);
        },
        focusin: () => {
          app.keymap.pushScope(selfRef.scope);
          app.workspace.activeEditor = selfRef.owner;
        },
      }));
      
      // 自定义键盘绑定
      const keyBindings = [
        { 
          key: 'Enter', 
          run: () => selfRef.options.onEnter?.(selfRef, false, false),
          shift: () => selfRef.options.onEnter?.(selfRef, false, true) 
        },
        { 
          key: 'Mod-Enter', 
          run: () => selfRef.options.onEnter?.(selfRef, true, false),
          shift: () => selfRef.options.onEnter?.(selfRef, true, true) 
        },
        { 
          key: 'Escape', 
          run: () => { 
            selfRef.options.onEscape?.(selfRef); 
            return true; 
          }, 
          preventDefault: true 
        },
      ];
      
      extensions.push(Prec.highest(keymap.of(keyBindings as any)));
    }
    
    return extensions;
  },
});
```

### 更新事件处理

安全的更新事件处理，避免在编辑器销毁期间出现错误：

```typescript
this.editor.onUpdate = (update: ViewUpdate, changed: boolean) => {
  try {
    // 安全检查：确保视图就绪且未卸载
    const hasView = !!(update as any)?.view;
    const root = (update as any)?.view?.root;
    const rootOk = !!root && typeof root.getSelection === 'function';
    const inDom = !!this.editorEl?.isConnected;
    const stillLoaded = !!this.editor?.activeCM || !!this._loaded;
    
    if (!hasView || !rootOk || !inDom || !stillLoaded) return;
    
    originalOnUpdate?.(update, changed);
    if (changed) this.options.onChange?.(update);
  } catch {
    // 静默处理外部编辑器销毁期间的更新
  }
};
```

### 键盘作用域管理

独立的键盘作用域确保编辑器快捷键不与其他插件冲突：

```typescript
this.scope = new Scope(app.scope);
this.scope.register(['Mod'], 'Enter', () => true);

// 焦点管理
focusin: () => {
  app.keymap.pushScope(this.scope);
  app.workspace.activeEditor = this.owner;
},
blur: () => {
  app.keymap.popScope(this.scope);
  this.options.onBlur?.(this);
}
```

### 生命周期管理

完整的编辑器生命周期管理：

```typescript
destroy(): void {
  if (this.loaded && typeof this.editor.unload === 'function') {
    this.editor.unload();
  }
  
  // 清理键盘作用域
  this.appInstance.keymap.popScope(this.scope);
  this.appInstance.workspace.activeEditor = null;
  
  // 清理 DOM
  this.containerEl.empty();
  this.editor.destroy?.();
}
```

### 错误处理机制

1. **原型解析错误**: 处理 Obsidian API 变化
2. **扩展安装错误**: 安全的 monkey-patching
3. **更新事件错误**: 防止在销毁期间调用
4. **作用域管理错误**: 确保正确的 push/pop 操作

### 性能考虑

1. **懒加载**: 编辑器在需要时才创建
2. **资源复用**: 重复使用编辑器实例
3. **内存管理**: 正确的销毁和清理
4. **事件去重**: 避免不必要的事件处理

这个编辑器模块提供了强大的文本编辑功能，同时保持了与 Obsidian 生态系统的完美集成。
