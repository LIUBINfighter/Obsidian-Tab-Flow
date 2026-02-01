# MediaSync 编辑器实现总结

日期: 2025年10月16日

## 概述

成功实现了完整的媒体同步编辑器（MediaSync Editor），包含以下核心组件：

- ✅ **WaveformCanvas** - 波形可视化组件
- ✅ **SyncPointMarkerPanel** - 可拖拽的同步点标记面板  
- ✅ **MediaSyncEditor** - 主编辑器容器
- ✅ **MediaSync 集成** - 标签页界面集成

## 组件架构

### 1. WaveformCanvas (波形显示)

**文件**: `src/player/components/WaveformCanvas.tsx`

**功能**:
- Canvas 绘制立体声波形
- 支持缩放（Zoom）
- 支持水平滚动
- 时间轴显示
- 播放光标显示

**核心方法**:
```typescript
// 主绘制函数
drawWaveform(canvas, props) -> void

// 子绘制函数
drawFrame() -> 绘制背景线
drawSamples() -> 绘制波形数据
drawTimeAxis() -> 绘制时间轴
drawCursor() -> 绘制播放光标
```

**Props**:
```typescript
interface WaveformCanvasProps {
  leftSamples: Float32Array;      // 左声道样本
  rightSamples: Float32Array;     // 右声道样本
  sampleRate: number;              // 采样率
  endTime: number;                 // 总时长（毫秒）
  width: number;                   // 宽度
  height: number;                  // 高度
  zoom?: number;                   // 缩放级别
  scrollOffset?: number;           // 水平滚动偏移
  playbackTime?: number;           // 当前播放位置
  waveFormColor?: string;          // 波形颜色
  timeAxisLineColor?: string;      // 时间轴颜色
  cursorColor?: string;            // 光标颜色
  leftPadding?: number;            // 左边距
  timeAxisHeight?: number;         // 时间轴高度
}
```

### 2. SyncPointMarkerPanel (同步点标记)

**文件**: `src/player/components/SyncPointMarkerPanel.tsx`

**功能**:
- 显示所有同步点标记
- 支持拖拽移动标记
- 支持双击激活/禁用标记
- 显示 BPM 信息
- 点击面板寻址

**交互方式**:
- **左键拖拽**: 移动已激活的同步点
- **双击**: 激活/禁用同步点
- **左键点击面板**: 在该位置寻址

**标记类型**:
```typescript
enum SyncPointMarkerType {
  StartMarker = 'start',        // 起始标记
  EndMarker = 'end',            // 结束标记
  MasterBar = 'masterbar',      // 小节标记
  Intermediate = 'intermediate' // 中间标记
}
```

**Props**:
```typescript
interface SyncPointMarkerPanelProps {
  syncPointInfo: SyncPointInfo;
  onSyncPointInfoChanged(info: SyncPointInfo): void;
  onSeek(milliseconds: number): void;
  width: number;
  height: number;
  zoom: number;
  pixelPerMilliseconds: number;
  leftPadding: number;
}
```

### 3. MediaSyncEditor (主编辑器)

**文件**: `src/player/components/MediaSyncEditor.tsx`

**功能**:
- 容器组件，集成波形和同步点面板
- 管理编辑状态（缩放、滚动）
- 工具栏（缩放、重置、统计）
- 状态栏显示

**核心功能**:
- 分层布局：波形（70%）+ 标记面板（30%）
- 共享的虚拟滚动容器
- 共享的播放光标
- 实时同步

**Props**:
```typescript
interface MediaSyncEditorProps {
  syncPointInfo: SyncPointInfo;
  onSyncPointInfoChanged(info: SyncPointInfo): void;
  playbackTime?: number;
  onPlaybackTimeChange?(time: number): void;
  width?: number;
  height?: number;
}
```

### 4. MediaSync 集成

**文件**: `src/player/components/MediaSync.tsx`

**变化**:
- 添加标签页管理（基础设置 / 同步编辑器）
- 集成 `MediaSyncEditor` 组件
- 同步媒体播放位置
- 收集播放时间数据

**标签页页面**:
1. **基础设置**: 媒体加载、播放器显示（原有功能）
2. **同步编辑器**: 波形和同步点编辑（新增功能）

## 数据类型

### SyncPointMarker (同步点标记)

```typescript
interface SyncPointMarker {
  uniqueId: string;           // 唯一 ID
  syncTime: number;           // 媒体同步时间（毫秒）
  synthTime: number;          // 合成器原始时间（毫秒）
  synthBpm: number;           // 合成器 BPM
  synthTick: number;          // 合成器中的 Tick 位置
  masterBarIndex: number;     // 所在小节索引
  masterBarStart: number;     // 小节起始 Tick
  masterBarEnd: number;       // 小节结束 Tick
  occurence: number;          // 小节出现次数
  syncBpm?: number;           // 同步后的 BPM（可选）
  markerType: SyncPointMarkerType;  // 标记类型
}
```

### SyncPointInfo (同步点信息)

```typescript
interface SyncPointInfo {
  endTick: number;            // 最后一个小节的结束 Tick
  endTime: number;            // 音频总时长（毫秒）
  sampleRate: number;         // 采样率（Hz）
  leftSamples: Float32Array;  // 左声道样本
  rightSamples: Float32Array; // 右声道样本
  syncPointMarkers: SyncPointMarker[]; // 同步点列表
}
```

## 样式文件

**文件**: `src/styles/media-sync.css`

**新增样式**:
- `.media-sync-tabs-wrapper` - 标签页容器
- `.media-sync-tabs-header` - 标签页头
- `.media-sync-tab` - 单个标签页
- `.sync-point-marker` - 同步点标记
- `.media-sync-editor` - 编辑器容器

## 使用流程

### 基本使用

1. **选择媒体源**
   - 内置合成器
   - 音频文件（MP3、WAV 等）
   - 视频文件
   - YouTube 视频

2. **切换到同步编辑器**
   - 点击"📍 同步编辑器"标签页
   - 显示波形和同步点标记

3. **编辑同步点**
   - 拖拽标记调整位置
   - 双击激活/禁用标记
   - 点击面板寻址

4. **保存同步数据**
   - 同步点自动保存到 `syncPointInfo`
   - 用于后续导出或应用

### 高级功能（待实现）

- [ ] 自动同步算法（根据音频节奏自动对齐）
- [ ] 代码生成导出（TypeScript、C#、Kotlin）
- [ ] 撤销/重做功能
- [ ] 同步点预设
- [ ] 性能优化（事件节流）

## 技术细节

### 波形绘制算法

1. **最大振幅计算** - 遍历所有样本找到最大值
2. **样本分组** - 按像素分组样本数据
3. **峰值采样** - 每个像素取该范围内的最大值
4. **双声道绘制** - 分别绘制左右声道

### 同步点拖拽实现

1. **边界检查** - 防止标记越过相邻标记
2. **最小间距** - `dragLimit` 设置为 10px
3. **拖拽阈值** - `dragThreshold` 设置为 5px
4. **坐标转换** - 将 X 坐标转换为时间位置

### 缩放和滚动

- **缩放因子**: 1.2 倍（放大/缩小）
- **缩放范围**: 0.5x - 10x
- **像素映射**: 100px per second
- **平滑滚动**: 跟踪播放位置

## 集成要点

### 在 MediaSync 中的集成

```tsx
// 1. 添加状态
const [activeTab, setActiveTab] = useState<'basic' | 'editor'>('basic');
const [syncPointInfo, setSyncPointInfo] = useState<SyncPointInfo>(createDefaultSyncPointInfo());
const [playbackTime, setPlaybackTime] = useState<number>(0);

// 2. 标签页头
<button onClick={() => setActiveTab('editor')}>📍 同步编辑器</button>

// 3. 编辑器组件
{activeTab === 'editor' && (
  <MediaSyncEditor
    syncPointInfo={syncPointInfo}
    onSyncPointInfoChanged={setSyncPointInfo}
    playbackTime={playbackTime}
    onPlaybackTimeChange={setPlaybackTime}
  />
)}

// 4. 同步媒体位置
onPlaybackTimeChange={(time) => {
  audioRef.current.currentTime = time / 1000;
}}
```

## 性能考虑

- **Canvas 绘制**: 按需重绘，避免频繁更新
- **事件节流**: 播放时间更新时注意性能
- **ResizeObserver**: 监听容器大小变化
- **内存管理**: Float32Array 样本数据

## 已知限制

1. **音频解析**: 需要对音频进行解码才能获得样本数据
2. **YouTube**: 由于跨域限制，无法直接获取音频数据
3. **实时同步**: 大型音频文件处理可能有延迟
4. **自动同步**: 还未实现（需要更复杂的算法）

## 下一步工作

### 优先级高
1. ✅ 波形和同步点编辑器 → **已完成**
2. ⏳ 自动同步算法
3. ⏳ 代码生成导出
4. ⏳ 撤销/重做

### 优先级中
5. ⏳ 同步点预设保存/加载
6. ⏳ 性能优化
7. ⏳ 从曲谱提取伴奏
8. ⏳ 媒体偏移量设置

### 优先级低
9. ⏳ 同步质量分析
10. ⏳ 配置持久化

## 参考资源

- 官方 AlphaTab Playground: https://www.alphatab.net/
- MediaSyncEditor 官方示例代码
- WaveformCanvas 实现参考

## 文件清单

```
src/player/components/
  ├── WaveformCanvas.tsx           // 波形显示
  ├── SyncPointMarkerPanel.tsx     // 同步点标记
  ├── MediaSyncEditor.tsx          // 编辑器容器
  └── MediaSync.tsx                // 主集成文件

src/player/types/
  └── sync-point.ts               // 类型定义和工具函数

src/styles/
  └── media-sync.css              // 样式文件
```

## 总结

成功实现了完整的媒体同步编辑界面，提供了：
- 🎨 直观的波形可视化
- 📍 交互式同步点编辑
- 📊 实时播放位置显示
- 🎛️ 缩放和滚动控制

为后续的自动同步、代码生成等高级功能奠定了坚实的基础。
