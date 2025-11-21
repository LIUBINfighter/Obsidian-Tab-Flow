---
title: Player 自定义指南
description: 如何自定义 Player 组件并与状态管理和持久化框架结合
date: 2024-12-19
tags: [player, customization, state-management]
---

# Player 自定义指南

## 概述

本文档说明如何自定义 Player 组件，包括：
1. 通过配置选项控制组件显示
2. 创建自定义组件
3. 与状态管理和持久化框架结合

## 1. 通过配置选项控制组件显示

### 基本用法

```typescript
import { TablatureView, type TablatureViewOptions } from './player/components/TablatureView';

// 不显示 DebugBar
const options: TablatureViewOptions = {
  showDebugBar: false,
  showPlayBar: true,
  showSettingsPanel: true,
  showTracksPanel: true,
  showMediaSync: true,
};

React.createElement(TablatureView, {
  controller: playerController,
  options: options,
});
```

### 配置选项说明

- `showDebugBar`: 是否显示调试栏（默认：true）
- `showPlayBar`: 是否显示播放控制栏（默认：true）
- `showSettingsPanel`: 是否显示设置面板（默认：true）
- `showTracksPanel`: 是否显示音轨面板（默认：true）
- `showMediaSync`: 是否显示媒体同步面板（默认：true）

## 2. 创建自定义组件

### 自定义顶部组件

```typescript
import React from 'react';
import type { PlayerController } from '../PlayerController';

interface CustomTopBarProps {
  controller: PlayerController;
}

export const CustomTopBar: React.FC<CustomTopBarProps> = ({ controller }) => {
  const runtimeStore = controller.getRuntimeStore();
  const api = runtimeStore((s) => s.alphaTabApi);
  
  return (
    <div className="custom-top-bar">
      <button onClick={() => controller.play()}>播放</button>
      <button onClick={() => controller.pause()}>暂停</button>
      {/* 你的自定义 UI */}
    </div>
  );
};

// 使用
const options: TablatureViewOptions = {
  showDebugBar: false,
  customComponents: {
    topBar: CustomTopBar,
  },
};
```

### 自定义底部组件

```typescript
export const CustomBottomBar: React.FC<CustomTopBarProps> = ({ controller }) => {
  // 访问状态
  const runtimeStore = controller.getRuntimeStore();
  const isPlaying = runtimeStore((s) => s.isPlaying);
  const currentTime = runtimeStore((s) => s.currentTime);
  
  return (
    <div className="custom-bottom-bar">
      <span>{currentTime}</span>
      <button onClick={() => isPlaying ? controller.pause() : controller.play()}>
        {isPlaying ? '暂停' : '播放'}
      </button>
    </div>
  );
};
```

## 3. 与状态管理框架结合

### 状态管理架构

Player 使用 Zustand 进行状态管理，包含以下 stores：

1. **GlobalConfigStore** - 全局配置（跨工作区，持久化到插件设置）
2. **WorkspaceConfigStore** - 工作区配置（每个视图独立，持久化到视图状态）
3. **RuntimeStore** - 运行时状态（不持久化）
4. **UIStore** - UI 状态（不持久化）

### 访问状态

```typescript
// 在自定义组件中访问状态
const CustomComponent: React.FC<{ controller: PlayerController }> = ({ controller }) => {
  // 获取 stores
  const globalConfig = controller.getGlobalConfigStore();
  const workspaceConfig = controller.getWorkspaceConfigStore();
  const runtimeStore = controller.getRuntimeStore();
  const uiStore = controller.getUIStore();
  
  // 订阅状态
  const scale = globalConfig((s) => s.alphaTabSettings.display.scale);
  const isPlaying = runtimeStore((s) => s.isPlaying);
  const settingsOpen = uiStore((s) => s.panels.settingsPanel);
  
  // 更新状态
  const handleScaleChange = (newScale: number) => {
    globalConfig.getState().updateAlphaTabSettings({
      display: {
        ...globalConfig.getState().alphaTabSettings.display,
        scale: newScale,
      },
    });
  };
  
  return (
    <div>
      <input
        type="range"
        min="0.5"
        max="2.0"
        step="0.1"
        value={scale}
        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
      />
    </div>
  );
};
```

### 持久化自定义配置

#### 方式 1: 使用 GlobalConfigStore（全局配置）

```typescript
// 扩展 GlobalConfig 接口
interface CustomGlobalConfig extends GlobalConfig {
  customSettings: {
    myCustomOption: boolean;
    myCustomValue: number;
  };
}

// 在自定义组件中使用
const globalConfig = controller.getGlobalConfigStore();
const myOption = globalConfig((s) => (s as CustomGlobalConfig).customSettings?.myCustomOption);

// 更新配置（会自动持久化）
globalConfig.getState().updateAlphaTabSettings({
  // ... 现有配置
});
```

#### 方式 2: 使用 WorkspaceConfigStore（工作区配置）

```typescript
// 工作区配置会自动持久化到视图状态
const workspaceConfig = controller.getWorkspaceConfigStore();

// 读取配置
const customData = workspaceConfig.getState().customData;

// 更新配置
workspaceConfig.setState({
  customData: {
    myOption: true,
    myValue: 100,
  },
});
```

#### 方式 3: 使用 UIStore（临时状态）

```typescript
// UIStore 不持久化，适合临时 UI 状态
const uiStore = controller.getUIStore();

// 管理自定义面板
uiStore.getState().showPanel('myCustomPanel');
uiStore.getState().hidePanel('myCustomPanel');
```

## 4. 完整示例：自定义播放器

```typescript
import React from 'react';
import { TablatureView, type TablatureViewOptions } from './player/components/TablatureView';
import type { PlayerController } from './player/PlayerController';

// 自定义顶部栏
const MinimalTopBar: React.FC<{ controller: PlayerController }> = ({ controller }) => {
  const runtimeStore = controller.getRuntimeStore();
  const isPlaying = runtimeStore((s) => s.isPlaying);
  
  return (
    <div style={{ padding: '8px', borderBottom: '1px solid var(--background-modifier-border)' }}>
      <button onClick={() => isPlaying ? controller.pause() : controller.play()}>
        {isPlaying ? '⏸' : '▶'}
      </button>
    </div>
  );
};

// 自定义底部栏
const MinimalBottomBar: React.FC<{ controller: PlayerController }> = ({ controller }) => {
  const runtimeStore = controller.getRuntimeStore();
  const currentTime = runtimeStore((s) => s.currentTime);
  const duration = runtimeStore((s) => s.duration);
  
  return (
    <div style={{ padding: '8px', borderTop: '1px solid var(--background-modifier-border)' }}>
      <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
    </div>
  );
};

// 使用自定义配置
const customOptions: TablatureViewOptions = {
  showDebugBar: false,
  showPlayBar: false,
  showSettingsPanel: false,
  showTracksPanel: false,
  showMediaSync: false,
  customComponents: {
    topBar: MinimalTopBar,
    bottomBar: MinimalBottomBar,
  },
};

// 渲染
React.createElement(TablatureView, {
  controller: playerController,
  options: customOptions,
});
```

## 5. 与现有系统集成

### 在 EditorView 中使用

```typescript
// src/views/EditorView.ts
this.playerRoot.render(
  React.createElement(TablatureView, {
    controller: this.playerController,
    options: {
      showDebugBar: false, // EditorView 中不显示 DebugBar
      showPlayBar: true,
      showSettingsPanel: true,
      showTracksPanel: true,
      showMediaSync: true,
    },
  })
);
```

### 在 ReactView 中使用

```typescript
// src/player/ReactView.ts
this.root.render(
  React.createElement(TablatureView, {
    controller: this.controller,
    options: {
      showDebugBar: true, // ReactView 中显示 DebugBar
      // 其他配置...
    },
  })
);
```

## 6. 最佳实践

1. **状态管理**：
   - 使用 `GlobalConfigStore` 存储全局设置（如主题、默认值）
   - 使用 `WorkspaceConfigStore` 存储视图特定设置（如当前文件、布局）
   - 使用 `RuntimeStore` 存储运行时状态（如播放状态、当前时间）
   - 使用 `UIStore` 存储临时 UI 状态（如面板显示/隐藏）

2. **组件设计**：
   - 自定义组件应该接收 `controller` 作为 props
   - 通过 controller 访问所有 stores 和 API
   - 使用 React hooks 订阅状态变化

3. **持久化**：
   - 需要持久化的配置使用 `GlobalConfigStore` 或 `WorkspaceConfigStore`
   - 临时状态使用 `RuntimeStore` 或 `UIStore`
   - 配置更新会自动触发持久化

4. **性能**：
   - 使用 Zustand 的选择器函数避免不必要的重渲染
   - 例如：`const scale = globalConfig((s) => s.alphaTabSettings.display.scale)`

## 7. 扩展点

### 添加新的 Store

如果需要添加新的状态管理：

1. 在 `src/player/store/` 创建新的 store 文件
2. 在 `StoreFactory` 中创建和注册
3. 在 `PlayerController` 中添加访问方法
4. 在自定义组件中使用

### 添加新的配置选项

1. 扩展 `TablatureViewOptions` 接口
2. 在 `TablatureView` 中处理新选项
3. 更新相关文档

## 总结

通过 `TablatureViewOptions` 接口，你可以：
- ✅ 控制哪些组件显示/隐藏
- ✅ 替换默认组件为自定义组件
- ✅ 添加额外的自定义组件
- ✅ 与现有的状态管理和持久化框架无缝集成

所有自定义组件都可以通过 `PlayerController` 访问完整的状态管理和 API，实现高度自定义的播放器界面。

