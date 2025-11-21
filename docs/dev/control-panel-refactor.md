# PlayBar 控件风格统一 - 从 Clickable Icon 到 Play Bar Button

## 概述

将 PlayBar 中的所有控制组件（节拍器、预备拍、循环、布局、缩放、滚动模式）从旧的 clickable-icon + checkbox/label 风格升级到统一的 `play-bar-button` 风格，保证整个 PlayBar 的视觉一致性。

## 变更清单

### 组件更新

#### 1. **MetronomeToggle.tsx** - 节拍器
- **之前**: checkbox + label (`play-bar-metronome`)
- **之后**: 按钮组件 (`play-bar-button`) + 音乐图标 (Music2)
- **特性**: 
  - 状态激活时添加 `active` 类，按钮高亮显示
  - 图标和文本标签并排显示

#### 2. **CountInToggle.tsx** - 预备拍
- **之前**: checkbox + label (`play-bar-countin`)
- **之后**: 按钮组件 (`play-bar-button`) + 计时器图标 (Timer)
- **特性**: 
  - 状态激活时添加 `active` 类
  - 一致的按钮样式和交互

#### 3. **LoopToggle.tsx** - 循环播放
- **之前**: checkbox + label (`play-bar-loop`)
- **之后**: 按钮组件 (`play-bar-button`) + 循环图标 (Repeat)
- **特性**: 
  - 激活时高亮显示
  - 统一的交互反馈

#### 4. **LayoutToggle.tsx** - 布局切换
- **之前**: 包装的 div + 内部按钮 (`play-bar-layout`)
- **之后**: 直接的 `play-bar-button` 按钮
- **特性**: 
  - 根据布局模式显示不同图标 (Layout / PanelsTopLeft)
  - 文本标签随状态变化 ("页面" / "横向")
  - 动态的 tooltip 提示

#### 5. **ZoomControl.tsx** - 缩放控制
- **之前**: label + select 组合 (`play-bar-zoom`)
- **之后**: 图标 + select 组合 (`play-bar-control`)
- **特性**: 
  - ZoomIn 图标配合下拉菜单
  - 保持 select 的功能性，优化外观

#### 6. **ScrollModeControl.tsx** - 滚动模式
- **之前**: label + select 组合 (`play-bar-scroll`)
- **之后**: 图标 + select 组合 (`play-bar-control`)
- **特性**: 
  - Scroll 图标配合下拉菜单
  - 统一的控制器样式

### CSS 更新 (`playbar.css`)

#### 新增样式

```css
/* 控制器 - 图标 + 下拉菜单容器 */
.tab-flow-play-bar .play-bar-control {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-radius: var(--radius-s);
    background: transparent;
    transition: background 0.15s ease;
}

.tab-flow-play-bar .play-bar-control:hover {
    background: var(--background-modifier-hover);
}

/* 控制器图标样式 */
.tab-flow-play-bar .play-bar-control-icon {
    color: var(--text-muted);
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    stroke-width: 2;
}

/* Select 元素统一样式 */
.tab-flow-play-bar .play-bar-control-select {
    padding: 4px 6px;
    border: none;
    border-radius: var(--radius-s);
    background: transparent;
    color: var(--text-normal);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-weight: 500;
    white-space: nowrap;
    min-width: 80px;
}

.tab-flow-play-bar .play-bar-control-select:hover {
    background: var(--background-modifier-hover);
}

.tab-flow-play-bar .play-bar-control-select:focus {
    outline: none;
    background: var(--background-modifier-active-hover);
}
```

#### 移除的旧样式

- `.play-bar-metronome`, `.metronome-label` - 已弃用
- `.play-bar-countin`, `.countin-label` - 已弃用
- `.play-bar-loop`, `.loop-label` - 已弃用
- `.play-bar-layout`, `.layout-label`, `.layout-btn` - 已弃用
- `.play-bar-zoom`, `.zoom-label`, `.zoom-select` - 已弃用
- `.play-bar-scroll`, `.scroll-label`, `.scroll-select` - 已弃用
- `.speed-*` 相关样式 - 已弃用
- `.play-bar-metronome input[type='checkbox']` - 已弃用

### 图标映射

| 控件 | 图标 | lucide-react | 用途 |
|------|------|--------------|------|
| 节拍器 | ♪ | Music2 | 节拍器开关 |
| 预备拍 | ⏱️ | Timer | 预备拍开关 |
| 循环 | ⟲ | Repeat | 循环播放开关 |
| 布局(页面) | 📄 | Layout | 页面布局 |
| 布局(横向) | ◻ | PanelsTopLeft | 横向滚动 |
| 缩放 | 🔍+ | ZoomIn | 缩放级别 |
| 滚动 | 📜 | Scroll | 滚动模式 |

## 样式一致性

### 按钮基础样式

所有按钮现在共享以下样式：
- **尺寸**: 最小高度 28px，水平 padding 6px 8px
- **图标**: 16px × 16px，stroke-width 2
- **文本**: 12px 字体，500 font-weight，nowrap
- **圆角**: `var(--radius-s)` (通常 4-6px)
- **间距**: 图标和文本之间 4px gap

### 交互反馈

所有交互式元素统一的反馈：

```css
/* 默认态 */
- 背景: transparent
- 文本颜色: var(--text-muted)

/* Hover 态 */
- 背景: var(--background-modifier-hover)
- 文本颜色: var(--text-normal)

/* Active 态（按钮按下） */
- 背景: var(--background-modifier-active-hover)
- 变换: scale(0.98)

/* 激活态（功能已启用） */
- 背景: var(--interactive-accent)
- 文本颜色: var(--text-on-accent)

/* Focus 态（键盘导航） */
- 轮廓: 2px solid accent，offset 2px
```

## 组件层次结构

```
PlayBar (主容器)
├── SettingsToggle (按钮)
├── TracksToggle (按钮)
├── MediaSyncToggle (按钮)
├── Export (按钮)
├── PlayControls (播放/暂停/停止)
├── TimeDisplay (时间显示)
├── MetronomeToggle (按钮)
├── CountInToggle (按钮)
├── LoopToggle (按钮)
├── LayoutToggle (按钮)
├── ZoomControl (图标 + select)
├── ScrollModeControl (图标 + select)
└── 状态指示器
```

## 使用建议

### 创建新的切换按钮

```tsx
import { SomeIcon } from 'lucide-react';

export const MyToggle: React.FC<Props> = ({ enabled, onToggle }) => {
  return (
    <button
      className={`play-bar-button ${enabled ? 'active' : ''}`}
      onClick={onToggle}
      aria-label="My Feature"
      title="Toggle My Feature"
    >
      <SomeIcon size={16} />
      <span className="play-bar-button-text">My Feature</span>
    </button>
  );
};
```

### 创建新的控制器（图标 + select）

```tsx
import { SomeIcon } from 'lucide-react';

export const MyControl: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="play-bar-control">
      <SomeIcon size={16} className="play-bar-control-icon" />
      <select
        className="play-bar-control-select"
        value={value}
        onChange={onChange}
        aria-label="My Control"
        title="My Control"
      >
        {/* options */}
      </select>
    </div>
  );
};
```

## 响应式设计

所有样式都遵循 `@media (max-width: 768px)` 的响应式规则：
- 按钮 padding 缩小到 4px 6px
- 最小高度 24px
- 图标大小 14px
- 字体大小 11-12px

## 可访问性

- 所有按钮都有 `aria-label` 和 `title` 属性
- Focus-visible 样式支持键盘导航
- 颜色对比符合 WCAG AA 标准
- 禁用状态清晰可见 (opacity: 0.4)

## 构建和验证

```bash
# 构建项目
npm run build

# 检查编译错误
tsc -noEmit -skipLibCheck

# 开发模式
npm run dev
```

## 相关文件

- `src/player/components/MetronomeToggle.tsx`
- `src/player/components/CountInToggle.tsx`
- `src/player/components/LoopToggle.tsx`
- `src/player/components/LayoutToggle.tsx`
- `src/player/components/ZoomControl.tsx`
- `src/player/components/ScrollModeControl.tsx`
- `src/player/components/PlayBar.tsx` (主容器)
- `src/styles/new-react-player/playbar.css` (样式文件)

## 测试清单

- [ ] 所有按钮在 hover 时显示背景色变化
- [ ] 激活的按钮显示高亮色 (interactive-accent)
- [ ] Select 控制器在 hover 时显示背景色
- [ ] 按钮文本和图标对齐正确
- [ ] 图标大小和 stroke-width 一致
- [ ] 响应式布局在 768px 以下正确缩放
- [ ] 键盘导航正常工作
- [ ] 禁用状态正确显示
- [ ] 各个功能仍正常工作（节拍器、循环、缩放等）
