# alphaTab 滚动配置三种模式设置指南

本指南介绍如何在不同场景下设置 alphaTab 的滚动模式，包括代码端、调试（debug）端和未来面向用户的设置方式。

---

## 1. 代码端设置默认的三个滚动配置

alphaTab 支持三种滚动模式：
- **关闭**（Off）
- **连续**（Continuous）
- **超出时**（OffScreen）

可通过 `AlphaTabApi` 初始化参数或后续设置：

```typescript
import * as alphaTab from "@coderline/alphatab";

// 关闭自动滚动
const apiOff = new alphaTab.AlphaTabApi(container, {
    player: { scrollMode: alphaTab.ScrollMode.Off }
});

// 连续滚动
const apiContinuous = new alphaTab.AlphaTabApi(container, {
    player: { scrollMode: alphaTab.ScrollMode.Continuous }
});

// 超出时滚动
const apiOffScreen = new alphaTab.AlphaTabApi(container, {
    player: { scrollMode: alphaTab.ScrollMode.OffScreen }
});
```

也可通过事件驱动方式动态切换：

```typescript
// 以事件方式切换滚动模式
handlePlayerEvent(api, { type: "setScrollMode", value: alphaTab.ScrollMode.Continuous });
```

---

## 2. 在 DebugBar（调试端）设置滚动模式

DebugBar 可通过 UI 控件（如下拉框、按钮等）触发事件，统一调用事件驱动接口：

```typescript
// 监听 UI 控件变化
onScrollModeChange(mode: alphaTab.ScrollMode) {
    scrollEventManager.setScrollMode(mode);
}

// 监听配置变更反馈到 UI
scrollEventManager.setEventHandlers({
    onScrollConfigChange: (event) => {
        updateDebugBarUI(event);
    }
});
```

---

## 3. 面向用户的未来设置方式（设想）

未来可为最终用户提供更友好的界面：
- **设置面板**：在插件设置页提供下拉选择框，允许用户选择滚动模式
- **即时预览**：用户切换后立即生效并可预览效果
- **个性化存储**：用户选择的模式可持久化到本地配置

示例伪代码：

```typescript
// 监听设置面板变更
onUserSettingChange('scrollMode', (mode) => {
    scrollEventManager.setScrollMode(mode);
    saveUserConfig('scrollMode', mode);
});
```

---

> 通过统一的事件驱动和配置管理，alphaTab 的滚动体验可灵活适配开发、调试和最终用户三种场景。
