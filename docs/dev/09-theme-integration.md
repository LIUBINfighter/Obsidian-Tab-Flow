# 主题适配系统

## 相关代码文件
- `src/styles/alphatex.css` - AlphaTex 样式定义
- `src/styles/debug.css` - 调试样式
- `src/styles/doc.css` - 文档样式
- `src/styles/play.css` - 播放器样式
- `src/styles/settingtab.css` - 设置面板样式
- `src/styles/TrackModal.css` - 轨道模态框样式

## CSS 样式架构

### AlphaTex 代码块样式

`alphatex.css` 定义了 Markdown 中 AlphaTex 代码块的样式：

#### 容器样式
```css
.alphatex-block {
  margin: 0.5rem 0 1rem 0;
}

.alphatex-score {
  width: 100%;
  overflow: auto;
}
```

#### 控制按钮样式
```css
.alphatex-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.alphatex-controls .atx-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--background-modifier-border);
  background: var(--interactive-normal);
  color: var(--text-normal);
  cursor: pointer;
}

.alphatex-controls .atx-label {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}
```

#### 错误和提示样式
```css
.alphatex-error {
  color: var(--text-error);
}

.alphatex-note {
  color: var(--text-muted);
}
```

## Obsidian 主题变量集成

### CSS 变量使用
插件全面使用 Obsidian 的 CSS 变量系统，确保与主题完美适配：

```css
/* 使用 Obsidian 主题变量 */
.alphatex-controls .atx-btn {
  border: 1px solid var(--background-modifier-border);
  background: var(--interactive-normal);
  color: var(--text-normal);
}

.alphatex-error {
  color: var(--text-error); /* 使用主题的错误颜色 */
}

.alphatex-note {
  color: var(--text-muted); /* 使用主题的次要文本颜色 */
}
```

### 动态主题适配

在 JavaScript 中动态读取 CSS 变量：

```typescript
// 从计算样式获取主题颜色
const style = window.getComputedStyle(element);
const mainGlyphColor = style.getPropertyValue("--color-base-100") || "#e0e0e0";
const secondaryGlyphColor = style.getPropertyValue("--color-base-60") || "#a0a0a0";
const base40 = style.getPropertyValue("--color-base-40") || "#707070";
const scoreInfoColor = mainGlyphColor;

// 动态生成主题相关的样式
const runtimeStyle = document.createElement("style");
runtimeStyle.innerHTML = `
  .alphatex-block .at-cursor-bar { 
    background: hsl(var(--accent-h),var(--accent-s),var(--accent-l)); 
    opacity: 0.2; 
  }
  .alphatex-block .at-selection div { 
    background: hsl(var(--accent-h),var(--accent-s),var(--accent-l)); 
    opacity: 0.4; 
  }
`;
```

## 播放器样式 (play.css)

### 播放控制条样式
```css
.play-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--background-secondary);
  border-radius: var(--radius-s);
}

.play-button {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--background-modifier-border);
  background: var(--interactive-normal);
  color: var(--text-normal);
  border-radius: var(--radius-s);
  cursor: pointer;
}

.play-button:hover {
  background: var(--interactive-hover);
}
```

### 进度条样式
```css
.progress-bar {
  flex: 1;
  height: 0.5rem;
  background: var(--background-modifier-border);
  border-radius: var(--radius-s);
  overflow: hidden;
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
  transition: width 0.1s ease;
}
```

## 设置面板样式 (settingtab.css)

### 选项卡样式
```css
.itabs-settings-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--background-modifier-border);
  margin-bottom: 1rem;
}

.itabs-settings-tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.itabs-settings-tab.active {
  color: var(--text-normal);
  border-bottom-color: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
}

.itabs-settings-contents {
  padding: 1rem 0;
}
```

### 设置项样式
```css
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.setting-item-name {
  font-weight: var(--font-semibold);
  color: var(--text-normal);
}

.setting-item-description {
  font-size: var(--font-smaller);
  color: var(--text-muted);
  margin-top: 0.25rem;
}
```

## 轨道模态框样式 (TrackModal.css)

### 轨道列表样式
```css
.track-list {
  max-height: 300px;
  overflow-y: auto;
}

.track-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--background-modifier-border);
}

.track-name {
  flex: 1;
  color: var(--text-normal);
}

.track-controls {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.control-button {
  padding: 0.25rem;
  border: 1px solid var(--background-modifier-border);
  background: var(--interactive-normal);
  border-radius: var(--radius-s);
  cursor: pointer;
}

.control-button:hover {
  background: var(--interactive-hover);
}
```

## 调试样式 (debug.css)

### 调试信息样式
```css
.debug-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.5rem;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  font-family: var(--font-monospace);
  font-size: var(--font-smaller);
  color: var(--text-muted);
  z-index: 1000;
}

.debug-info {
  margin: 0.25rem 0;
}

.debug-warning {
  color: var(--text-warning);
}

.debug-error {
  color: var(--text-error);
}
```

## 文档样式 (doc.css)

### 文档视图样式
```css
.doc-view {
  padding: 1rem;
  background: var(--background-primary);
  color: var(--text-normal);
}

.doc-section {
  margin-bottom: 2rem;
}

.doc-heading {
  color: var(--text-accent);
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.doc-code {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  padding: 0.5rem;
  font-family: var(--font-monospace);
  overflow-x: auto;
}
```

## 响应式设计

### 移动设备适配
```css
@media (max-width: 768px) {
  .alphatex-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .play-bar {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .itabs-settings-tabs {
    flex-wrap: wrap;
  }
}
```

### 高对比度模式支持
```css
@media (prefers-contrast: high) {
  .alphatex-controls .atx-btn {
    border-width: 2px;
  }
  
  .progress-fill {
    border: 1px solid var(--text-normal);
  }
}
```

## 性能优化

### CSS 变量缓存
避免频繁读取 CSS 变量：

```typescript
// 缓存主题颜色
let cachedThemeColors: ThemeColors | null = null;

function getThemeColors(element: HTMLElement): ThemeColors {
  if (!cachedThemeColors) {
    const style = window.getComputedStyle(element);
    cachedThemeColors = {
      base100: style.getPropertyValue("--color-base-100"),
      base60: style.getPropertyValue("--color-base-60"),
      base40: style.getPropertyValue("--color-base-40"),
      accent: `hsl(${style.getPropertyValue("--accent-h")},${style.getPropertyValue("--accent-s")},${style.getPropertyValue("--accent-l")})`
    };
  }
  return cachedThemeColors;
}
```

### 样式注入优化
避免重复注入样式：

```typescript
// 全局样式只注入一次
if (!document.getElementById('tabflow-global-styles')) {
  const style = document.createElement('style');
  style.id = 'tabflow-global-styles';
  style.textContent = globalStyles;
  document.head.appendChild(style);
}
```

这个主题适配系统确保了插件与 Obsidian 主题生态系统的完美集成，支持明暗模式切换、高对比度模式和响应式设计，提供了优秀的用户体验。
