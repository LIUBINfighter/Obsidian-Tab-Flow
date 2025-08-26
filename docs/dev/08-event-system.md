# 事件总线系统

## 相关代码文件
- `src/utils/EventBus.ts` - 事件总线核心实现
- `src/events/apiEventHandlers.ts` - API 事件处理器
- `src/events/playerEvents.ts` - 播放器事件处理器
- `src/events/scrollEvents.ts` - 滚动事件处理器
- `src/events/trackEvents.ts` - 轨道事件处理器
- `src/events/types.ts` - 事件类型定义

## 事件总线架构

### EventBus 核心类

`EventBus` 提供了一个简单的发布-订阅模式的事件系统：

#### 核心接口
```typescript
export type EventHandler = (payload?: any) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(event: string, handler: EventHandler): void;
  unsubscribe(event: string, handler: EventHandler): void;
  publish(event: string, payload?: any): void;
}
```

### 事件订阅机制

```typescript
subscribe(event: string, handler: EventHandler) {
  if (!this.handlers.has(event)) {
    this.handlers.set(event, new Set());
  }
  this.handlers.get(event)!.add(handler);
}
```

### 事件发布机制

```typescript
publish(event: string, payload?: any) {
  this.handlers.get(event)?.forEach(fn => fn(payload));
}
```

### 事件取消订阅

```typescript
unsubscribe(event: string, handler: EventHandler) {
  this.handlers.get(event)?.delete(handler);
}
```

## 事件类型系统

### 命令事件 (Commands)
用于触发特定操作：

```typescript
// 播放控制命令
"命令:播放暂停"
"命令:停止"
"命令:设置速度"

// 显示配置命令  
"命令:设置谱表"
"命令:设置缩放"
"命令:切换布局"

// 音频配置命令
"命令:设置节拍器"
"命令:设置预备拍"

// 滚动配置命令
"命令:设置滚动模式"
"命令:设置滚动速度"
"命令:设置Y偏移"
"命令:设置X偏移"
"命令:设置原生滚动"
"命令:滚动到光标"

// 导出命令
"命令:导出音频"
"命令:导出MIDI"
"命令:导出PDF"
"命令:导出GP"

// 乐谱加载命令
"命令:加载乐谱"
"命令:加载AlphaTex乐谱"
"命令:重建AlphaTabApi"
"命令:手动刷新"
```

### 状态事件 (Status)
用于通知状态变化：

```typescript
// 资源状态
"状态:音频就绪"
"状态:错误"

// 播放状态
"状态:播放位置变化"
"状态:乐谱已加载"
"状态:加载失败"

// 导出状态
"状态:音频导出完成"
"状态:音频导出失败"
"状态:API已重建"
```

### UI 事件
用于用户界面交互：

```typescript
"UI:showTracksModal"           // 显示轨道选择模态框
"tabflow:playbar-components-changed"  // 播放条组件变化
"tabflow:open-plugin-settings-player" // 打开播放器设置
"tabflow:settings-changed"            // 设置变更
```

### 轨道事件
用于轨道管理：

```typescript
"track:solo"      // 轨道独奏状态变化
"track:mute"      // 轨道静音状态变化  
"track:volume"    // 轨道音量变化
"track:transpose" // 轨道移调变化
```

## 事件处理器注册

### AlphaTabService 中的事件注册

```typescript
private registerCommandHandlers() {
  // 播放控制
  this.eventBus.subscribe("命令:播放暂停", () => this.api.playPause());
  this.eventBus.subscribe("命令:停止", () => this.api.stop());
  this.eventBus.subscribe("命令:设置速度", (speed: number) => {
    this.api.playbackSpeed = speed;
  });

  // 轨道选择
  this.eventBus.subscribe("命令:选择音轨", () => {
    this.eventBus.publish("UI:showTracksModal");
  });

  // 导出功能
  this.eventBus.subscribe("命令:导出音频", async (payload) => {
    try {
      const wavUrl = await this.exportAudioToWav(payload);
      this.eventBus.publish("状态:音频导出完成", wavUrl);
    } catch (e) {
      this.eventBus.publish("状态:音频导出失败", e);
    }
  });
}
```

### API 事件监听器

```typescript
private registerApiListeners() {
  this.api.playerReady.on(() => 
    this.eventBus.publish("状态:音频就绪"));
  
  this.api.error.on((err) => 
    this.eventBus.publish("状态:错误", err));
  
  this.api.playerPositionChanged.on((args) => {
    this.eventBus.publish("状态:播放位置变化", {
      currentTime: args.currentTime || 0,
      endTime: args.endTime || 0,
    });
  });
}
```

## 事件使用示例

### 组件间通信

```typescript
// 在播放控制组件中
export class PlayBar extends Component {
  constructor(private eventBus: EventBus) {}
  
  private setupEventHandlers() {
    // 订阅状态事件
    this.eventBus.subscribe("状态:播放位置变化", (data) => {
      this.updateProgress(data.currentTime, data.endTime);
    });
    
    // 发布命令事件
    this.playButton.addEventListener('click', () => {
      this.eventBus.publish("命令:播放暂停");
    });
  }
}
```

### 模态框触发

```typescript
// 在轨道选择按钮中
this.tracksButton.addEventListener('click', () => {
  this.eventBus.publish("UI:showTracksModal");
});

// 在模态框组件中
export class TracksModal extends Modal {
  constructor(private eventBus: EventBus) {
    super();
    this.eventBus.subscribe("UI:showTracksModal", () => {
      this.open();
    });
  }
}
```

## 性能优化特性

### 内存管理
事件处理器的正确清理：

```typescript
destroy() {
  // 取消所有事件订阅
  this.eventHandlers.forEach((handler, event) => {
    this.eventBus.unsubscribe(event, handler);
  });
  this.eventHandlers.clear();
}
```

### 事件去重
避免重复的事件处理：

```typescript
private eventHandlers = new Map<string, EventHandler>();

subscribeOnce(event: string, handler: EventHandler) {
  if (!this.eventHandlers.has(event)) {
    const wrappedHandler = (payload: any) => {
      handler(payload);
      this.eventBus.unsubscribe(event, wrappedHandler);
      this.eventHandlers.delete(event);
    };
    this.eventBus.subscribe(event, wrappedHandler);
    this.eventHandlers.set(event, wrappedHandler);
  }
}
```

## 错误处理

### 安全的事件发布
```typescript
safePublish(event: string, payload?: any) {
  try {
    this.eventBus.publish(event, payload);
  } catch (error) {
    console.error(`事件发布失败: ${event}`, error);
  }
}
```

### 事件处理器错误捕获
```typescript
publish(event: string, payload?: any) {
  this.handlers.get(event)?.forEach(fn => {
    try {
      fn(payload);
    } catch (error) {
      console.error(`事件处理器错误: ${event}`, error);
    }
  });
}
```

## 开发最佳实践

### 事件命名规范
- **命令事件**: `命令:[操作名称]`
- **状态事件**: `状态:[状态名称]`  
- **UI 事件**: `UI:[操作名称]`
- **轨道事件**: `track:[操作名称]`

### 事件文档化
为每个事件提供详细的文档说明：

```typescript
/**
 * 命令:播放暂停
 * 描述: 切换播放/暂停状态
 * 载荷: 无
 * 发布者: 播放控制组件
 * 订阅者: AlphaTabService
 */
```

这个事件总线系统提供了强大的组件间通信能力，支持命令触发、状态通知和用户界面交互，确保了插件各个模块之间的松耦合和高效协作。
