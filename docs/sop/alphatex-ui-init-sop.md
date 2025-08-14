# AlphaTex 块内 init 语法：播放器 UI 覆盖使用说明（SOP）

本说明面向开发者与用户，介绍如何在 Markdown 的 AlphaTex 代码块首行使用 init 语法，按需控制播放器组件的显示与顺序；并阐述其作用域、优先级与兼容性策略。

## 适用范围

- 仅在 `alphatex` 代码块渲染期间生效；关闭/卸载该块时，覆盖自动撤销。
- 只影响当前视图会话（运行期覆盖），不会写入全局设置文件。
- 当 `player` 为 "disable" 时，无论 UI 覆盖如何，播放器组件都不渲染。

## 基本用法

- 在代码块首行（第一行）加入 Mermaid 风格的 init 语法：

```text
%%{init: { ...配置... }}%%
```

- 支持的核心字段（部分）：
  - `player`: "enable" | "disable"（是否启用播放器。禁用时仅渲染乐谱）
  - `ui.components`: 按组件键的显隐控制（布尔值）。
  - `ui.order`: 组件渲染顺序，可为“字符串数组”或“数字序列字符串”。

## 组件键（与底部 PlayBar 对齐）

按默认顺序列出组件键，用于 `ui.components` 与 `ui.order`：

1. playPause
2. stop
3. metronome
4. countIn
5. tracks
6. refresh
7. locateCursor
8. layoutToggle
9. exportMenu
10. toTop
11. toBottom
12. openSettings
13. progressBar
14. speed
15. staveProfile
16. zoom
17. audioPlayer

说明：

- `progressBar` 显示时间/进度条与拖拽；`audioPlayer` 为外部音频控件（默认关闭）。
- AlphaTex 块自带的迷你控件（播放/停止/节拍器）也遵循相同的组件键显隐策略。

## 配置示例

### 1) 仅用组件显隐（不改顺序）

```text
%%{init: {
  "player": "enable",
  "ui": {
    "components": {
      "playPause": true,
      "stop": true,
      "metronome": false,
      "tracks": true,
      "progressBar": true,
      "speed": false,
      "zoom": false
    }
  }
} }%%
```

### 2) 使用字符串数组控制顺序

```text
%%{init: {
  "ui": {
    "order": ["playPause","stop","progressBar","locateCursor","layoutToggle"]
  }
} }%%
```

### 3) 使用数字序列字符串控制顺序（简写）

```text
%%{init: {
  "ui": {
    "order": "2,1,13"
  }
} }%%
```

说明：

- 数字基于上方“组件键默认顺序”映射，支持 1 基或 0 基索引，系统会自动识别。
- 使用数字序列时，默认“只渲染这几个组件”，未列出的组件将被视为隐藏。
- 仍可叠加 `components` 精细覆写（例如把某个数字未列出的组件强制打开或把列出的组件关闭）。

## 优先级与合并规则

- 优先级：`init.ui` 覆盖 > 运行期间的其他临时覆盖 > 插件全局设置。
- `ui.order` 为数字序列字符串时，先据此形成“仅这些组件可见”的基线，再合并 `components` 指定的布尔覆写。
- 未提供的字段保持不变，保证与旧文档完全兼容。

## 完整示例

### 示例 A：完整参数 + 数组顺序

```text
%%{init: {
  "player": "enable",
  "scale": 1.0,
  "speed": 1.0,
  "scrollMode": "Continuous",
  "metronome": false,
  "tracks": [-1],
  "ui": {
    "components": {
      "playPause": true,
      "stop": true,
      "metronome": true,
      "countIn": true,
      "tracks": true,
      "refresh": true,
      "locateCursor": true,
      "layoutToggle": true,
      "exportMenu": true,
      "toTop": true,
      "toBottom": true,
      "openSettings": true,
      "progressBar": true,
      "speed": false,
      "staveProfile": true,
      "zoom": false,
      "audioPlayer": false
    },
    "order": [
      "playPause","stop","metronome","countIn","tracks","refresh",
      "locateCursor","layoutToggle","exportMenu","toTop","toBottom","openSettings",
      "progressBar","staveProfile","speed","zoom","audioPlayer"
    ]
  }
} }%%
```

要点：

- 显式声明所有组件键的显隐，顺序用字符串数组完整覆盖；`speed/zoom/audioPlayer` 按需关闭。
- `tracks: [-1]` 表示渲染所有音轨（取决于谱面来源）。

### 示例 B：完整参数 + 数字序列顺序

```text
%%{init: {
  "player": "enable",
  "scale": 1.0,
  "speed": 1.0,
  "scrollMode": "Continuous",
  "metronome": true,
  "tracks": [0,1,2],
  "ui": {
    "components": {
      "playPause": true,
      "stop": true,
      "metronome": true,
      "countIn": true,
      "tracks": true,
      "refresh": false,
      "locateCursor": true,
      "layoutToggle": true,
      "exportMenu": false,
      "toTop": false,
      "toBottom": false,
      "openSettings": true,
      "progressBar": true,
      "speed": false,
      "staveProfile": true,
      "zoom": false,
      "audioPlayer": false
    },
    "order": "1,2,13,7,8,12,3,4,5,15"
  }
} }%%
```

要点：

- `order` 使用数字序列：基于“组件键默认顺序”映射（支持 1 基或 0 基），此例优先展示播放控制、进度条、定位与布局切换等。
- 使用数字序列时，未列出的组件默认隐藏；同时仍可用 `components` 进一步精细控制显隐。

## 典型场景

- 演示/讲解：仅保留播放、停止与进度条，隐藏高级操作。
- 练习：保留节拍器、定位光标、布局切换；隐藏导出等次要项。
- 展示：禁用播放器 `player: "disable"`，专注显示乐谱。

## 故障排查

- “组件不显示/顺序无效”：确认 `%%{init: ... }%%` 是否在代码块第一行；确认 JSON 语法正确。
- “数字序列无效”：检查是否存在越界数字（小于 1/0 或大于最大组件数）。
- “与全局设置冲突”：这是预期行为。块内覆盖优先生效，仅影响当前视图会话。

## 对开发者的实现要点（概览）

- `AlphaTexBlock` 解析 `init.ui`，在挂载时注入“运行期 UI 覆盖”，在销毁时清空；并触发重挂载事件以刷新 PlayBar。
- `PlayBar` 渲染时读取运行期覆盖，若存在则优先使用；若 `ui.order` 为字符串数字序列，则按默认键映射顺序渲染，默认只显示被列出的组件。
- 组件键命名与默认顺序在 `src/components/PlayBar.ts` 的 `defaultOrder` 中维护；若有变动，请同步更新本文档。

## 附：与全局设置的关系

- 全局设置用于默认外观；`init` 用于文档级的“局部覆写”。
- 不会把 `init` 的临时覆写写入到设置文件；关闭渲染后恢复全局设置下的默认外观。


