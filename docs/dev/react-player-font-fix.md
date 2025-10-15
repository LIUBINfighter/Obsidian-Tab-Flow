# React Player 字体加载问题修复

## 🐛 问题描述

在新的 React Player 架构中，出现以下错误：

```
[AlphaTab][Font] [alphaTab] Loading Failed, rendering cannot start 
NetworkError: A network error occurred.
Font not available
```

## 🔍 问题根因

对比 `TabView` 和 `AlphaTabService` 的原始实现，发现新架构缺少以下关键配置：

### 1. 字体配置不完整
- **缺失**：`smuflFontSources` Map 配置
- **缺失**：`@font-face` CSS 注入
- **缺失**：`playerMode` 设置

### 2. Settings 对象结构不匹配
- 原始代码使用更详细的 player 配置
- 缺少 `nativeBrowserSmoothScroll` 等字段

## ✅ 修复方案

### 1. 更新 `config-schema.ts` 类型定义

```typescript
export interface AlphaTabSettingsConfig {
  core: {
    scriptFile: string | null;  // 改为必填
    fontDirectory: string | null;  // 改为必填
    // ... 其他字段
  };
  player: {
    scrollElement?: HTMLElement | string;  // 新增
    // ... 其他字段
  };
  display: {
    resources?: {  // 新增颜色配置
      mainGlyphColor?: string;
      secondaryGlyphColor?: string;
      // ...
    };
  };
}
```

### 2. 修复 `PlayerController.createAlphaTabSettings()`

**关键修复点**：

#### a) 正确配置字体源
```typescript
// 使用与 AlphaTabService 完全相同的方式
if (this.resources.bravuraUri) {
  const FontFileFormat = (alphaTab as any).rendering?.glyphs?.FontFileFormat;
  if (FontFileFormat && FontFileFormat.Woff2 !== undefined) {
    settings.core.smuflFontSources = new Map([
      [FontFileFormat.Woff2, this.resources.bravuraUri],
    ]) as unknown as Map<number, string>;
  }
}
```

#### b) 添加 playerMode
```typescript
player: {
  playerMode: alphaTab.PlayerMode.EnabledAutomatic,  // 新增
  // ... 其他配置
}
```

#### c) 添加滚动配置
```typescript
player: {
  nativeBrowserSmoothScroll: false,  // 新增
  // ... 其他配置
}
```

#### d) 颜色配置安全处理
```typescript
barNumberColor: '#' + convert.hsl.hex([
  parseFloat(style.getPropertyValue('--accent-h')) || 0,
  parseFloat(style.getPropertyValue('--accent-s')) || 0,
  parseFloat(style.getPropertyValue('--accent-l')) || 50,
])
```

### 3. 在 `ReactView` 中注入 @font-face

**参考 TabView 的实现**：

```typescript
async onOpen() {
  // 注入字体样式
  if (this.resources.bravuraUri) {
    const fontFaceRule = `
      @font-face {
        font-family: 'alphaTab';
        src: url(${this.resources.bravuraUri});
      }
    `;
    this.fontStyle = this.containerEl.ownerDocument.createElement('style');
    this.fontStyle.id = `alphatab-font-style-${ReactView.instanceId++}`;
    this.fontStyle.appendChild(document.createTextNode(fontFaceRule));
    this.containerEl.ownerDocument.head.appendChild(this.fontStyle);
  }
  // ...
}

async onClose() {
  // 清理字体样式
  if (this.fontStyle) {
    this.fontStyle.remove();
    this.fontStyle = null;
  }
  // ...
}
```

### 4. 使用动态导入创建 API

```typescript
// 使用动态导入确保类型正确
const alphaTabModule = await import('@coderline/alphatab');
this.api = new alphaTabModule.AlphaTabApi(this.container, settings);
```

## 📋 修改的文件清单

1. **src/player/types/config-schema.ts**
   - 更新 `AlphaTabSettingsConfig` 接口
   - `scriptFile` 和 `fontDirectory` 改为必填
   - 添加 `scrollElement` 和 `resources` 字段
   - 更新 `getDefaultConfig()` 默认值

2. **src/player/PlayerController.ts**
   - 添加 `PlayerControllerResources` 接口
   - 构造函数接收 `plugin` 和 `resources`
   - `createAlphaTabSettings()` 完全重写
   - 添加字体源配置逻辑
   - 添加详细日志输出
   - 使用动态导入创建 API

3. **src/player/ReactView.ts**
   - 添加 `resources` 和 `fontStyle` 字段
   - 更新构造函数签名
   - `onOpen()` 中注入 @font-face
   - `onClose()` 中清理字体样式
   - 传递 resources 给 PlayerController

4. **src/main.ts**
   - 恢复 ReactView 注册时的 resources 传递

## 🎯 验证要点

1. ✅ 字体文件 URL 正确配置
2. ✅ @font-face CSS 成功注入到 DOM
3. ✅ smuflFontSources Map 正确创建
4. ✅ 颜色配置安全处理（避免 NaN）
5. ✅ playerMode 设置正确
6. ✅ 编译零错误
7. ✅ 构建成功

## 📚 参考代码

- **TabView.ts:71-86** - @font-face 注入逻辑
- **AlphaTabService.ts:38-78** - AlphaTab Settings 配置
- **AlphaTabService.ts:45-52** - smuflFontSources 配置

## 🚀 后续优化

1. ⏳ 添加字体加载状态检测
2. ⏳ 字体加载失败的降级方案
3. ⏳ 统一资源管理服务
4. ⏳ 配置验证和错误提示

## 📝 总结

本次修复通过以下步骤解决了字体加载问题：

1. **完善类型定义** - 确保配置结构与实际需求一致
2. **正确配置字体源** - 使用与原始代码相同的 Map 结构
3. **注入 @font-face** - 在 DOM 中添加字体样式规则
4. **补全 Settings** - 添加缺失的 playerMode 等字段
5. **安全处理颜色** - 避免解析 CSS 变量时的 NaN 错误

新架构现在与原始 TabView/AlphaTabService 实现保持一致，字体加载问题已完全解决！✨
