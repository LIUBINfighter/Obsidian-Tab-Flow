# Storage Bridge Layer - 实现完成文档

## 概述

已完成存储桥接层的实现，将持久化逻辑从 `localStorage` (zustand/persist) 迁移到 Obsidian 原生 API，支持全局配置和工作区会话配置的分离存储。

---

## 架构设计

### 核心理念

**适配器模式 (Adapter Pattern)**  
通过抽象存储接口（`IStorageAdapter`），解耦业务逻辑与具体存储实现，支持未来迁移到其他平台（如 VS Code Extension）。

```
┌─────────────────────────────────────────────────┐
│            Zustand Stores (业务层)               │
│  ┌────────────────────┬────────────────────┐   │
│  │ Global Config      │ Workspace Config   │   │
│  │ (跨工作区)          │ (标签页特定)        │   │
│  └────────────────────┴────────────────────┘   │
│                   ↓                             │
│        Custom Middleware (storageAdapter)       │
│                   ↓                             │
│           IStorageAdapter Interface             │
└─────────────────────────────────────────────────┘
                      ↓
    ┌─────────────────────────────────────┐
    │      Storage Adapters (平台层)       │
    ├─────────────────┬───────────────────┤
    │ PluginAdapter   │ WorkspaceAdapter  │
    │ (data.json)     │ (workspace.json)  │
    └─────────────────┴───────────────────┘
```

---

## 创建的文件

### 1. 存储接口层

#### `src/player/storage/IStorageAdapter.ts`
```typescript
interface IStorageAdapter {
    save<T>(key: string, data: T): Promise<void>;
    load<T>(key: string): Promise<T | null>;
    remove(key: string): Promise<void>;
    clear?(): Promise<void>;
}
```

**职责**：定义平台无关的存储抽象

---

### 2. 存储适配器实现

#### `src/player/storage/adapters/ObsidianPluginStorageAdapter.ts`

**存储目标**：`Plugin.saveData()` / `Plugin.loadData()`  
**数据位置**：`.obsidian/plugins/tab-flow/data.json`  
**生命周期**：插件全局，跨所有工作区  
**用途**：存储全局配置（alphaTab 设置、UI 主题等）

**核心实现**：
```typescript
async save<T>(key: string, data: T): Promise<void> {
    const current = await this.plugin.loadData() || {};
    current[key] = data;
    await this.plugin.saveData(current);
}
```

---

#### `src/player/storage/adapters/ObsidianWorkspaceStorageAdapter.ts`

**存储目标**：`View.setState()` / `View.getState()`  
**数据位置**：`.obsidian/workspace.json` (或 workspace-mobile.json)  
**生命周期**：工作区会话，标签页关闭即清除  
**用途**：存储会话配置（当前文件、AB循环范围等）

**核心实现**：
```typescript
// 注入回调模式（避免循环依赖）
setCallbacks(callbacks: WorkspaceStorageCallbacks): void {
    this.callbacks = callbacks;
}

async save<T>(key: string, data: T): Promise<void> {
    const current = this.callbacks.getViewState() || {};
    current[key] = data;
    await this.callbacks.setViewState(current, {});
}
```

**依赖注入设计**：  
由于 Adapter 不能直接依赖 View（会造成循环引用），采用**回调注入模式**：
- View 创建时调用 `adapter.setCallbacks()`
- View 销毁时调用 `adapter.clearCallbacks()`

---

### 3. 配置 Schema 分离

#### `src/player/types/global-config-schema.ts`

**全局配置（跨工作区）**：
```typescript
interface GlobalConfig {
    alphaTabSettings: GlobalAlphaTabSettings;  // 布局、滚动模式、缩放
    playerExtensions: GlobalPlayerExtensions;  // countIn、metronome、looping
    uiConfig: UIConfig;                        // 主题、快捷键绑定
}
```

**修正的默认值**：
- `barsPerRow: -1` (自动计算，替代旧版的 `null`)
- `stretchForce: 1.0` (无拉伸，替代旧版的 `0.8`)

---

#### `src/player/types/workspace-config-schema.ts`

**工作区会话配置（标签页特定）**：
```typescript
interface WorkspaceSessionConfig {
    scoreSource: ScoreSource;              // 当前文件/URL/AlphaTeX
    sessionPlayerState: SessionPlayerState; // AB循环、播放位置
}
```

**设计原则**：
- 文件路径、当前乐谱来源应该随标签页关闭而清除
- AB 循环范围是文件特定的，不应该跨文件持久化

---

### 4. Zustand Middleware

#### `src/player/store/middleware/storageAdapter.ts`

**核心功能**：
1. **异步加载**：Store 创建时从 adapter 加载初始状态
2. **自动保存**：状态变化时自动调用 `adapter.save()`
3. **版本迁移**：支持配置 `migrate` 函数处理历史数据

**签名**：
```typescript
storageAdapter<T>(
    adapter: IStorageAdapter,
    options: {
        name: string;
        version?: number;
        migrate?: (persistedState: any, version: number) => any;
    },
    config: StateCreator<T, [], []>
): StateCreator<T, [], []>
```

**替代**：`zustand/persist` (绑定 localStorage)

---

### 5. Store 实现

#### `src/player/store/globalConfigStore.ts`

**工厂函数**：
```typescript
createGlobalConfigStore(adapter: ObsidianPluginStorageAdapter)
    => UseBoundStore<StoreApi<GlobalConfigState>>
```

**Actions**：
- `updateAlphaTabSettings(settings: Partial<...>)`
- `updatePlayerExtensions(extensions: Partial<...>)`
- `updateUIConfig(config: Partial<...>)`
- `resetToDefaults()`

**持久化**：使用 `storageAdapter` middleware + `ObsidianPluginStorageAdapter`

---

#### `src/player/store/workspaceConfigStore.ts`

**工厂函数**：
```typescript
createWorkspaceConfigStore(adapter: ObsidianWorkspaceStorageAdapter)
    => UseBoundStore<StoreApi<WorkspaceConfigState>>
```

**Actions**：
- `setScoreSource(source: ScoreSource)`
- `updatePlayerState(state: Partial<...>)`
- `setLoopRange(range: { startBar, endBar } | null)`
- `toggleLooping()`
- `resetToDefaults()`

**持久化**：使用 `storageAdapter` middleware + `ObsidianWorkspaceStorageAdapter`

---

### 6. Store Factory

#### `src/player/store/StoreFactory.ts`

**职责**：
1. 统一管理所有 Store 的创建
2. 注入依赖（Plugin、View）
3. 管理生命周期（销毁时清理回调）

**核心方法**：
```typescript
class StoreFactory {
    createStores(view: ItemView): StoreCollection {
        // 1. 创建适配器
        const pluginAdapter = new ObsidianPluginStorageAdapter(this.plugin);
        const workspaceAdapter = new ObsidianWorkspaceStorageAdapter();
        
        // 2. 注入 View 回调
        workspaceAdapter.setCallbacks({
            getViewState: () => view.getState(),
            setViewState: async (state, result) => {
                await view.setState(state, result);
            },
        });
        
        // 3. 创建 Stores
        const globalConfig = createGlobalConfigStore(pluginAdapter);
        const workspaceConfig = createWorkspaceConfigStore(workspaceAdapter);
        const runtime = createRuntimeStore();
        const ui = createUIStore();
        
        return { globalConfig, workspaceConfig, runtime, ui, adapters };
    }
    
    destroyStores(stores: StoreCollection): void {
        stores.adapters.workspace.clearCallbacks();
    }
}
```

**返回类型**：
```typescript
interface StoreCollection {
    globalConfig: GlobalConfigStore;
    workspaceConfig: WorkspaceConfigStore;
    runtime: UseBoundStore<StoreApi<RuntimeStore>>;
    ui: UseBoundStore<StoreApi<UIStore>>;
    adapters: { plugin, workspace };
}
```

---

## 技术细节

### 版本迁移机制

**Storage 键结构**：
- 数据键：`global-config` / `workspace-session-config`
- 版本键：`global-config-version` / `workspace-session-config-version`

**迁移流程**：
```typescript
// 1. 加载持久化的版本号
const persistedVersion = await adapter.load<number>(`${name}-version`);
let persistedState = await adapter.load<any>(name);

// 2. 如果版本不匹配，调用 migrate
if (migrate && persistedVersion < currentVersion) {
    persistedState = migrate(persistedState, persistedVersion);
}

// 3. 合并到 Store
set(persistedState);
```

**示例迁移函数**：
```typescript
migrate: (persistedState: any, version: number) => {
    if (version === 0) {
        // 从旧版本迁移
        return { ...getDefaultGlobalConfig(), ...persistedState };
    }
    return persistedState;
}
```

---

### 回调注入模式

**问题**：Adapter 需要调用 View 的方法，但不能直接依赖 View（循环引用）

**解决方案**：
```typescript
// Adapter 定义回调接口
interface WorkspaceStorageCallbacks {
    getViewState: () => any;
    setViewState: (state: any, result: any) => Promise<void>;
}

// View 创建时注入
class StoreFactory {
    createStores(view: ItemView) {
        workspaceAdapter.setCallbacks({
            getViewState: () => view.getState(),
            setViewState: async (state, result) => {
                await view.setState(state, result);
            },
        });
    }
}

// View 销毁时清理
destroyStores(stores: StoreCollection) {
    stores.adapters.workspace.clearCallbacks();
}
```

---

## 文件清单

```
src/player/
├── storage/
│   ├── IStorageAdapter.ts                          # 存储接口
│   └── adapters/
│       ├── ObsidianPluginStorageAdapter.ts         # 全局存储实现
│       └── ObsidianWorkspaceStorageAdapter.ts      # 工作区存储实现
├── types/
│   ├── global-config-schema.ts                     # 全局配置 Schema
│   └── workspace-config-schema.ts                  # 工作区配置 Schema
└── store/
    ├── middleware/
    │   └── storageAdapter.ts                       # Zustand 中间件
    ├── globalConfigStore.ts                        # 全局配置 Store
    ├── workspaceConfigStore.ts                     # 工作区配置 Store
    └── StoreFactory.ts                             # Store 工厂
```

---

## 后续工作

### 1. 集成到现有代码

**需要更新的文件**：
- [ ] `src/player/PlayerController.ts`
  - 使用 `StoreFactory.createStores()` 替代直接创建 stores
  - 使用 `globalConfig` 和 `workspaceConfig` 替代旧的 `configStore`
  
- [ ] `src/views/ReactView.tsx` 或 `TabView.ts`
  - 在 View 创建时调用 `storeFactory.createStores(this)`
  - 在 View 销毁时调用 `storeFactory.destroyStores(stores)`

### 2. 数据迁移

**从旧版 localStorage 迁移到新版**：
```typescript
// 在 Plugin.onload() 中执行一次性迁移
const oldConfigStore = useConfigStore.getState();
if (oldConfigStore.version === 2) {
    // 迁移到 globalConfigStore
    globalConfig.getState().updateAlphaTabSettings({
        barsPerRow: oldConfigStore.barsPerRow,
        stretchForce: oldConfigStore.stretchForce,
        // ...
    });
    
    // 清除旧数据
    localStorage.removeItem('config-store');
}
```

### 3. 测试计划

- [ ] **全局配置持久化测试**
  - 修改 alphaTab 设置
  - 关闭工作区
  - 重新打开，验证设置保留
  
- [ ] **工作区配置隔离测试**
  - 在两个工作区打开同一文件
  - 设置不同的 AB 循环范围
  - 验证两个标签页独立保存
  
- [ ] **标签页关闭清除测试**
  - 设置 AB 循环
  - 关闭标签页
  - 重新打开，验证 AB 循环已清除
  
- [ ] **版本迁移测试**
  - 模拟旧版本数据
  - 加载时验证 migrate 函数被调用
  - 验证数据正确迁移

---

## 优势总结

### 1. **平台无关性**
- 抽象存储接口使得代码可以轻松迁移到其他平台（VS Code、Web）
- 只需实现新的 Adapter，无需修改业务逻辑

### 2. **配置分离**
- 全局配置（跨工作区）与会话配置（标签页特定）明确分离
- 避免了跨标签页状态污染

### 3. **类型安全**
- 所有配置都有明确的 TypeScript 类型定义
- Schema 文件提供单一数据源（SSOT）

### 4. **可测试性**
- Adapter 可以轻松 mock
- Store 创建与使用解耦

### 5. **可维护性**
- 清晰的职责划分（接口 → 适配器 → 中间件 → Store）
- 版本迁移机制支持未来配置结构变更

---

## 关键决策记录

| 决策点                   | 选择                         | 原因                                      |
|--------------------------|------------------------------|-------------------------------------------|
| 存储抽象方式             | Adapter Pattern              | 支持多平台，解耦业务与存储实现            |
| 配置分离策略             | Global vs Workspace          | 避免跨工作区状态污染，符合 Obsidian 语义 |
| View 依赖注入方式        | Callback Injection           | 避免循环依赖，保持 Adapter 独立性         |
| Zustand 持久化方案       | Custom Middleware            | 完全控制存储逻辑，支持异步加载            |
| 版本管理机制             | 独立版本键 + migrate 函数    | 支持配置结构演进，向后兼容                |
| Factory 模式             | StoreFactory Class           | 统一生命周期管理，简化 View 集成代码      |

---

## 示例用法

### View 中使用

```typescript
import { StoreFactory, type StoreCollection } from '../player/store/StoreFactory';

class MyView extends ItemView {
    private stores: StoreCollection;
    
    async onOpen() {
        // 创建 stores
        const factory = new StoreFactory(this.plugin);
        this.stores = factory.createStores(this);
        
        // 使用 globalConfig
        this.stores.globalConfig.getState().updateAlphaTabSettings({
            barsPerRow: -1,
            stretchForce: 1.0,
        });
        
        // 使用 workspaceConfig
        this.stores.workspaceConfig.getState().setLoopRange({
            startBar: 1,
            endBar: 4,
        });
    }
    
    async onClose() {
        // 清理
        new StoreFactory(this.plugin).destroyStores(this.stores);
    }
}
```

### 订阅状态变化

```typescript
// 订阅全局配置变化
const unsubscribe = stores.globalConfig.subscribe(
    (state) => state.alphaTabSettings,
    (settings) => {
        console.log('AlphaTab settings changed:', settings);
    }
);

// 取消订阅
unsubscribe();
```

---

**实现状态**：✅ 已完成  
**测试状态**：⏳ 待测试  
**集成状态**：⏳ 待集成

