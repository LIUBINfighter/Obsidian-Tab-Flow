# AlphaTex `init` 语法规范与最佳实践（Spec）

## 1. 目标与适用范围

- 为 Markdown 中的 `alphatex` 代码块提供块级、运行期（会话级）的渲染与播放器 UI 配置能力。
- 不写回文档、不落盘；关闭该块或离开视图后恢复默认。
- 适用于单个或多个 AlphaTex 块并存的场景，互不干扰。

## 2. 放置位置与基本格式

- `init` 必须写在代码块第一行，使用 Mermaid 风格的标记：

```text
%%{init: { ...JSON... } }%%
```

- 支持两种等价写法：
- 单行 JSON：

```text
%%{init: {"player":"enable","scale":1}}%%
```

- 多行 JSON：

```text
%%{init: {
  "player": "enable",
  "scale": 1
} }%%
```

- 解析要点：
- 允许起始处存在 BOM 与空白；`init` 必须作为整个块的第一行。
- 解析器从 `%%{init:` 起，逐字符匹配 `{...}` 的完整 JSON 对象，再剥离其后可选的 `}` 与 `%%` 及一个换行。
- 如果 JSON 解析失败，视为没有 `init`，正文按普通 AlphaTex 处理。

## 3. JSON 解析与约束

- 严格 JSON：不允许注释、结尾逗号、单双引号混用（字符串应使用双引号）。
- 布尔值用 `true/false`，数字使用十进制浮点/整数。
- 未知字段忽略，不报错（向前兼容）。

## 4. 字段一览与默认值

- 通用渲染/播放器字段：
  - `player`: `"enable" | "disable"`
    - 启用/禁用播放器（禁用时仅渲染乐谱，所有 UI 控件隐藏）。
  - `scale`: `number`（0.5 ~ 2.0）
    - 缩放比例；运行期会被夹在合法范围内。
  - `speed`: `number`（0.5 ~ 2.0）
    - 播放速度；运行期会被夹在合法范围内。
  - `scrollMode`: `string | number`
    - 字符串映射（不区分大小写）：`"Continuous" | "Page" | "SinglePage"`；内部转换为 AlphaTab 枚举值。
  - `metronome`: `boolean`
    - 是否开启节拍器。
  - `tracks`: `number[]`
    - `[-1]` 表示全部；其它为轨道索引集合（在 `scoreLoaded` 后筛选再渲染）。

- UI 相关字段（运行期覆盖，不落盘）：
  - `ui.components`: `Record<string, boolean>`
    - 控制每个组件的显隐。未指定的键按默认/全局设置处理。
  - `ui.order`: `string[] | string`
    - 字符串数组：直接指定组件顺序，例如 `["playPause","stop","progressBar"]`。
    - 数字序列字符串：如 `"1,2,13"`，容忍 0/1 基索引，映射到“默认组件键序列”。使用数字序列时，默认“仅显示列出的组件”；仍可再用 `components` 叠加覆写。

- 默认值来源：
  - 渲染与播放器层：`scale=1.0, speed=1.0, scrollMode=Continuous, metronome=false`。
  - UI 层：若未提供 `ui`，则底部 PlayBar 组件与顺序取自全局设置；块内迷你控件提供最小集合（播放/停止/节拍器），并遵循运行期覆盖的显隐策略。

## 5. 组件键全集与默认顺序（用于 `ui.components` 与 `ui.order`）

1. `playPause`
2. `stop`
3. `metronome`
4. `countIn`
5. `tracks`
6. `refresh`
7. `locateCursor`
8. `layoutToggle`
9. `exportMenu`
10. `toTop`
11. `toBottom`
12. `openSettings`
13. `progressBar`
14. `speed`
15. `staveProfile`
16. `zoom`
17. `audioPlayer`

说明：

- 块内“迷你控件”当前支持的子集：`playPause`、`stop`、`metronome`、`locateCursor`、`layoutToggle`、`toTop`、`toBottom`。
- 其余组件在底部 PlayBar 呈现（受运行期覆盖影响）。

## 6. 优先级与合并策略

- 覆盖优先级（高 → 低）：
  - `init.ui`（当前块会话级）
  - 其他运行期覆盖（如未来扩展）
  - 全局设置（`SettingTab`）

- 合并规则：
  - `ui.order` 为“数字序列字符串”时，默认仅显示该序列涵盖的组件；`ui.components` 可继续按键覆写显隐。
  - 未出现在 `components` 的键按默认/全局设置处理。
  - 未识别的键忽略。

## 7. 滚动策略

- 自动滚动与光标定位仅在当前块容器内进行：`api.settings.player.scrollElement = wrapper`。
- 多个块并存时互不影响，不触发整页滚动。

## 8. 示例（可直接复制）

- 最小可用：

```text
%%{init: { "player": "enable" }}%%
\title "Demo"
:4 0.0 |
```

- 仅渲染：

```text
%%{init: { "player": "disable" }}%%
\title "Render Only"
:4 0.0 |
```

- 多行 JSON + 组件显隐：

```text
%%{init: {
  "player": "enable",
  "ui": {
    "components": {
      "playPause": true,
      "stop": true,
      "progressBar": true,
      "locateCursor": true,
      "layoutToggle": true,
      "metronome": false,
      "countIn": false
    }
  }
} }%%
\title "Minimal Controls"
:4 0.0 |
```

- 顺序为字符串数组：

```text
%%{init: {
  "player": "enable",
  "ui": { "order": ["playPause","stop","progressBar","locateCursor","layoutToggle","openSettings"] }
} }%%
\title "Ordered Controls (Array)"
:4 0.0 |
```

- 顺序为数字序列（1 基）：

```text
%%{init: {
  "player": "enable",
  "ui": { "order": "1,2,13" }
} }%%
\title "Ordered Controls (Numeric 1-based)"
:4 0.0 |
```

- 选择渲染音轨：

```text
%%{init: {
  "player": "enable",
  "tracks": [0,2,4],
  "ui": { "order": "1,2,13,7,8" }
} }%%
\title "Selected Tracks (0,2,4)"
:4 0.0 |
```

## 9. 错误与容错行为

- JSON 解析失败：忽略 `init`，按普通 AlphaTex 渲染；不会破坏正文。
- 数字序列越界或非法：自动过滤非法索引；若为空则回退到最小集合（块内）或全局设置（PlayBar）逻辑。
- 未知组件键：忽略，不报错。
- `tracks` 中的非法索引：忽略非法项；若最终无有效轨道，则按全部轨道渲染。

## 10. 与全局设置、PlayBar、迷你控件的关系

- `ui` 为运行期覆盖层，不写回全局设置。
- PlayBar 的组件与顺序在 `runtimeUiOverride` 存在时优先于 `settings.playBar`。
- 块内迷你控件受 `ui` 影响，但仅实现高频子集；其余交互在 PlayBar 进行。

## 11. 版本兼容与迁移

- 旧版“回写 init 到文档”的逻辑已移除（避免与运行期 UI 覆盖冲突）。
- 新增“数字序列顺序”语法，与旧的“数组顺序”共存，保持向后兼容。

## 12. 最佳实践

- 文档级控制：优先在块首行使用 `init`，减少与全局设置的耦合。
- 多块并存：为避免相互覆盖 PlayBar，可只在主要示例块中配置 `ui`，或采用相同的 `ui` 配置以保持一致性。
- 稳妥书写：尽量使用多行 JSON，便于校验与审阅；避免智能引号与注释。

## 13. 源码指路

- 解析与渲染：`src/markdown/AlphaTexBlock.ts`
- 运行期覆盖：`src/main.ts`（`runtimeUiOverride` 注入与刷新）
- PlayBar 显示：`src/components/PlayBar.ts`（顺序与显隐解析）
- 全局设置：`src/settings/SettingTab.ts`
- 编辑器封装：`src/editor/EmbeddableMarkdownEditor.ts`

## 14. 相关文档

- 使用手册与示例：`docs/sop/alphatex-ui-init-sop.md`
- 设计说明：`docs/sop/alphatex-ui-design.md`
