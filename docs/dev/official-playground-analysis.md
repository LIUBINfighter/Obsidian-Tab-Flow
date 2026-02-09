# 官方 AlphaTab Playground 架构分析

## 1. 核心架构对比

### 1.1 状态管理策略

**官方示例**：
```typescript
// 使用 React Hooks 进行本地状态管理
const [isLoading, setLoading] = useState(true);
const [sidePanel, setSidePanel] = useState(SidePanel.None);
const [bottomPanel, setBottomPanel] = useState(BottomPanel.None);
const [mediaType, setMediaType] = useState<MediaTypeState>({
    type: MediaType.Synth
});
```

**特点**：
- ✅ **简单直接**：UI 状态直接用 useState
- ✅ **组件内聚**：状态与组件生命周期绑定
- ✅ **无外部依赖**：不需要 Zustand/Redux
- ⚠️ **局限性**：多组件共享状态需要 prop drilling

**我们的实现**：
```typescript
// 使用 Zustand 全局状态管理
const runtimeStore = createRuntimeStore();
const uiStore = createUIStore();
const globalConfigStore = createGlobalConfigStore(adapter);
const workspaceConfigStore = createWorkspaceConfigStore(adapter);
```

**对比分析**：

| 维度 | 官方示例 | 我们的实现 | 建议 |
|------|---------|-----------|------|
| **复杂度** | 低 | 高 | ✅ 保持现状（多标签页隔离需要） |
| **持久化** | 无 | 完整（Plugin + Workspace） | ✅ 优势点 |
| **状态共享** | Prop drilling | 全局访问 | ✅ 优势点 |
| **开发效率** | 快 | 慢（需要定义 schema） | ⚠️ 可简化部分临时状态 |

**改进建议**：
```typescript
// 混合策略：临时 UI 状态用 useState，持久化状态用 Store
// ❌ 不要所有状态都放 Store
const [sidePanel, setSidePanel] = useState(SidePanel.None); // ✅ 本地状态
const workspaceConfig = useWorkspaceConfig(); // ✅ 持久化状态
```

---

### 1.2 自定义 Hook 架构

**官方提供的核心 Hooks**：

```typescript
// @site/src/hooks
export const useAlphaTab = (configure: (settings: Settings) => void): [AlphaTabApi | null, React.RefCallback<HTMLDivElement>] => {
    const [api, setApi] = useState<AlphaTabApi | null>(null);
    const elementRef = useCallback((element: HTMLDivElement | null) => {
        if (element) {
            const settings = new Settings();
            configure(settings);
            const newApi = new AlphaTabApi(element, settings);
            setApi(newApi);
        }
    }, [configure]);

    return [api, elementRef];
};

export const useAlphaTabEvent = <TEventArgs,>(
    api: AlphaTabApi | null,
    eventName: string,
    handler: (args: TEventArgs) => void
) => {
    useEffect(() => {
        if (!api) return;
        api.on(eventName, handler);
        return () => api.off(eventName, handler);
    }, [api, eventName, handler]);
};
```

**关键设计理念**：

1. **延迟初始化**：通过 `RefCallback` 而非 `useEffect` 初始化 API
   ```typescript
   // ✅ 官方做法：元素挂载时立即初始化
   const [api, element] = useAlphaTab(s => { /* config */ });
   return <div ref={element} />;

   // ❌ 我们的做法：useEffect 延迟初始化
   useEffect(() => {
       if (container) {
           api = new AlphaTabApi(container, settings);
       }
   }, [container]);
   ```

2. **配置闭包**：通过回调函数配置，避免多次创建 Settings 对象
   ```typescript
   // ✅ 声明式配置
   useAlphaTab(s => {
       s.core.file = '/files/canon.gp';
       s.player.scrollElement = viewPortRef.current!;
   });
   ```

3. **事件自动清理**：useEffect 返回清理函数
   ```typescript
   // ✅ 自动管理事件生命周期
   useAlphaTabEvent(api, 'renderFinished', () => setLoading(false));
   ```

**我们的改进方向**：
```typescript
// 创建自定义 Hook 简化 AlphaTab 使用
export const useAlphaTabPlayer = (container: HTMLElement | null, config: AlphaTabConfig) => {
    const [api, setApi] = useState<AlphaTabApi | null>(null);
    
    useEffect(() => {
        if (!container) return;
        
        const settings = new Settings();
        // 应用配置
        Object.assign(settings, config);
        
        const newApi = new AlphaTabApi(container, settings);
        setApi(newApi);
        
        return () => newApi.destroy();
    }, [container, config]);
    
    return api;
};
```

---

## 2. 媒体同步架构

### 2.1 多媒体类型管理

**官方的类型设计**：

```typescript
export enum MediaType {
    Synth = 'synth',
    Audio = 'audio',
    YouTube = 'youtube'
}

export type MediaTypeState =
    | { type: MediaType.Synth }
    | { type: MediaType.Audio; audioFile: Uint8Array }
    | {
          type: MediaType.YouTube;
          youtubeUrl: string;
          youtubeMediaOffset: number;
          youtubeVideoDuration?: number;
      };
```

**优势**：
- ✅ **类型安全**：使用 Discriminated Union Types
- ✅ **状态一致性**：媒体类型和相关数据绑定
- ✅ **扩展性**：易于添加新媒体类型

**我们的实现对比**：
```typescript
// ❌ 当前：分散的状态
interface SessionState {
    audioUrl: string | null;
    youtubeUrl: string | null;
    mediaType: 'synth' | 'audio' | 'youtube';
}

// ✅ 改进：使用联合类型
type MediaSource =
    | { type: 'synth' }
    | { type: 'audio'; url: string; blob: Blob }
    | { type: 'youtube'; url: string; offset: number }
    | { type: 'external'; element: HTMLMediaElement };
```

---

### 2.2 外部媒体集成

**官方的外部媒体处理器**：

```typescript
// IExternalMediaHandler 实现
const handler: alphaTab.synth.IExternalMediaHandler = {
    get backingTrackDuration() {
        return youtubePlayer.current?.duration * 1000 ?? 0;
    },
    get playbackRate() {
        return youtubePlayer.current?.playbackRate ?? 1;
    },
    set playbackRate(value) {
        if (youtubePlayer.current) {
            youtubePlayer.current.playbackRate = value;
        }
    },
    seekTo(time) {
        youtubePlayer.current.currentTime = time / 1000;
    },
    play() {
        youtubePlayer.current?.play();
    },
    pause() {
        youtubePlayer.current?.pause();
    }
};

(api.player!.output as IExternalMediaSynthOutput).handler = handler;
```

**关键点**：

1. **双向同步**：
   ```typescript
   // YouTube → AlphaTab
   const onTimeUpdate = () => {
       if (api.actualPlayerMode === PlayerMode.EnabledExternalMedia) {
           (api.player.output as IExternalMediaSynthOutput)
               .updatePosition(newPlayer.currentTime * 1000);
       }
   };

   // AlphaTab → YouTube
   handler.seekTo(time) {
       youtubePlayer.current.currentTime = time / 1000;
   }
   ```

2. **生命周期管理**：
   ```typescript
   // ✅ 使用 useRef 存储清理函数
   const youtubePlayerUnsubscribe = useRef<() => void>(null);
   
   const setYoutubePlayer = useCallback((newPlayer) => {
       // 清理旧的事件监听器
       if (youtubePlayerUnsubscribe.current) {
           youtubePlayerUnsubscribe.current();
       }
       
       // 注册新的事件监听器
       newPlayer.addEventListener('play', onPlay);
       // ...
       
       // 保存清理函数
       youtubePlayerUnsubscribe.current = () => {
           newPlayer.removeEventListener('play', onPlay);
           // ...
       };
   }, [api]);
   ```

**我们应该学习的**：
```typescript
// 创建统一的外部媒体服务
export class ExternalMediaService implements IExternalMediaHandler {
    constructor(
        private mediaElement: HTMLMediaElement,
        private api: AlphaTabApi
    ) {}
    
    // 实现双向同步
    private bindEvents() {
        this.mediaElement.addEventListener('timeupdate', () => {
            this.api.player.output.updatePosition(
                this.mediaElement.currentTime * 1000
            );
        });
    }
    
    destroy() {
        // 清理事件监听器
    }
}
```

---

## 3. UI 组件架构

### 3.1 面板管理模式

**官方的面板切换**：

```typescript
enum SidePanel {
    None = 'none',
    Settings = 'settings',
    TrackSelector = 'trackSelector'
}

enum BottomPanel {
    None = 'none',
    MediaSyncEditor = 'mediaSyncEditor'
}

// 状态管理
const [sidePanel, setSidePanel] = useState(SidePanel.None);
const [bottomPanel, setBottomPanel] = useState(BottomPanel.None);

// 渲染
{api && api?.score && (
    <PlaygroundSettings
        api={api}
        onClose={() => setSidePanel(SidePanel.None)}
        isOpen={sidePanel === SidePanel.Settings}
    />
)}
```

**优势**：
- ✅ **互斥面板**：同时只能打开一个侧边面板
- ✅ **类型安全**：使用枚举而非字符串
- ✅ **声明式渲染**：通过 `isOpen` prop 控制

**我们的实现对比**：
```typescript
// ❌ 当前：使用独立的 boolean 状态
const [showSettings, setShowSettings] = useState(false);
const [showTracks, setShowTracks] = useState(false);
// 可能同时打开多个面板

// ✅ 改进：使用枚举
type PanelType = 'settings' | 'tracks' | 'export' | 'none';
const [activePanel, setActivePanel] = useState<PanelType>('none');
```

---

### 3.2 文件拖放处理

**官方的拖放实现**：

```typescript
const onDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'link'; // ✅ 显示链接光标
    }
};

const onDrop = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.dataTransfer) {
        const files = e.dataTransfer.files;
        if (files.length === 1) {
            openFile(api!, files[0]); // ✅ 统一的文件打开接口
        }
    }
};

return (
    <div onDragOver={onDragOver} onDrop={onDrop}>
        {/* content */}
    </div>
);
```

**我们应该添加的功能**：
```typescript
// 在 TablatureView 中添加拖放支持
export const TablatureView: React.FC = () => {
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files[0]) {
            controller.loadScoreFromFile(
                files[0].arrayBuffer(),
                files[0].name
            );
        }
    }, [controller]);

    return (
        <div onDragOver={preventDefaults} onDrop={handleDrop}>
            {/* ... */}
        </div>
    );
};
```

---

## 4. API 使用最佳实践

### 4.1 配置更新模式

**官方推荐**：

```typescript
// ✅ 修改配置后必须调用 updateSettings()
api.settings.player.playerMode = PlayerMode.EnabledBackingTrack;
api.updateSettings();

// ✅ 批量修改
api.settings.player.playerMode = PlayerMode.EnabledExternalMedia;
api.settings.player.scrollMode = ScrollMode.Continuous;
api.updateSettings(); // 一次性应用
```

**我们的现状检查**：
```typescript
// ✅ 我们已经正确使用
const updateLayout = (mode: LayoutMode) => {
    if (!api) return;
    api.settings.display.layoutMode = mode;
    api.updateSettings(); // ✅ 正确
    api.render(); // ⚠️ 可能不需要，updateSettings 会自动触发重渲染
};
```

**改进点**：
```typescript
// ❌ 避免多次调用 updateSettings
api.settings.display.layoutMode = mode;
api.updateSettings();
api.settings.display.staveProfile = profile;
api.updateSettings(); // ❌ 两次调用

// ✅ 批量更新
api.settings.display.layoutMode = mode;
api.settings.display.staveProfile = profile;
api.updateSettings(); // ✅ 一次调用
```

---

### 4.2 Scroll Element 配置

**官方的做法**：

```typescript
const viewPortRef = React.createRef<HTMLDivElement>();

const [api, element] = useAlphaTab(s => {
    s.player.scrollElement = viewPortRef.current!; // ✅ 配置时就设置
    s.player.scrollOffsetY = -10;
});

return (
    <div className="viewport" ref={viewPortRef}>
        <div ref={element} />
    </div>
);
```

**我们当前的实现**：
```typescript
// ❌ 在 scoreLoaded 事件中延迟配置
api.scoreLoaded.on(() => {
    setTimeout(() => {
        const scrollEl = container.closest('.view-content');
        if (scrollEl && api.settings.player.scrollElement !== scrollEl) {
            api.settings.player.scrollElement = scrollEl;
            api.updateSettings();
            
            setTimeout(() => {
                api.settings.player.scrollMode = ScrollMode.Continuous;
                api.updateSettings();
            }, 100); // ❌ 嵌套的 setTimeout
        }
    }, 100);
});
```

**改进方向**：
```typescript
// ✅ 在初始化时配置，避免延迟查找
const initAlphaTab = (container: HTMLElement) => {
    const scrollElement = container.closest('.view-content') as HTMLElement;
    
    const settings = new Settings();
    settings.player.scrollElement = scrollElement; // ✅ 初始化时设置
    settings.player.scrollMode = ScrollMode.Continuous;
    settings.player.scrollOffsetY = -10;
    
    return new AlphaTabApi(container, settings);
};
```

---

## 5. 性能优化模式

### 5.1 useCallback 最佳实践

**官方示例**：

```typescript
// ✅ 稳定的事件处理器引用
const setYoutubePlayer = useCallback(
    (newPlayer: HTMLMediaElementLike) => {
        // 复杂的设置逻辑
    },
    [api] // 仅在 api 变化时重新创建
);

// ✅ 稳定的 ref callback
const elementRef = useCallback((element: HTMLDivElement | null) => {
    if (element) {
        const settings = new Settings();
        configure(settings);
        const newApi = new AlphaTabApi(element, settings);
        setApi(newApi);
    }
}, [configure]);
```

**我们应该优化的**：
```typescript
// ❌ 每次渲染都创建新函数
<button onClick={() => api.play()}>Play</button>

// ✅ 使用 useCallback
const handlePlay = useCallback(() => {
    api?.play();
}, [api]);

<button onClick={handlePlay}>Play</button>
```

---

### 5.2 条件渲染策略

**官方模式**：

```typescript
// ✅ 确保 API 和 Score 都存在才渲染
{api && api?.score && (
    <PlaygroundSettings api={api} />
)}

// ✅ 加载状态覆盖层
{isLoading && (
    <div className="overlay">
        <FontAwesomeIcon icon={faSpinner} spin={true} />
    </div>
)}
```

**我们的改进**：
```typescript
// ✅ 使用 renderFinished 事件管理加载状态
useAlphaTabEvent(api, 'renderFinished', () => {
    setLoading(false);
});

// ✅ 优雅的加载指示器
{isLoading && <LoadingOverlay />}
{!isLoading && api && <PlayerControls api={api} />}
```

---

## 6. 架构决策建议

### 6.1 保留我们的优势

| 特性 | 我们的实现 | 官方示例 | 决策 |
|------|-----------|---------|------|
| **多标签页隔离** | ✅ StoreFactory | ❌ 无 | **保留** |
| **配置持久化** | ✅ Plugin + Workspace | ❌ 无 | **保留** |
| **全局状态管理** | ✅ Zustand | ❌ 仅本地状态 | **保留** |
| **类型安全** | ✅ 完整 Schema | ✅ TypeScript | **保留** |

---

### 6.2 应该借鉴的模式

#### ✅ 高优先级

1. **自定义 Hook 封装**
   ```typescript
   // 创建 useAlphaTabPlayer Hook
   export const useAlphaTabPlayer = (config) => {
       // 简化 API 初始化和事件管理
   };
   ```

2. **媒体类型联合类型**
   ```typescript
   type MediaSource = 
       | { type: 'synth' }
       | { type: 'audio'; url: string }
       | { type: 'youtube'; url: string; offset: number };
   ```

3. **面板枚举管理**
   ```typescript
   enum ActivePanel {
       None = 'none',
       Settings = 'settings',
       Tracks = 'tracks',
       Export = 'export'
   }
   ```

4. **外部媒体处理器**
   ```typescript
   class ExternalMediaService implements IExternalMediaHandler {
       // 统一的外部媒体同步逻辑
   }
   ```

#### ⚠️ 中优先级

5. **文件拖放支持**
6. **useCallback 优化**
7. **批量配置更新**

#### 💡 低优先级（可选）

8. **YouTube 播放器集成**
9. **波形编辑器**（需要音频同步需求）

---

## 7. 具体改进实施方案

### 阶段 1: Hook 封装（本周）

```typescript
// src/player/hooks/useAlphaTabPlayer.ts
export const useAlphaTabPlayer = (
    container: HTMLElement | null,
    config: AlphaTabPlayerConfig
): AlphaTabApi | null => {
    const [api, setApi] = useState<AlphaTabApi | null>(null);
    
    useEffect(() => {
        if (!container) return;
        
        const settings = createAlphaTabSettings(config);
        const newApi = new AlphaTabApi(container, settings);
        setApi(newApi);
        
        return () => newApi.destroy();
    }, [container]);
    
    return api;
};

// src/player/hooks/useAlphaTabEvent.ts
export const useAlphaTabEvent = <T,>(
    api: AlphaTabApi | null,
    eventName: string,
    handler: (args: T) => void
) => {
    useEffect(() => {
        if (!api) return;
        api.on(eventName, handler);
        return () => api.off(eventName, handler);
    }, [api, eventName, handler]);
};
```

**使用示例**：
```typescript
// 在 TablatureView 中使用
const api = useAlphaTabPlayer(container, config);

useAlphaTabEvent(api, 'renderFinished', () => {
    setLoading(false);
});

useAlphaTabEvent(api, 'scoreLoaded', (score) => {
    console.log('Score loaded:', score.title);
});
```

---

### 阶段 2: 媒体类型重构（下周）

```typescript
// src/player/types/media-source.ts
export enum MediaType {
    Synth = 'synth',
    Audio = 'audio',
    YouTube = 'youtube',
    External = 'external'
}

export type MediaSource =
    | { type: MediaType.Synth }
    | { type: MediaType.Audio; url: string; blob: Blob }
    | { type: MediaType.YouTube; url: string; offset: number }
    | { type: MediaType.External; element: HTMLMediaElement };

// src/player/services/MediaSwitchService.ts
export class MediaSwitchService {
    constructor(private api: AlphaTabApi) {}
    
    switchMedia(source: MediaSource) {
        this.api.pause();
        
        switch (source.type) {
            case MediaType.Synth:
                this.api.settings.player.playerMode = PlayerMode.EnabledSynthesizer;
                break;
            case MediaType.Audio:
                this.api.settings.player.playerMode = PlayerMode.EnabledBackingTrack;
                // 加载音频文件
                break;
            case MediaType.YouTube:
                this.api.settings.player.playerMode = PlayerMode.EnabledExternalMedia;
                // 设置外部媒体处理器
                break;
        }
        
        this.api.updateSettings();
    }
}
```

---

### 阶段 3: UI 组件优化（后续）

```typescript
// src/player/components/PanelManager.tsx
enum PanelType {
    None = 'none',
    Settings = 'settings',
    Tracks = 'tracks',
    Export = 'export',
    Share = 'share'
}

export const PanelManager: React.FC = () => {
    const [activePanel, setActivePanel] = useState(PanelType.None);
    
    return (
        <>
            <SettingsPanel 
                isOpen={activePanel === PanelType.Settings}
                onClose={() => setActivePanel(PanelType.None)}
            />
            <TracksPanel 
                isOpen={activePanel === PanelType.Tracks}
                onClose={() => setActivePanel(PanelType.None)}
            />
            {/* ... */}
        </>
    );
};
```

---

## 8. 总结

### 🎯 关键收获

1. **不要过度设计**：官方示例证明简单的 useState 在很多场景下就足够了
2. **Hooks 是核心**：自定义 Hook 可以大幅简化 AlphaTab 集成
3. **类型安全优先**：使用 Discriminated Union Types 管理复杂状态
4. **生命周期管理**：正确的事件清理和资源释放至关重要
5. **配置批量更新**：避免多次调用 `updateSettings()`

### 📋 行动清单

- [ ] 创建 `useAlphaTabPlayer` 和 `useAlphaTabEvent` Hooks
- [ ] 重构媒体类型为 Discriminated Union
- [ ] 实现 ExternalMediaService
- [ ] 添加文件拖放支持
- [ ] 优化配置更新流程（批量更新）
- [ ] 使用枚举管理面板状态
- [ ] 添加 useCallback 优化

### 🔄 架构演进路线

```
当前架构                    →    目标架构
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PlayerController           →    useAlphaTabPlayer Hook
  └─ 命令式 API 调用       →      └─ 声明式 Hook

独立 boolean 状态          →    枚举管理
  ├─ showSettings         →      └─ PanelType.Settings
  └─ showTracks           →         └─ PanelType.Tracks

分散的媒体状态             →    MediaSource 联合类型
  ├─ audioUrl             →      ├─ { type: 'audio', url }
  └─ youtubeUrl           →      └─ { type: 'youtube', url }

手动事件管理               →    useAlphaTabEvent Hook
  ├─ api.on(...)          →      └─ 自动清理
  └─ api.off(...)         →
```

---

**文档版本**: 1.0  
**分析日期**: 2025-10-16  
**适用版本**: Tab Flow v0.3.0+
