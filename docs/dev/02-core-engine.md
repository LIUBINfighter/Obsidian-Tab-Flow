# AlphaTab 核心引擎集成

## 相关代码文件
- `src/services/AlphaTabService.ts` - AlphaTab 服务核心
- `src/utils/audioUtils.ts` - 音频工具函数
- `src/utils/EventBus.ts` - 事件总线系统
- `src/services/ScrollConfigProxy.ts` - 滚动配置代理

## AlphaTab 引擎集成架构

### 核心服务类 (AlphaTabService)

`AlphaTabService` 是插件与 AlphaTab.js 引擎之间的桥梁，负责：

1. **AlphaTab API 初始化**: 配置和创建 AlphaTabApi 实例
2. **事件处理**: 注册命令处理器和 API 监听器
3. **资源管理**: 处理字体、音色库等资源
4. **主题适配**: 动态适配 Obsidian 主题颜色

### 初始化配置

```typescript
// AlphaTab API 配置示例
this.api = new alphaTab.AlphaTabApi(element, {
  core: {
    scriptFile: resources.alphaTabWorkerUri,
    smuflFontSources: new Map([[fontFormat, resources.bravuraUri]]),
    fontDirectory: "",
  },
  player: {
    enablePlayer: true,
    playerMode: alphaTab.PlayerMode.EnabledAutomatic,
    soundFont: resources.soundFontUri,
    scrollMode: alphaTab.ScrollMode.Continuous,
  },
  display: {
    resources: {
      mainGlyphColor: themeColors.base100,
      secondaryGlyphColor: themeColors.base60,
      staffLineColor: themeColors.base40,
      barNumberColor: themeColors.accent,
    },
  },
});
```

### 命令系统

AlphaTabService 实现了完整的事件命令系统：

#### 播放控制命令
- `命令:播放暂停` - 切换播放/暂停状态
- `命令:停止` - 停止播放
- `命令:设置速度` - 调整播放速度 (0.5x - 2.0x)

#### 显示配置命令
- `命令:设置谱表` - 切换谱表配置文件
- `命令:设置缩放` - 调整显示比例
- `命令:切换布局` - 切换页面/水平布局模式

#### 音频配置命令
- `命令:设置节拍器` - 启用/禁用节拍器
- `命令:设置预备拍` - 启用/禁用预备拍

#### 滚动配置命令
- `命令:设置滚动模式` - 配置滚动行为
- `命令:设置滚动速度` - 调整滚动速度
- `命令:设置Y偏移` - 设置垂直偏移
- `命令:设置X偏移` - 设置水平偏移
- `命令:设置原生滚动` - 启用原生平滑滚动

#### 导出命令
- `命令:导出音频` - 导出 WAV 音频文件
- `命令:导出MIDI` - 导出 MIDI 文件
- `命令:导出PDF` - 导出 PDF 乐谱
- `命令:导出GP` - 导出 Guitar Pro 文件

### 事件监听系统

AlphaTabService 注册了关键的 API 事件监听器：

```typescript
private registerApiListeners() {
  this.api.playerReady.on(() => this.eventBus.publish("状态:音频就绪"));
  this.api.error.on((err) => this.eventBus.publish("状态:错误", err));
  this.api.playerPositionChanged.on((args) => {
    this.eventBus.publish("状态:播放位置变化", {
      currentTime: args.currentTime,
      endTime: args.endTime,
    });
  });
}
```

### 乐谱加载功能

支持多种格式的乐谱加载：

#### 二进制格式加载
```typescript
public async loadScore(fileData: Uint8Array) {
  await this.api.load(fileData);
}
```

#### AlphaTex 文本加载
```typescript
public async loadAlphaTexScore(textContent: string) {
  if (typeof (this.api as any).tex === "function") {
    await (this.api as any).tex(textContent);
  } else {
    // 备用方案使用 AlphaTexImporter
    const importer = new AlphaTexImporter();
    importer.initFromString(textContent, this.api.settings);
    const score = importer.readScore();
    this.api.renderScore(score);
  }
}
```

### 音频导出功能

实现了高质量的音频导出：

```typescript
public async exportAudioToWav(
  options?: Partial<alphaTab.synth.AudioExportOptions>
): Promise<string> {
  const exportOptions = new alphaTab.synth.AudioExportOptions();
  Object.assign(exportOptions, options);
  const exporter = await this.api.exportAudio(exportOptions);
  
  const chunks: Float32Array[] = [];
  try {
    while (true) {
      const chunk = await exporter.render(500);
      if (!chunk) break;
      chunks.push(chunk.samples);
    }
  } finally {
    exporter.destroy();
  }
  
  return convertSamplesToWavBlobUrl(chunks, exportOptions.sampleRate);
}
```

### 动态重建机制

支持运行时重建 AlphaTab API 实例：

```typescript
public reconstructApi(): void {
  // 销毁旧实例
  this.api.destroy();
  this.scrollProxy.destroy();
  
  // 创建新实例
  this.api = new alphaTab.AlphaTabApi(this.element, config);
  this.scrollProxy = new ScrollConfigProxy(this.api);
  
  // 重新注册监听器
  this.registerApiListeners();
  
  // 通知外部组件
  this.eventBus.publish("状态:API已重建", this.api);
}
```

### 主题适配机制

动态读取 Obsidian CSS 变量进行主题适配：

```typescript
const style = window.getComputedStyle(this.element);
const themeColors = {
  base100: style.getPropertyValue("--color-base-100"),
  base60: style.getPropertyValue("--color-base-60"),
  base40: style.getPropertyValue("--color-base-40"),
  accent: "#" + convert.hsl.hex([
    parseFloat(style.getPropertyValue("--accent-h")),
    parseFloat(style.getPropertyValue("--accent-s")),
    parseFloat(style.getPropertyValue("--accent-l")),
  ]),
};
```

### 性能优化特性

1. **懒加载**: 资源在需要时才加载
2. **内存管理**: 正确的资源销毁和清理
3. **错误恢复**: API 重建机制处理异常情况
4. **批量处理**: 音频导出使用分块处理避免内存溢出

这个核心引擎集成确保了插件与 AlphaTab.js 的无缝协作，提供了稳定可靠的吉他谱渲染和播放功能。
