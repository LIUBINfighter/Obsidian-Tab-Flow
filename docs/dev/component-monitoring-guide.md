# 组件运行情况检测指南

本文档提供了 Tab Flow Player 各组件运行情况的检测方法和日志监控指南。

---

## 1. 总体检测流程

### 1.1 启动 Obsidian 开发环境

```bash
npm run dev
```

**预期输出**：
```
Build succeeded
Watching for changes...
```

### 1.2 打开 Obsidian 开发者工具

- Windows/Linux: `Ctrl + Shift + I`
- macOS: `Cmd + Option + I`

### 1.3 过滤日志

在 Console 中使用以下过滤器：
- `[ReactView]` - 查看 View 生命周期日志
- `[PlayerController]` - 查看控制器日志
- `[StoreFactory]` - 查看 Store 创建/销毁日志
- `[PluginStorage]` - 查看全局配置存储日志
- `[WorkspaceStorage]` - 查看工作区配置存储日志
- `[AlphaTab]` - 查看 AlphaTab API 日志

---

## 2. 组件生命周期检测

### 2.1 ReactView 生命周期

**检测步骤**：
1. 打开一个 `.gp`/`.gpx`/`.musicxml` 文件
2. 观察 Console 输出

**预期日志序列**：
```javascript
[ReactView] Opening view...
[StoreFactory] Creating stores for view: react-tab-view
[WorkspaceStorage] Callbacks registered
[PluginStorage] Loading from plugin data: global-config
[WorkspaceStorage] Loading from workspace: workspace-session-config
[ReactView] Stores created: { globalConfig: true, workspaceConfig: true, runtime: true, ui: true }
[ReactView] Global @font-face injected
[PlayerController] Initialized with stores: { globalConfig: true, workspaceConfig: true, runtime: true, ui: true }
[ReactView] View opened successfully
```

**异常情况处理**：
- ❌ 如果缺少 `Stores created` 日志：StoreFactory 未正常工作
- ❌ 如果缺少 `Callbacks registered` 日志：Workspace adapter 回调注入失败
- ❌ 如果出现 `Stores not initialized` 错误：Store 创建失败，检查 StoreFactory 构造

---

### 2.2 StoreFactory 创建流程

**检测重点**：
- ✅ 全局配置 adapter 创建
- ✅ 工作区配置 adapter 创建
- ✅ View 回调注入
- ✅ Runtime 和 UI store 创建

**预期日志**：
```javascript
[StoreFactory] Creating stores for view: react-tab-view
[WorkspaceStorage] Callbacks registered
[PluginStorage] Loading from plugin data: global-config
[WorkspaceStorage] Loading from workspace: workspace-session-config
```

**检测方法**：
```javascript
// 在 Console 中手动检查 stores
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
console.log(view?.stores);
// 应该输出: { globalConfig: {...}, workspaceConfig: {...}, runtime: {...}, ui: {...}, adapters: {...} }
```

---

### 2.3 PlayerController 初始化

**检测步骤**：
1. 观察 PlayerController 创建日志
2. 检查 AlphaTab API 初始化
3. 验证配置加载

**预期日志序列**：
```javascript
[PlayerController] Initialized with stores: { globalConfig: true, workspaceConfig: true, runtime: true, ui: true }
[PlayerController] Container ready, width: 800, height: 600
[PlayerController] Creating AlphaTab API...
[PlayerController] AlphaTab API created successfully
[PlayerController] Events bound to API
```

**异常情况**：
- ❌ `Container has zero dimensions` → 容器未就绪，正常会延迟初始化
- ❌ `API creation failed` → 检查 AlphaTab 资源路径（worker, soundfont, font）
- ❌ `Failed to bind API events` → 事件处理器注册失败

---

## 3. 存储适配器检测

### 3.1 全局配置存储（PluginStorageAdapter）

**存储位置**：`.obsidian/plugins/tab-flow/data.json`

**检测方法**：

**步骤1：修改全局配置**
```javascript
// 在 Console 中执行
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
view.stores.globalConfig.getState().updateAlphaTabSettings({ barsPerRow: 4 });
```

**步骤2：观察日志**
```javascript
[PluginStorage] Saving to plugin data: global-config
[PluginStorage] Saved to plugin data: global-config
```

**步骤3：验证持久化**
1. 关闭 Obsidian
2. 检查 `.obsidian/plugins/tab-flow/data.json` 文件：
```json
{
  "global-config": {
    "alphaTabSettings": {
      "barsPerRow": 4,
      ...
    },
    ...
  },
  "global-config-version": 1
}
```
3. 重新打开 Obsidian，验证配置保留

---

### 3.2 工作区配置存储（WorkspaceStorageAdapter）

**存储位置**：`.obsidian/workspace.json` (或 `workspace-mobile.json`)

**检测方法**：

**步骤1：打开一个 Tab 文件**
```javascript
// 观察日志
[WorkspaceStorage] Loaded from workspace: workspace-session-config not found
[WorkspaceStorage] Loading from workspace: workspace-session-config not found
```

**步骤2：设置 AB 循环**
```javascript
// 在 Console 中执行
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
view.stores.workspaceConfig.getState().setLoopRange({ startBar: 1, endBar: 4 });
```

**步骤3：观察日志**
```javascript
[WorkspaceStorage] Saved to workspace: workspace-session-config
```

**步骤4：验证会话隔离**
1. 在新窗格中打开同一文件
2. 两个标签页的 AB 循环设置应该**独立**
3. 检查 Console：
```javascript
// Tab 1
view1.stores.workspaceConfig.getState().sessionPlayerState.loopRange
// { startBar: 1, endBar: 4 }

// Tab 2
view2.stores.workspaceConfig.getState().sessionPlayerState.loopRange
// null (默认值)
```

**步骤5：验证标签页关闭清除**
1. 关闭其中一个标签页
2. 观察日志：
```javascript
[ReactView] Closing view...
[ReactView] PlayerController destroyed
[ReactView] Stores destroyed
[WorkspaceStorage] Callbacks cleared
[ReactView] View closed
```
3. 重新打开文件，AB 循环应该被清除

---

## 4. 配置分离验证

### 4.1 跨工作区配置共享

**测试场景**：全局配置应该在不同工作区之间共享

**步骤**：
1. 打开工作区 A，修改全局设置（如 `barsPerRow: 4`）
2. 关闭工作区 A
3. 打开工作区 B
4. 检查全局设置是否保留

**验证方法**：
```javascript
// 工作区 B 的 Console
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
console.log(view.stores.globalConfig.getState().alphaTabSettings.barsPerRow);
// 应该输出: 4
```

---

### 4.2 工作区配置隔离

**测试场景**：工作区会话配置应该**不**在工作区之间共享

**步骤**：
1. 工作区 A 中设置 AB 循环（1-4 小节）
2. 切换到工作区 B，打开同一文件
3. 检查 AB 循环应该为 `null`

**验证方法**：
```javascript
// 工作区 B 的 Console
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
console.log(view.stores.workspaceConfig.getState().sessionPlayerState.loopRange);
// 应该输出: null
```

---

## 5. Runtime Store 状态同步检测

### 5.1 播放状态同步

**检测步骤**：
1. 加载一个乐谱文件
2. 点击播放按钮
3. 观察 Runtime Store 状态变化

**预期日志**：
```javascript
// 乐谱加载
[PlayerController] Score loaded successfully
// Runtime Store 更新
runtime.setScoreLoaded(true)
runtime.setDuration(120000) // 120 秒

// 播放开始
[PlayerController] Play requested
runtime.setPlaybackState('playing')

// 播放进度更新
runtime.setPosition(1500) // 1.5 秒
runtime.setCurrentBeat({ bar: 2, beat: 1 })

// 播放结束
runtime.setPlaybackState('paused')
```

**检测方法**：
```javascript
// 在 Console 中订阅状态变化
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
view.stores.runtime.subscribe(
  (state) => state.playbackState,
  (playbackState) => console.log('Playback State:', playbackState)
);
```

---

### 5.2 AlphaTab API 事件绑定

**检测重点**：
- ✅ `scoreLoaded` 事件 → `setScoreLoaded(true)`
- ✅ `renderFinished` 事件 → `setApiReady(true)`
- ✅ `playerStateChanged` 事件 → `setPlaybackState(...)`
- ✅ `playerPositionChanged` 事件 → `setPosition(...)`, `setCurrentBeat(...)`

**验证方法**：
```javascript
// 检查事件处理器是否绑定
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
const controller = view.controller;
console.log(controller.eventHandlers); // 应该显示已绑定的事件
```

---

## 6. UI Store 状态管理检测

### 6.1 Loading 状态

**检测步骤**：
1. 加载一个大的 `.gp` 文件
2. 观察 Loading indicator

**预期状态变化**：
```javascript
// 加载开始
ui.setLoading(true, 'Loading score...')

// 加载完成
ui.setLoading(false)
```

---

### 6.2 Toast 通知

**检测步骤**：
1. 触发错误（如加载无效文件）
2. 观察 Toast 通知

**预期行为**：
```javascript
// 错误情况
ui.showToast('error', 'Failed to load score')

// 成功情况
ui.showToast('success', 'Score loaded successfully')
```

**验证方法**：
```javascript
// 手动触发 Toast
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
view.stores.ui.getState().showToast('info', 'Test message', 3000);
```

---

## 7. 常见问题排查

### 问题 1: Stores 未创建

**症状**：
```
[ReactView] Stores not initialized! Cannot create controller.
```

**排查步骤**：
1. 检查 `StoreFactory` 是否正确导入
2. 检查 `createStores()` 是否在 `onOpen()` 中调用
3. 检查 Plugin 实例是否正确传递

**解决方案**：
```typescript
// 确保 ReactView 构造函数中初始化了 StoreFactory
this.storeFactory = new StoreFactory(plugin);

// 确保 onOpen 中创建了 stores
this.stores = this.storeFactory.createStores(this);
```

---

### 问题 2: Workspace 回调未注册

**症状**：
```
[WorkspaceStorage] Save skipped - callbacks not registered: workspace-session-config
```

**排查步骤**：
1. 检查 `setCallbacks()` 是否在 `createStores()` 中调用
2. 检查 View 的 `getState()` 和 `setState()` 方法是否存在

**解决方案**：
```typescript
// 在 StoreFactory.createStores() 中
workspaceAdapter.setCallbacks({
  getViewState: () => view.getState(),
  setViewState: async (state: any, result: any) => {
    // @ts-ignore
    await view.setState(state, result);
  },
});
```

---

### 问题 3: 配置未持久化

**症状**：
- 关闭 Obsidian 后配置丢失
- 工作区切换后配置丢失

**排查步骤**：
1. 检查 `.obsidian/plugins/tab-flow/data.json` 是否存在
2. 检查 Console 是否有 `Saved to plugin data` 日志
3. 检查 `save()` 方法是否被调用

**解决方案**：
```javascript
// 手动触发保存测试
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
await view.stores.adapters.plugin.save('test-key', { value: 'test' });
// 观察日志: [PluginStorage] Saved to plugin data: test-key
```

---

### 问题 4: 多标签页状态冲突

**症状**：
- 两个标签页的 AB 循环设置互相影响
- 播放状态在标签页之间同步

**排查步骤**：
1. 确认每个 View 都有独立的 `StoreCollection`
2. 确认 Runtime 和 UI stores 是独立创建的（不是共享的）

**验证方法**：
```javascript
// 打开两个标签页
const views = app.workspace.getLeavesOfType('react-tab-view').map(leaf => leaf.view);
console.log(views[0].stores.runtime === views[1].stores.runtime);
// 应该输出: false（说明是独立的实例）
```

---

## 8. 性能监控

### 8.1 Store 更新频率

**监控方法**：
```javascript
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
let updateCount = 0;
view.stores.runtime.subscribe(() => {
  updateCount++;
  console.log('Runtime Store updates:', updateCount);
});
```

**正常频率**：
- 播放时：约每 100ms 更新一次（位置更新）
- 空闲时：几乎没有更新

---

### 8.2 存储适配器性能

**监控点**：
- ✅ `save()` 操作不应阻塞 UI
- ✅ `load()` 操作应在 100ms 内完成

**测试方法**：
```javascript
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
console.time('save');
await view.stores.adapters.plugin.save('perf-test', { large: new Array(1000).fill('data') });
console.timeEnd('save');
// 应该 < 50ms
```

---

## 9. 自动化测试脚本

### 9.1 完整生命周期测试

将以下脚本粘贴到 Console 中：

```javascript
(async function testLifecycle() {
  console.group('🔍 Tab Flow Player - Lifecycle Test');
  
  // 1. 获取当前 View
  const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
  if (!view) {
    console.error('❌ No active ReactView found');
    return;
  }
  console.log('✅ ReactView found');
  
  // 2. 检查 Stores
  const stores = view.stores;
  if (!stores) {
    console.error('❌ Stores not initialized');
    return;
  }
  console.log('✅ Stores initialized:', {
    globalConfig: !!stores.globalConfig,
    workspaceConfig: !!stores.workspaceConfig,
    runtime: !!stores.runtime,
    ui: !!stores.ui,
  });
  
  // 3. 检查 Adapters
  console.log('✅ Adapters:', {
    plugin: !!stores.adapters.plugin,
    workspace: !!stores.adapters.workspace,
  });
  
  // 4. 测试全局配置
  console.time('Global Config Save');
  stores.globalConfig.getState().updateAlphaTabSettings({ barsPerRow: 4 });
  await new Promise(resolve => setTimeout(resolve, 100)); // 等待保存
  console.timeEnd('Global Config Save');
  console.log('✅ Global config updated');
  
  // 5. 测试工作区配置
  console.time('Workspace Config Save');
  stores.workspaceConfig.getState().setLoopRange({ startBar: 1, endBar: 4 });
  await new Promise(resolve => setTimeout(resolve, 100)); // 等待保存
  console.timeEnd('Workspace Config Save');
  console.log('✅ Workspace config updated');
  
  // 6. 检查 PlayerController
  const controller = view.controller;
  if (!controller) {
    console.error('❌ PlayerController not found');
    return;
  }
  console.log('✅ PlayerController initialized');
  
  // 7. 检查 Runtime Store
  const runtimeState = stores.runtime.getState();
  console.log('✅ Runtime State:', {
    apiReady: runtimeState.apiReady,
    scoreLoaded: runtimeState.scoreLoaded,
    playbackState: runtimeState.playbackState,
  });
  
  console.groupEnd();
  console.log('🎉 All checks passed!');
})();
```

---

### 9.2 配置持久化测试

```javascript
(async function testPersistence() {
  console.group('💾 Storage Persistence Test');
  
  const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
  const stores = view.stores;
  
  // 测试数据
  const testConfig = {
    barsPerRow: 99,
    stretchForce: 0.5,
  };
  
  // 1. 保存配置
  console.log('1️⃣ Saving test config...');
  stores.globalConfig.getState().updateAlphaTabSettings(testConfig);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 2. 读取配置
  console.log('2️⃣ Reading config...');
  const saved = stores.globalConfig.getState().alphaTabSettings;
  console.log('Saved config:', {
    barsPerRow: saved.barsPerRow,
    stretchForce: saved.stretchForce,
  });
  
  // 3. 验证
  const matches = saved.barsPerRow === testConfig.barsPerRow && 
                  saved.stretchForce === testConfig.stretchForce;
  
  if (matches) {
    console.log('✅ Config persistence test PASSED');
  } else {
    console.error('❌ Config persistence test FAILED');
  }
  
  console.groupEnd();
})();
```

---

## 10. 总结

### 关键监控点

| 组件 | 关键日志 | 检测方法 |
|------|---------|----------|
| ReactView | `Opening view...` → `View opened successfully` | 观察 Console |
| StoreFactory | `Creating stores` → `Stores created` | 观察 Console |
| PluginStorageAdapter | `Saved to plugin data` | 检查 `data.json` |
| WorkspaceStorageAdapter | `Saved to workspace` | 检查 `workspace.json` |
| PlayerController | `Initialized with stores` | 观察 Console |
| Runtime Store | 播放状态变化 | 订阅状态 |
| UI Store | Loading/Toast 显示 | 视觉观察 |

### 快速诊断命令

```javascript
// 检查当前 View 状态
const view = app.workspace.getActiveViewOfType(require('./player/ReactView').ReactView);
console.log({
  stores: !!view?.stores,
  controller: !!view?.controller,
  globalConfig: view?.stores?.globalConfig?.getState?.(),
  workspaceConfig: view?.stores?.workspaceConfig?.getState?.(),
  runtime: view?.stores?.runtime?.getState?.(),
  ui: view?.stores?.ui?.getState?.(),
});
```

---

**文档版本**: 1.0  
**最后更新**: 2025-10-15  
**适用版本**: Tab Flow v0.3.0+
