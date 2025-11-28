# ProgressBar 配置系统实现文档

## 📋 概述

为播放进度条 (`ProgressBar`) 添加了完整的配置系统，支持交互性控制、尺寸调整、显示选项等。

---

## ✅ 已完成功能

### 1. 配置结构设计

**位置**：`src/player/types/global-config-schema.ts`

在 `UIConfig` 接口中添加了 `progressBar` 配置对象：

```typescript
progressBar: {
  // 交互性配置
  enableInteraction: boolean;  // 总开关：是否允许任何交互
  enableDrag: boolean;         // 是否允许拖拽跳转
  enableClick: boolean;        // 是否允许点击跳转
  
  // 尺寸配置
  minWidth: number;            // 最小宽度（像素）
  maxWidth: number;            // 最大宽度（像素，-1 = 无限制）
  height: number;              // 进度条高度（像素）
  
  // 显示配置
  showHandle: boolean;         // 是否显示拖拽手柄
  showTooltip: boolean;        // TODO: 悬停时间提示
  showTimestamp: boolean;      // TODO: 时间戳刻度
  
  // 行为配置
  smoothSeek: boolean;         // TODO: 平滑跳转
  updateInterval: number;      // TODO: 更新节流（毫秒）
}
```

### 2. 默认配置

```typescript
progressBar: {
  // 交互性：默认启用所有交互功能
  enableInteraction: true,
  enableDrag: true,
  enableClick: true,
  
  // 尺寸：最小 100px，无最大限制，高度 4px
  minWidth: 100,
  maxWidth: -1,
  height: 4,
  
  // 显示：显示手柄
  showHandle: true,
  showTooltip: false,        // 待实现
  showTimestamp: false,      // 待实现
  
  // 行为
  smoothSeek: false,         // 待实现
  updateInterval: 100,       // 待实现
}
```

### 3. 组件集成

**位置**：`src/player/components/ProgressBar.tsx`

#### 3.1 状态管理集成

```typescript
// 订阅全局配置
const globalConfig = controller.getGlobalConfigStore();
const progressBarConfig = globalConfig((s) => s.uiConfig.progressBar);
```

#### 3.2 交互逻辑

- **禁用交互模式**：当 `enableInteraction = false` 时
  - 鼠标样式变为 `default`
  - 所有点击/拖拽事件被忽略
  - 拖拽手柄不显示
  - 容器 opacity 降低到 0.7

- **点击跳转**：当 `enableClick = true` 时
  - 点击进度条任意位置立即跳转

- **拖拽跳转**：当 `enableDrag = true` 时
  - 按下鼠标进入拖拽模式
  - 拖拽过程中持续更新播放位置

#### 3.3 样式动态化

```typescript
const containerStyle: React.CSSProperties = {
  minWidth: minWidth > 0 ? `${minWidth}px` : undefined,
  maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined,
  cursor: enableInteraction ? 'pointer' : 'default',
};

const barStyle: React.CSSProperties = {
  height: `${height}px`,
};
```

#### 3.4 条件渲染

```typescript
{/* 根据配置显示/隐藏拖拽手柄 */}
{showHandle && <div className="progress-handle" style={{ left: `${progress}%` }} />}
```

### 4. CSS 样式更新

**位置**：`src/styles/tabview/play.css`

- **移除硬编码**：删除了 `max-width: 600px` 等硬编码值
- **禁用状态样式**：
  ```css
  .progress-bar-container.disabled {
    cursor: default;
    opacity: 0.7;
  }
  
  .progress-bar-container.disabled .progress-handle {
    cursor: default;
    display: none;
  }
  ```
- **增强过渡效果**：为手柄添加了 `transform` 过渡

---

## 🔜 待实现功能（TODO）

### 1. 悬停时间提示 (`showTooltip`)

**需求**：鼠标悬停在进度条上时，显示对应位置的时间戳

**实现思路**：
```typescript
// 在 ProgressBar.tsx 中添加
const [tooltipVisible, setTooltipVisible] = useState(false);
const [tooltipPosition, setTooltipPosition] = useState({ x: 0, time: '00:00' });

const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!showTooltip || !barRef.current) return;
  
  const rect = barRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percentage = x / rect.width;
  const timeMs = percentage * totalMs;
  
  setTooltipPosition({
    x,
    time: formatTime(timeMs)
  });
  setTooltipVisible(true);
};
```

**UI 位置**：Settings Panel → UI Settings → Progress Bar → "Show time tooltip on hover"

---

### 2. 时间戳刻度 (`showTimestamp`)

**需求**：在进度条上显示时间刻度线（如每 30 秒一个刻度）

**实现思路**：
```typescript
// 计算刻度位置
const ticks = useMemo(() => {
  if (!showTimestamp || totalMs <= 0) return [];
  
  const tickInterval = 30000; // 30秒
  const tickCount = Math.floor(totalMs / tickInterval);
  
  return Array.from({ length: tickCount }, (_, i) => ({
    position: ((i + 1) * tickInterval / totalMs) * 100,
    label: formatTime((i + 1) * tickInterval)
  }));
}, [totalMs, showTimestamp]);

// 渲染刻度
{ticks.map((tick, i) => (
  <div key={i} className="progress-tick" style={{ left: `${tick.position}%` }}>
    <span className="tick-label">{tick.label}</span>
  </div>
))}
```

**UI 位置**：Settings Panel → UI Settings → Progress Bar → "Show timestamp markers"

---

### 3. 平滑跳转 (`smoothSeek`)

**需求**：跳转时播放位置平滑过渡，而不是立即跳转

**实现思路**：
```typescript
// 使用动画帧实现平滑过渡
const smoothSeekTo = (targetMs: number) => {
  const startMs = currentMs;
  const duration = 300; // 过渡时长
  const startTime = performance.now();
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeInOutQuad(progress);
    const intermediateMs = startMs + (targetMs - startMs) * easedProgress;
    
    controller.seek(Math.floor(intermediateMs));
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};
```

**UI 位置**：Settings Panel → UI Settings → Progress Bar → "Smooth seek animation"

---

### 4. 更新节流 (`updateInterval`)

**需求**：限制进度条更新频率，减少 CPU 占用

**实现思路**：
```typescript
// 使用节流函数
import { throttle } from 'lodash-es';

const throttledUpdate = useMemo(
  () => throttle((ms: number) => {
    // 更新显示
  }, updateInterval),
  [updateInterval]
);

// 在 useEffect 中使用
useEffect(() => {
  throttledUpdate(currentMs);
}, [currentMs, throttledUpdate]);
```

**UI 位置**：Settings Panel → Advanced → "Progress bar update interval (ms)"

---

## 🎨 用户配置 UI（待实现）

### 配置位置

**主入口**：Settings Panel → UI Settings → Progress Bar

### 配置项 UI 设计

```
┌─ Progress Bar Settings ────────────────────┐
│                                              │
│ ☑ Enable Interaction                        │
│   Allow clicking and dragging on progress   │
│   bar to seek playback position             │
│                                              │
│   ├─ ☑ Enable Click to Seek                │
│   └─ ☑ Enable Drag to Seek                 │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ Size Configuration                           │
│   Min Width:  [100    ] px                  │
│   Max Width:  [  -1   ] px (-1 = unlimited) │
│   Height:     [  4    ] px                  │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ Display Options                              │
│   ☑ Show drag handle                        │
│   ☐ Show time tooltip (TODO)                │
│   ☐ Show timestamp markers (TODO)           │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ Behavior                                     │
│   ☐ Smooth seek animation (TODO)            │
│   Update interval: [100  ] ms (TODO)        │
│                                              │
│         [ Reset to Defaults ]               │
│                                              │
└──────────────────────────────────────────────┘
```

### 实现步骤

1. **创建配置组件**：`src/player/components/ProgressBarSettings.tsx`
   ```typescript
   export const ProgressBarSettings: React.FC = () => {
     const globalConfig = useGlobalConfigStore();
     const config = globalConfig((s) => s.uiConfig.progressBar);
     
     // ... 渲染配置 UI
   };
   ```

2. **集成到 SettingsPanel**：
   ```typescript
   // 在 SettingsPanel.tsx 中添加标签页
   <TabContent value="ui">
     <h3>Progress Bar</h3>
     <ProgressBarSettings />
   </TabContent>
   ```

3. **添加重置按钮**：
   ```typescript
   const handleReset = () => {
     globalConfig.getState().updateUIConfig({
       progressBar: getDefaultGlobalConfig().uiConfig.progressBar
     });
   };
   ```

---

## 📊 使用场景

### 场景 1：操作模式（默认）
```typescript
enableInteraction: true
enableDrag: true
enableClick: true
showHandle: true
```
- 适合编辑、练习、反复跳转场景
- 完整的交互能力

### 场景 2：观看模式
```typescript
enableInteraction: false
enableDrag: false
enableClick: false
showHandle: false
```
- 适合连续播放、演示场景
- 避免误操作打断播放

### 场景 3：仅点击模式
```typescript
enableInteraction: true
enableDrag: false
enableClick: true
showHandle: false
```
- 快速跳转但避免拖拽误操作
- 移动设备友好

---

## 🔧 API 接口

### 获取配置

```typescript
const controller = getPlayerController();
const config = controller
  .getGlobalConfigStore()
  .getState()
  .uiConfig
  .progressBar;
```

### 更新配置

```typescript
controller.getGlobalConfigStore().getState().updateUIConfig({
  progressBar: {
    enableInteraction: false,
    // ... 其他配置
  }
});
```

### 重置为默认值

```typescript
const defaultConfig = getDefaultGlobalConfig().uiConfig.progressBar;
controller.getGlobalConfigStore().getState().updateUIConfig({
  progressBar: defaultConfig
});
```

---

## 📝 注释规范

### 代码中的状态标识

- **✅ 已实现**：功能完整可用
  ```typescript
  // ✅ 已实现：点击跳转
  if (enableClick) {
    handleProgressInteraction(e);
  }
  ```

- **🔜 TODO**：计划实现但尚未完成
  ```typescript
  // 🔜 TODO: 实现悬停时间提示
  // showTooltip: boolean;
  ```

- **⚠️ 注意**：需要特别关注的部分
  ```typescript
  // ⚠️ 注意：禁用交互时需要阻止所有事件
  if (!enableInteraction) return;
  ```

---

## 🧪 测试检查清单

### 交互性测试
- [ ] `enableInteraction = false` 时无法点击和拖拽
- [ ] `enableClick = true` 时点击跳转正常
- [ ] `enableDrag = true` 时拖拽跳转正常
- [ ] 拖拽过程中鼠标移出容器仍能继续拖拽

### 尺寸测试
- [ ] `minWidth` 生效（容器不会小于设定值）
- [ ] `maxWidth = -1` 时无最大限制
- [ ] `maxWidth > 0` 时容器不会超过设定值
- [ ] `height` 动态设置生效

### 显示测试
- [ ] `showHandle = false` 时不显示拖拽手柄
- [ ] `showHandle = true` 时悬停显示手柄
- [ ] 禁用状态下样式正确（opacity 0.7）

### 配置持久化测试
- [ ] 修改配置后重新加载插件，配置保持不变
- [ ] 重置配置恢复默认值

---

## 🎯 下一步计划

1. **优先级 P0**：实现设置 UI
   - 创建 `ProgressBarSettings.tsx`
   - 集成到 `SettingsPanel`
   - 添加重置按钮

2. **优先级 P1**：实现悬停提示
   - Tooltip 组件
   - 时间格式化
   - 位置计算

3. **优先级 P2**：实现时间刻度
   - 刻度算法
   - CSS 样式
   - 响应式布局

4. **优先级 P3**：性能优化
   - 更新节流
   - 平滑跳转动画

---

## 📚 相关文件

- **配置定义**：`src/player/types/global-config-schema.ts`
- **组件实现**：`src/player/components/ProgressBar.tsx`
- **样式文件**：`src/styles/tabview/play.css`
- **状态管理**：`src/player/store/globalConfigStore.ts`

---

## 📖 参考资料

- [Zustand 文档](https://docs.pmnd.rs/zustand/)
- [React 受控组件](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)
- [CSS Flexbox 布局](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
