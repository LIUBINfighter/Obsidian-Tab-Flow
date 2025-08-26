# 播放控制系统

## 相关代码文件
- `src/components/AudioPlayer.ts` - 音频播放器组件
- `src/components/PlayBar.ts` - 播放控制条
- `src/components/ProgressBar.ts` - 进度条组件
- `src/components/ProgressBar.types.ts` - 进度条类型定义
- `src/components/TracksModal.ts` - 轨道选择模态框

## 音频播放器架构

### AudioPlayer 组件

`AudioPlayer` 组件提供了与 AlphaTab 引擎的双向音频同步功能：

#### 核心功能
- **HTML5 Audio 元素集成**: 使用原生 audio 元素提供播放控制
- **双向同步**: AlphaTab ↔ Audio 元素的双向时间同步
- **外部媒体模式**: 支持 AlphaTab 的外部媒体控制模式
- **事件处理**: 完整的播放状态和进度事件处理

#### 创建音频播放器

```typescript
export function createAudioPlayer(options: AudioPlayerOptions): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "audio-player-container";
  
  const audio = document.createElement("audio");
  audio.controls = true;
  
  // 事件监听器设置
  audio.addEventListener('timeupdate', () => {
    onTimeUpdate(audio.currentTime * 1000, audio.duration * 1000);
  });
  
  container.appendChild(audio);
  return container;
}
```

### AlphaTab 音频同步

#### 设置双向同步

```typescript
export function setupAlphaTabAudioSync(
  api: alphaTab.AlphaTabApi,
  audio: HTMLAudioElement
): void {
  // 设置为外部媒体控制模式
  api.settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
  
  // 外部媒体处理器 (AlphaTab → Audio)
  const handler: alphaTab.synth.IExternalMediaHandler = {
    get backingTrackDuration() {
      return audio.duration * 1000;
    },
    get playbackRate() {
      return audio.playbackRate;
    },
    set playbackRate(value) {
      audio.playbackRate = value;
    },
    seekTo(time) {
      audio.currentTime = time / 1000;
    },
    play() {
      audio.play().catch(e => console.error("Audio play failed:", e));
    },
    pause() {
      audio.pause();
    }
  };
  
  // 设置处理器
  (api.player!.output as alphaTab.synth.IExternalMediaSynthOutput).handler = handler;
}
```

#### 音频事件监听器

```typescript
export function setupAudioEventListeners(
  api: alphaTab.AlphaTabApi,
  audio: HTMLAudioElement,
  updateTimerRef: { current: number }
): void {
  // 时间更新处理
  const onTimeUpdate = () => {
    (api.player!.output as alphaTab.synth.IExternalMediaSynthOutput).updatePosition(
      audio.currentTime * 1000
    );
  };
  
  // 播放状态处理
  const onPlay = () => {
    api.play();
    // 高频次位置更新确保光标平滑移动
    updateTimerRef.current = window.setInterval(onTimeUpdate, 50);
  };
  
  const onPauseOrEnd = () => {
    api.pause();
    window.clearInterval(updateTimerRef.current);
  };
  
  // 注册事件监听器
  audio.addEventListener('timeupdate', onTimeUpdate);
  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPauseOrEnd);
}
```

## 播放控制条 (PlayBar)

### 功能特性
- **播放控制**: 播放/暂停/停止按钮
- **进度显示**: 当前时间/总时间显示
- **速度控制**: 播放速度调节 (0.5x - 2.0x)
- **节拍器控制**: 节拍器开关
- **预备拍控制**: 预备拍开关
- **轨道选择**: 打开轨道选择模态框

### 组件结构

```typescript
export class PlayBar extends Component {
  // 播放控制按钮
  private playButton: HTMLElement;
  private pauseButton: HTMLElement;
  private stopButton: HTMLElement;
  
  // 进度显示
  private progressDisplay: HTMLElement;
  
  // 控制选项
  private speedControl: HTMLElement;
  private metronomeToggle: HTMLElement;
  private countInToggle: HTMLElement;
  private tracksButton: HTMLElement;
}
```

## 进度条组件 (ProgressBar)

### 功能特性
- **可视化进度**: 图形化显示播放进度
- **交互式控制**: 点击跳转到指定位置
- **实时更新**: 平滑的进度动画
- **主题适配**: 支持 Obsidian 主题颜色

### 类型定义

```typescript
export interface ProgressBarProps {
  currentTime: number;
  totalTime: number;
  onSeek?: (time: number) => void;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
}

export interface ProgressBarState {
  isDragging: boolean;
  dragPosition: number;
}
```

### 进度计算逻辑

```typescript
private calculateProgress(): number {
  if (this.props.totalTime <= 0) return 0;
  return Math.min(1, Math.max(0, this.props.currentTime / this.props.totalTime));
}

private handleClick = (event: MouseEvent) => {
  const rect = this.container.getBoundingClientRect();
  const clickPosition = (event.clientX - rect.left) / rect.width;
  const seekTime = clickPosition * this.props.totalTime;
  
  if (this.props.onSeek) {
    this.props.onSeek(seekTime);
  }
};
```

## 轨道管理 (TracksModal)

### 功能特性
- **轨道列表**: 显示所有可用轨道
- **独奏/静音控制**: 单独的轨道控制
- **音量调节**: 每个轨道的音量控制
- **实时更新**: 即时应用轨道设置

### 模态框结构

```typescript
export class TracksModal extends Modal {
  private tracks: alphaTab.model.Track[];
  private api: alphaTab.AlphaTabApi;
  
  constructor(app: App, api: alphaTab.AlphaTabApi) {
    super(app);
    this.api = api;
    this.tracks = api.score?.tracks || [];
  }
}
```

### 轨道控制界面

```typescript
private createTrackControls(): void {
  this.tracks.forEach(track => {
    const trackElement = this.createTrackElement(track);
    
    // 独奏按钮
    const soloButton = trackElement.querySelector('.solo-button');
    soloButton.addEventListener('click', () => {
      this.api.soloTrack(track.index, !track.solo);
    });
    
    // 静音按钮
    const muteButton = trackElement.querySelector('.mute-button');
    muteButton.addEventListener('click', () => {
      this.api.muteTrack(track.index, !track.mute);
    });
    
    // 音量滑块
    const volumeSlider = trackElement.querySelector('.volume-slider');
    volumeSlider.addEventListener('input', (event) => {
      const volume = parseFloat((event.target as HTMLInputElement).value);
      this.api.setTrackVolume(track.index, volume);
    });
  });
}
```

## 性能优化

### 音频同步优化
1. **定时器管理**: 使用精确的定时器进行高频更新
2. **事件去重**: 避免重复的事件处理
3. **内存管理**: 正确的清理定时器和事件监听器

### 用户界面优化
1. **防抖处理**: 避免频繁的 UI 更新
2. **动画优化**: 使用 CSS 动画代替 JavaScript 动画
3. **懒加载**: 模态框内容在需要时才加载

### 错误处理
1. **音频播放错误**: 处理音频加载和播放失败
2. **同步错误**: 处理 AlphaTab 和音频元素之间的同步问题
3. **用户交互错误**: 处理无效的用户输入和操作

这个播放控制系统提供了完整的音频播放和控制功能，确保了与 AlphaTab 引擎的无缝集成和优秀的用户体验。
