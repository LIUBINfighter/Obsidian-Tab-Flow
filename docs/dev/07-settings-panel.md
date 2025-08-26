# 设置面板系统

## 相关代码文件
- `src/settings/SettingTab.ts` - 主设置选项卡
- `src/settings/tabs/generalTab.ts` - 通用设置选项卡
- `src/settings/tabs/playerTab.ts` - 播放器设置选项卡
- `src/settings/tabs/aboutTab.ts` - 关于选项卡
- `src/settings/defaults.ts` - 默认设置配置

## 设置面板架构

### 主设置选项卡 (SettingTab)

`SettingTab` 类管理整个插件的设置界面，采用选项卡式设计：

#### 核心功能
- **选项卡导航**: 支持多个设置页签切换
- **动态加载**: 按需加载子选项卡模块
- **事件处理**: 支持外部事件触发的页签切换

#### 初始化配置
```typescript
export class SettingTab extends PluginSettingTab {
  plugin: TabFlowPlugin;
  private _eventBound = false;

  constructor(app: App, plugin: TabFlowPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    
    // 绑定外部事件
    if (!this._eventBound) {
      this.app.workspace.on("tabflow:open-plugin-settings-player", async () => {
        try {
          // 打开设置面板并定位到播放器页签
          (this.app as any).setting?.open?.();
          (this.app as any).setting?.openTabById?.(this.plugin.manifest.id);
          (this as any)._forceActiveInnerTab = "player";
          await this.display();
        } catch {}
      });
      this._eventBound = true;
    }
  }
}
```

### 选项卡式界面设计

#### DOM 结构创建
```typescript
async display(): Promise<void> {
  const { containerEl } = this;
  containerEl.empty();

  // 创建选项卡容器
  const tabsEl = containerEl.createDiv({ cls: "itabs-settings-tabs" });
  const contentsEl = containerEl.createDiv({ cls: "itabs-settings-contents" });

  // 选项卡定义
  const tabList = [
    { id: "general", name: "资产管理" },
    { id: "player", name: "播放器配置" },
    { id: "about", name: "关于" },
  ];

  // 选项卡渲染逻辑
  let activeTab = (this as any)._forceActiveInnerTab || "general";
  (this as any)._forceActiveInnerTab = undefined;

  const renderTab = async (tabId: string) => {
    contentsEl.empty();
    
    if (tabId === "general") {
      const mod = await import("./tabs/generalTab");
      await mod.renderGeneralTab(contentsEl, this.plugin, this.app, renderTab);
    } else if (tabId === "player") {
      const mod = await import("./tabs/playerTab");
      await mod.renderPlayerTab(contentsEl, this.plugin, this.app);
    } else if (tabId === "about") {
      const mod = await import("./tabs/aboutTab");
      await mod.renderAboutTab(contentsEl, this.plugin, this.app);
    }
  };

  // 创建选项卡按钮
  tabList.forEach((tab) => {
    const tabEl = tabsEl.createEl("button", { 
      text: tab.name, 
      cls: ["itabs-settings-tab", tab.id === activeTab ? "active" : ""] 
    });
    
    tabEl.onclick = async () => {
      tabsEl.querySelectorAll("button").forEach(b => b.removeClass("active"));
      tabEl.addClass("active");
      activeTab = tab.id;
      await renderTab(tab.id);
    };
  });

  await renderTab(activeTab);
}
```

## 通用设置选项卡 (GeneralTab)

### 资产管理功能
```typescript
export async function renderGeneralTab(
  container: HTMLElement, 
  plugin: TabFlowPlugin, 
  app: App,
  refreshCallback: (tabId: string) => Promise<void>
): Promise<void> {
  // 资产状态检查
  const assetStatus = await plugin.checkRequiredAssets();
  
  // 下载按钮
  const downloadBtn = container.createEl("button", { text: "下载资产文件" });
  downloadBtn.addEventListener("click", async () => {
    const success = await plugin.downloadAssets();
    if (success) {
      new Notice("资产下载成功！");
      await refreshCallback("general");
    }
  });
  
  // 资产状态显示
  if (Array.isArray(assetStatus)) {
    assetStatus.forEach(status => {
      const statusEl = container.createDiv({ 
        text: `${status.file}: ${status.exists ? "✓" : "✗"}` 
      });
    });
  }
}
```

## 播放器设置选项卡 (PlayerTab)

### 播放器配置选项
```typescript
export async function renderPlayerTab(
  container: HTMLElement,
  plugin: TabFlowPlugin,
  app: App
): Promise<void> {
  const { settings } = plugin;
  
  // 自动打开 AlphaTex 文件选项
  new Setting(container)
    .setName("自动打开 AlphaTex 文件")
    .setDesc("是否自动在 TabView 中打开 .alphatex 文件")
    .addToggle(toggle => toggle
      .setValue(settings.autoOpenAlphaTexFiles)
      .onChange(async value => {
        settings.autoOpenAlphaTexFiles = value;
        await plugin.saveSettings();
      }));
  
  // 播放速度默认值
  new Setting(container)
    .setName("默认播放速度")
    .setDesc("设置默认的播放速度倍数")
    .addSlider(slider => slider
      .setLimits(0.5, 2.0, 0.1)
      .setValue(settings.defaultPlaybackSpeed)
      .onChange(async value => {
        settings.defaultPlaybackSpeed = value;
        await plugin.saveSettings();
      }));
}
```

## 关于选项卡 (AboutTab)

### 插件信息显示
```typescript
export async function renderAboutTab(
  container: HTMLElement,
  plugin: TabFlowPlugin,
  app: App
): Promise<void> {
  // 插件信息
  container.createEl("h2", { text: plugin.manifest.name });
  container.createEl("p", { text: `版本: ${plugin.manifest.version}` });
  container.createEl("p", { text: `作者: ${plugin.manifest.author}` });
  
  // 项目链接
  const githubLink = container.createEl("a", { 
    text: "GitHub 仓库",
    href: plugin.manifest.authorUrl 
  });
  githubLink.style.marginRight = "10px";
  
  // 依赖信息
  container.createEl("h3", { text: "依赖库" });
  container.createEl("p", { text: "• AlphaTab.js - 吉他谱渲染引擎" });
  container.createEl("p", { text: "• CodeMirror - 代码编辑器" });
}
```

## 默认设置配置

### 设置接口定义
```typescript
export interface TabFlowSettings {
  // 资产配置
  assetsDownloaded: boolean;
  lastAssetsCheck: number;
  simpleAssetCheck: boolean;
  
  // 播放器配置
  autoOpenAlphaTexFiles: boolean;
  defaultPlaybackSpeed: number;
  defaultMetronomeEnabled: boolean;
  defaultCountInEnabled: boolean;
  
  // UI 配置
  showPlaybackControls: boolean;
  showProgressBar: boolean;
  showTrackSelection: boolean;
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
  assetsDownloaded: false,
  lastAssetsCheck: 0,
  simpleAssetCheck: true,
  
  autoOpenAlphaTexFiles: true,
  defaultPlaybackSpeed: 1.0,
  defaultMetronomeEnabled: false,
  defaultCountInEnabled: true,
  
  showPlaybackControls: true,
  showProgressBar: true,
  showTrackSelection: true,
};
```

## 事件系统集成

### 外部事件触发
支持从其他组件触发设置面板的特定页签：

```typescript
// 在其他组件中触发播放器设置页签
this.app.workspace.trigger("tabflow:open-plugin-settings-player");
```

### 设置变更通知
设置变更时通知相关组件：

```typescript
// 设置变更后通知组件更新
async saveSettings() {
  await this.saveData(this.settings);
  this.app.workspace.trigger("tabflow:settings-changed");
}
```

## 用户体验优化

### 异步加载优化
子选项卡按需加载，减少初始加载时间：

```typescript
const renderTab = async (tabId: string) => {
  contentsEl.empty();
  
  if (tabId === "general") {
    const mod = await import("./tabs/generalTab"); // 动态导入
    await mod.renderGeneralTab(contentsEl, this.plugin, this.app, renderTab);
  }
  // ... 其他选项卡
};
```

### 状态持久化
设置自动保存到 Obsidian 配置：

```typescript
async saveSettings() {
  await this.saveData(this.settings);
}
```

### 错误处理
完善的错误处理和用户反馈：

```typescript
try {
  await plugin.downloadAssets();
  new Notice("资产下载成功！");
} catch (error) {
  new Notice(`下载失败: ${error.message}`);
  console.error("资产下载错误:", error);
}
```

这个设置面板系统提供了完整的配置管理功能，支持多选项卡界面、动态加载和外部事件集成，确保了用户能够方便地配置插件各项功能。
