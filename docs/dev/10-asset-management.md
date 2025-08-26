# 资源管理系统

## 相关代码文件
- `src/services/ResourceLoaderService.ts` - 资源加载服务
- `src/types/assets.ts` - 资源类型定义
- `src/utils/fileUtils.ts` - 文件工具函数
- `src/main.ts` - 主插件资源管理

## 资源管理架构

### ResourceLoaderService

`ResourceLoaderService` 负责加载和管理插件所需的资源文件：

#### 资源接口定义
```typescript
export interface AlphaTabResources {
  bravuraUri?: string;        // Bravura 字体文件 URL
  alphaTabWorkerUri?: string; // AlphaTab worker 脚本 URL
  soundFontUri?: string;      // SoundFont 音色库 URL
  resourcesComplete: boolean; // 资源是否完整
}
```

#### 资源文件常量
```typescript
export const ASSET_FILES = {
  BRAVURA: "Bravura.woff2",      // 音乐符号字体
  ALPHA_TAB: "alphaTab.min.js",  // AlphaTab worker 脚本
  SOUNDFONT: "sonivox.sf3"       // SoundFont 音色库
};
```

## 资源加载流程

### 资源路径构建
```typescript
public async load(pluginDir: string): Promise<AlphaTabResources> {
  const bravuraPath = path.join(pluginDir, "assets", ASSET_FILES.BRAVURA);
  const alphaTabPath = path.join(pluginDir, "assets", ASSET_FILES.ALPHA_TAB);
  const soundFontPath = path.join(pluginDir, "assets", ASSET_FILES.SOUNDFONT);

  const resources: AlphaTabResources = {
    resourcesComplete: true
  };
  
  // 检查文件存在性
  const [bravuraExists, alphaTabExists, soundFontExists] = await Promise.all([
    fileExists(bravuraPath, this.app.vault.adapter),
    fileExists(alphaTabPath, this.app.vault.adapter),
    fileExists(soundFontPath, this.app.vault.adapter)
  ]);
}
```

### 资源完整性检查
```typescript
// 如果有任何资源不存在，标记为不完整
if (!bravuraExists || !alphaTabExists || !soundFontExists) {
  resources.resourcesComplete = false;
  console.log("[ResourceLoaderService] Some resources are missing.");
  
  if (!bravuraExists) console.log(`Missing: ${ASSET_FILES.BRAVURA}`);
  if (!alphaTabExists) console.log(`Missing: ${ASSET_FILES.ALPHA_TAB}`);
  if (!soundFontExists) console.log(`Missing: ${ASSET_FILES.SOUNDFONT}`);
}
```

### 资源 URL 生成
```typescript
// 使用 Obsidian 资源 URL（可被缓存/共享）
if (bravuraExists) {
  resources.bravuraUri = this.app.vault.adapter.getResourcePath(bravuraPath);
}

if (alphaTabExists) {
  resources.alphaTabWorkerUri = this.app.vault.adapter.getResourcePath(alphaTabPath);
}

if (soundFontExists) {
  resources.soundFontUri = this.app.vault.adapter.getResourcePath(soundFontPath);
}
```

## 资源类型定义

### 资产状态接口
```typescript
export interface AssetStatus {
  file: string;      // 文件名
  exists: boolean;   // 是否存在
  path: string;      // 文件路径
}
```

## 主插件资源管理

### 资源检查功能
```typescript
async checkRequiredAssets(): Promise<boolean | AssetStatus[]> {
  if (!this.actualPluginDir) {
    console.error("[TabFlowPlugin] Plugin directory not found");
    return false;
  }

  // 使用相对路径
  const assetsDirRelative = path.join(
    ".obsidian",
    "plugins",
    this.manifest.id,
    "assets"
  );

  // 检查 assets 目录是否存在
  const assetsDirExists = await this.app.vault.adapter.exists(assetsDirRelative);
  if (!assetsDirExists) {
    return false;
  }

  // 检查每个资产文件
  const assetFiles = [
    ASSET_FILES.ALPHA_TAB,
    ASSET_FILES.BRAVURA,
    ASSET_FILES.SOUNDFONT,
  ];

  const assetStatuses: AssetStatus[] = await Promise.all(
    assetFiles.map(async (file) => {
      const filePath = path.join(assetsDirRelative, file);
      const exists = await this.app.vault.adapter.exists(filePath);
      
      return {
        file,
        exists,
        path: filePath,
      };
    })
  );

  return assetStatuses;
}
```

### 资源下载功能
```typescript
async downloadAssets(): Promise<boolean> {
  try {
    if (!this.actualPluginDir) {
      new Notice("无法确定插件目录，下载失败");
      return false;
    }

    // 创建资产目录
    const assetsDirRelative = path.join(
      ".obsidian",
      "plugins",
      this.manifest.id,
      "assets"
    );

    try {
      await this.app.vault.adapter.mkdir(assetsDirRelative);
    } catch (err) {
      console.log("创建目录时出错（可能已存在）:", err);
    }

    // 使用固定版本号下载
    const version = "0.0.5";
    const baseUrl = `https://github.com/LIUBINfighter/Obsidian-Tab-Flow/releases/download/${version}`;

    // 定义要下载的资产
    const assets = [
      {
        url: `${baseUrl}/${ASSET_FILES.ALPHA_TAB}`,
        path: path.join(assetsDir, ASSET_FILES.ALPHA_TAB),
      },
      {
        url: `${baseUrl}/${ASSET_FILES.BRAVURA}`,
        path: path.join(assetsDir, ASSET_FILES.BRAVURA),
      },
      {
        url: `${baseUrl}/${ASSET_FILES.SOUNDFONT}`,
        path: path.join(assetsDir, ASSET_FILES.SOUNDFONT),
      },
    ];

    // 并行下载所有资产文件
    const downloadPromises = assets.map(async (asset) => {
      try {
        new Notice(`正在下载 ${path.basename(asset.path)}...`);
        const response = await requestUrl({
          url: asset.url,
          method: "GET",
        });

        if (response.status !== 200) {
          return false;
        }

        // 写入文件
        await this.app.vault.adapter.writeBinary(
          asset.path,
          response.arrayBuffer
        );

        return true;
      } catch (error) {
        console.error(`Error downloading ${asset.url}:`, error);
        return false;
      }
    });

    const results = await Promise.all(downloadPromises);
    const success = results.every(result => result);

    if (success) {
      this.settings.assetsDownloaded = true;
      this.settings.lastAssetsCheck = Date.now();
      await this.saveSettings();
      new Notice("所有资产文件下载成功！");
    }

    return success;
  } catch (error) {
    console.error("[TabFlowPlugin] Error downloading assets:", error);
    new Notice(`下载资产文件失败: ${error.message}`);
    return false;
  }
}
```

## 文件工具函数

### 文件存在性检查
```typescript
export async function fileExists(
  filePath: string, 
  adapter: any
): Promise<boolean> {
  try {
    return await adapter.exists(filePath);
  } catch (error) {
    console.error(`Error checking file existence: ${filePath}`, error);
    return false;
  }
}
```

## 资源使用场景

### 插件初始化时的资源加载
```typescript
async onload() {
  await this.loadSettings();
  
  // 使用 ResourceLoaderService 加载资源
  const resourceLoader = new ResourceLoaderService(this.app);
  this.resources = await resourceLoader.load(this.actualPluginDir);
  
  // 检查资源是否完整
  if (!this.resources.resourcesComplete) {
    new Notice(
      "AlphaTab 插件资源文件不完整，某些功能可能无法正常工作。请在插件设置中下载资源文件。",
      10000
    );
  }
}
```

### Markdown 渲染时的资源检查
```typescript
this.registerMarkdownCodeBlockProcessor("alphatex", async (source, el, ctx) => {
  // 资源缺失：在块内提示并提供下载按钮
  if (!this.resources.bravuraUri || !this.resources.alphaTabWorkerUri) {
    const holder = el.createEl("div");
    holder.addClass("alphatex-block");
    
    const msg = holder.createEl("div", {
      text: "AlphaTab 资源缺失，无法渲染此代码块。",
    });
    
    const btn = holder.createEl("button", {
      text: "下载资源",
    });
    
    btn.addEventListener("click", async () => {
      btn.setAttr("disabled", "true");
      btn.setText("下载中...");
      const ok = await this.downloadAssets();
      btn.removeAttribute("disabled");
      btn.setText(ok ? "下载完成，请刷新预览" : "下载失败，重试");
    });
    
    return;
  }
  
  // 正常渲染逻辑...
});
```

## 性能优化

### 资源缓存
使用 Obsidian 的资源路径机制实现缓存：

```typescript
resources.bravuraUri = this.app.vault.adapter.getResourcePath(bravuraPath);
```

### 懒加载
资源在需要时才加载，避免启动性能问题。

### 错误恢复
资源加载失败时提供降级方案和用户反馈。

## 用户体验

### 资源状态反馈
- 详细的资源缺失提示
- 一键下载功能
- 下载进度反馈

### 自动恢复
资源下载后自动刷新相关组件状态。

这个资源管理系统确保了插件所需的关键资源（字体、脚本、音色库）的正确加载和管理，提供了完善的错误处理和用户反馈机制。
