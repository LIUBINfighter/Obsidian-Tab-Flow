# TracksPanel - 音轨管理侧边栏

## 概述

TracksPanel 是音轨管理的侧边栏组件，从 TracksModal 重构而来。采用与 SettingsPanel 一致的侧边栏设计，允许用户在不关闭面板的情况下实时查看音轨调整效果。

## 设计理念

### 🎯 为什么改为侧边栏？

**原有 Modal 设计的问题：**
- ❌ Modal 遮挡视图，无法实时查看调整效果
- ❌ 需要"关闭 → 查看效果 → 重新打开 → 继续调整"的循环
- ❌ 用户体验不佳，特别是调整音量、移调时

**侧边栏设计的优势：**
- ✅ 从左侧滑入，不完全遮挡谱面
- ✅ 实时查看调整效果（音量、移调等）
- ✅ 与 SettingsPanel 保持一致的交互体验
- ✅ 可同时打开多个面板（Settings 在右，Tracks 在左）

### 🎨 设计一致性

```
┌─────────────────────────────────────────┐
│          Obsidian Workspace             │
│  ┌──────────┐             ┌──────────┐  │
│  │ Tracks   │             │ Settings │  │
│  │ Panel    │             │ Panel    │  │
│  │ (Left)   │             │ (Right)  │  │
│  │          │             │          │  │
│  │ • Solo   │             │ • Scale  │  │
│  │ • Mute   │  Main View  │ • Layout │  │
│  │ • Volume │             │ • Player │  │
│  │ • 移调    │             │ • Core   │  │
│  └──────────┘             └──────────┘  │
└─────────────────────────────────────────┘
```

## 功能特性

### 📋 音轨列表
- 显示当前曲谱的所有音轨
- 复选框选择/取消选择音轨
- 音轨名称显示（支持长名称截断）
- 选中状态实时同步

### 🎛️ 单音轨控制

每个音轨提供以下控制：

#### 1. Solo / Mute 按钮
- **Solo**: 独奏当前音轨（其他音轨静音）
- **Mute**: 静音当前音轨
- 图标状态：激活时高亮显示

#### 2. 音量滑块
- 范围：0-16（AlphaTab 标准）
- 显示百分比：0-100%
- 实时生效，无需关闭面板

#### 3. 完全移调
- 范围：-12 ~ +12 半音
- 同时影响音频播放和乐谱显示
- 适用于转调需求

#### 4. 音频移调
- 范围：-12 ~ +12 半音
- 仅影响音频播放，不改变乐谱
- 适用于伴奏需求

### 🔧 批量操作
- **全选**: 选择所有音轨
- **清空**: 仅保留第一个音轨

### 📊 状态信息
- 显示已选中音轨数 / 总音轨数
- 例如："3 / 5 tracks selected"

## 架构设计

### 组件层级

```
TablatureView
  ├── PlayBar
  │     ├── TracksToggle (切换按钮)
  │     └── ...
  └── TracksPanel (侧边栏)
        ├── Header (标题 + 操作按钮)
        ├── Content (音轨列表)
        │     └── TrackItem[] (音轨项)
        │           ├── Solo/Mute 按钮
        │           ├── 音量滑块
        │           ├── 移调控制
        │           └── StaffItem[] (五线谱选项)
        └── Footer (状态信息)
```

### 状态管理

```typescript
// 本地状态
const [score, setScore] = useState<AlphaTab.model.Score | null>(null);
const [selectedTracks, setSelectedTracks] = useState<Map<number, AlphaTab.model.Track>>(new Map());

// AlphaTab 事件同步
useAlphaTabEvent(api, 'renderStarted', () => {
  // 更新 selectedTracks
});

useAlphaTabEvent(api, 'scoreLoaded', (loadedScore) => {
  setScore(loadedScore);
});
```

### 与 AlphaTab API 交互

```typescript
// 音轨选择
api.renderTracks(newTracks);

// Solo/Mute
api.changeTrackMute([track], mute);
api.changeTrackSolo([track], solo);

// 音量
api.changeTrackVolume([track], volumeRatio);

// 音频移调
api.changeTrackTranspositionPitch([track], pitch);

// 完全移调（需更新 settings）
api.settings.notation.transpositionPitches[trackIndex] = pitch;
api.updateSettings();
api.render();
```

## 使用方法

### 1. 集成到 TablatureView

```tsx
import { TracksPanel } from './TracksPanel';

const [tracksPanelOpen, setTracksPanelOpen] = useState(false);

return (
  <div>
    <PlayBar 
      controller={controller}
      onTracksClick={() => setTracksPanelOpen(true)}
    />
    
    <TracksPanel
      controller={controller}
      isOpen={tracksPanelOpen}
      onClose={() => setTracksPanelOpen(false)}
    />
  </div>
);
```

### 2. 添加 TracksToggle 到 PlayBar

```tsx
import { TracksToggle } from './TracksToggle';

{onTracksClick && (
  <TracksToggle 
    controller={controller} 
    onClick={onTracksClick} 
  />
)}
```

### 3. 样式导入

在 `src/styles/tracks-panel.css` 中已创建样式，使用 merge-styles 脚本合并。

## 样式定制

### CSS 变量适配

```css
.tracks-panel {
  background-color: var(--background-primary);
  border-right: 1px solid var(--background-modifier-border);
}

.tabflow-btn.is-active {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.tabflow-btn.is-muted {
  background-color: var(--background-modifier-error);
  color: var(--text-error);
}
```

### 布局方向

- **TracksPanel**: 从左侧滑入（`left: -400px → 0`）
- **SettingsPanel**: 从右侧滑入（`right: -400px → 0`）

### 响应式设计

```css
@media (max-width: 768px) {
  .tracks-panel {
    width: 100vw; /* 移动端全屏 */
    left: -100vw;
  }
}
```

## 与 TracksModal 对比

| 特性 | TracksModal (旧) | TracksPanel (新) |
|------|------------------|------------------|
| **交互方式** | 居中模态框 | 左侧滑入 |
| **视图遮挡** | 完全遮挡 | 部分遮挡 |
| **实时预览** | ❌ 需关闭查看 | ✅ 可同时查看 |
| **多面板** | ❌ 互斥 | ✅ 可同时打开 |
| **样式一致性** | 独立设计 | 与 Settings 统一 |
| **用户体验** | 中等 | 优秀 |

## 保留 TracksModal

虽然推荐使用 TracksPanel，但 TracksModal 保留作为备用：
- 某些场景可能更适合 Modal（如简单快速选择）
- 可通过配置切换使用方式
- 代码保持兼容

## 工作流示例

### 场景 1：调整多音轨混音

1. 打开 TracksPanel
2. 调整各音轨音量
3. 实时听到效果
4. 微调 Solo/Mute
5. 完成后关闭面板

**无需重复打开/关闭！**

### 场景 2：为伴奏转调

1. 打开 TracksPanel
2. 选择伴奏音轨
3. 调整"音频移调"（例如 +2）
4. 实时播放查看效果
5. 乐谱显示不变，仅音频变化

### 场景 3：同时调整显示和播放

1. 左侧打开 TracksPanel（音轨控制）
2. 右侧打开 SettingsPanel（显示设置）
3. 同时调整：
   - TracksPanel: 音量、移调
   - SettingsPanel: 缩放、布局
4. 实时预览所有变化

## 技术细节

### useAlphaTabEvent Hook

```typescript
useAlphaTabEvent(
  api,
  'renderStarted',
  () => {
    // 回调逻辑
  },
  [api] // 依赖项
);
```

### 音轨选择逻辑

```typescript
const handleTrackSelect = (track: Track, selected: boolean) => {
  let newTracks: Track[];
  
  if (selected) {
    newTracks = [...api.tracks, track];
  } else {
    newTracks = api.tracks.filter(t => t !== track);
    // 至少保留一个音轨
    if (newTracks.length === 0) return;
  }
  
  // 按索引排序并重新渲染
  newTracks.sort((a, b) => a.index - b.index);
  api.renderTracks(newTracks);
};
```

### 音量计算

AlphaTab 音量范围是 0-16，UI 显示为百分比：

```typescript
const volumePercentage = Math.round(volume * 100 / 16);
```

## 未来扩展

- [ ] 音轨重新排序（拖拽）
- [ ] 音轨颜色标记
- [ ] 音轨分组
- [ ] 预设配置保存
- [ ] 音轨搜索/过滤
- [ ] 快捷键支持
- [ ] 音轨效果器（EQ、Reverb）
- [ ] 音轨导出（单独导出某音轨）

## 相关文件

- `src/player/components/TracksPanel.tsx` - 主组件
- `src/player/components/TrackItem.tsx` - 音轨项组件
- `src/player/components/StaffItem.tsx` - 五线谱项组件
- `src/player/components/TracksToggle.tsx` - 切换按钮
- `src/styles/tracks-panel.css` - 样式文件
- `src/player/hooks/useAlphaTabEvent.ts` - 事件 Hook

## 注意事项

### ⚠️ 至少保留一个音轨

```typescript
if (newTracks.length === 0) {
  return; // 阻止移除最后一个音轨
}
```

### ⚠️ 移调范围限制

- 完全移调：-12 ~ +12（一个八度）
- 音频移调：-12 ~ +12
- 超出范围可能导致音质下降

### ⚠️ 性能考虑

- 大量音轨时（>20），考虑虚拟滚动
- 音量调整使用防抖避免频繁 API 调用
- 移调后需重新渲染，可能有延迟

## 调试技巧

### 1. 查看当前选中音轨

```javascript
console.log('Selected Tracks:', api.tracks.map(t => t.name));
```

### 2. 检查音轨状态

```javascript
console.log('Track Playback Info:', {
  mute: track.playbackInfo.isMute,
  solo: track.playbackInfo.isSolo,
  volume: track.playbackInfo.volume
});
```

### 3. 监听音轨变化

在 DevTools 中设置断点：
- `api.renderTracks()` 调用
- `useAlphaTabEvent('renderStarted')` 回调

## 总结

TracksPanel 提供了更优秀的音轨管理体验：
- 🎯 实时预览调整效果
- 🎨 与 Settings 面板风格统一
- 🚀 提升用户操作效率
- 💡 符合现代 DAW 软件的交互习惯

这是一个显著的 UX 改进！🎉
