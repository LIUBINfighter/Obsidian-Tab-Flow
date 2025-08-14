# AlphaTex init 驱动的播放器 UI：设计说明、优先级、实现与源码导航

## 背景与目标

- 通过 Markdown 代码块首行的 init 语法，为每个 AlphaTex 块提供“运行期的 UI 覆盖”，实现独立、可组合的播放器体验。
- 不改动全局设置，不落盘；块关闭后自动恢复默认。
- 支持多种书写方式（单行/多行 JSON、组件键顺序、数字序列顺序），降低复杂度并兼容旧文档。
- 对每个块约束滚动范围到自身容器，避免多个块之间的全局滚动干扰。

## 关键设计决策

- 运行期覆盖，不写回 Markdown：所有 `ui`、`order`、`components` 的变更均为会话级，组件显隐与顺序仅影响当前视图。
- 双层 UI：
  - 底部 PlayBar（全局组件栈，受运行期覆盖影响）。
  - 块内迷你控制条（最小必要控件，遵循 `ui` 的显隐与顺序子集）。
- 顺序语法双形态：
  - 字符串数组：`["playPause","stop", ...]`。
  - 数字序列字符串：`"1,2,13"`（容忍 0/1 基索引，映射到默认组件键序列）。
- 滚动策略：每个块的自动滚动/定位仅在自身容器内进行。

## 优先级与作用域

- 覆盖优先级：
  1) `init.ui`（当前块）
  2) 运行期其他临时覆盖（若存在）
  3) 插件全局设置（SettingTab）
- `player: "disable"` 时强制渲染-only，忽略 UI 组件。
- `ui.order` 为数字序列时：默认仅显示列出的组件；`ui.components` 仍可继续覆写显隐。
- 作用域：仅当前视图会话；块销毁后撤销覆盖。多个块共存时采用“后渲染优先”的简单策略（last-wins）。

## 语法与行为速览

- 起始（必须在代码块第一行）：

```text
%%{init: { ... } }%%
```

- 常用字段：
  - `player`: "enable" | "disable"
  - `scale`: number（0.5 ~ 2）
  - `speed`: number（0.5 ~ 2）
  - `scrollMode`: "Continuous" | "Page" | "SinglePage"（字符串映射到枚举）
  - `metronome`: boolean
  - `tracks`: number[]（-1 表示全部；其它为按索引筛选）
  - `ui.components`: Record<string, boolean>
  - `ui.order`: string[] 或 数字序列字符串（如 `"1,2,13"`）

- 组件键默认顺序与含义参见《SOP：AlphaTex 块内 init 语法》：`docs/sop/alphatex-ui-init-sop.md`。

## 实现说明 / 源码导航

- 解析与挂载
  - `src/markdown/AlphaTexBlock.ts`
    - `parseInlineInit(source)`：
      - 支持单行/多行 JSON，从起始 `%%{init:` 扫描匹配到 `}`，再剥离尾随 `}%%` 与换行。
      - 解析失败则回退为普通 AlphaTex 文本。
    - `mountAlphaTexBlock(rootEl, source, resources, defaults)`：
      - 合并 defaults + init，注入颜色与字体，初始化 AlphaTabApi。
      - 滚动容器：`api.settings.player.scrollElement = wrapper`（仅块内滚动）。
      - 渲染：`api.tex(body)`；如需按索引筛选轨道，监听 `scoreLoaded` 后调用 `api.renderTracks(selected)`。
      - 迷你控件渲染：
        - 受 `ui.components` 与 `ui.order` 影响，支持的键包括 `playPause/stop/metronome/locateCursor/layoutToggle/toTop/toBottom`。
      - 运行期覆盖：如果存在 `ui`，通过 `defaults.setUiOverride(ui)` 推送到插件实例；销毁时 `clearUiOverride()` 撤销。

- 运行期覆盖与入口
  - `src/main.ts`
    - 在 Markdown 处理器里创建 `runtimeUiOverride`（仅内存），并通过 `app.workspace.trigger('tabflow:playbar-components-changed')` 通知 PlayBar 重新挂载。
    - 已移除旧版对 `init` 的“写回文档”逻辑（onUpdateInit 变为 no-op）。

- PlayBar 显示与顺序
  - `src/components/PlayBar.ts`
    - 读取 `plugin.runtimeUiOverride`，若存在则优先于 `settings.playBar`。
    - `ui.order` 解析：
      - 数组：直接作为顺序。
      - 数字序列字符串：解析为索引并映射到 `defaultOrder`，默认仅显示列出的组件，并可被 `ui.components` 细化覆写。

- 全局设置定义
  - `src/settings/SettingTab.ts`
    - `TabFlowSettings.playBar.components` 与 `order` 的默认值与结构。

- 可靠性与安全
  - `src/editor/EmbeddableMarkdownEditor.ts`：对编辑器更新回调增加了多项防护（view/root/DOM/loaded），降低卸载过程中的异常概率。

## 已知限制 / 设计边界

- 块内迷你控件仅覆盖小部分高频功能；如需全量组件，请使用底部 PlayBar。
- 多个块互相覆盖 PlayBar 的运行期配置时，采用“后渲染优先”策略；若需更精细的可见性/焦点优先级管理，可在后续迭代。
- `order` 为数字序列时，默认“仅显示列出组件”的策略是为了简化；可通过 `components` 再放开其它组件。

## 优化方向 / Roadmap

- 统一控件栈：将块内迷你控件与 PlayBar 抽象为渲染层 + 策略层，支持更灵活的“按键可用性矩阵”。
- 块级 preset：支持 `ui.preset`（如 `minimal/practice/perform`）并允许 `components` 局部覆写。
- 更细的作用域：支持“按块 id 维持 PlayBar 覆盖”，避免多块覆盖冲突（引入优先队列或可见性优先规则）。
- 设置桥接：可选择将某些 `init` 配置落盘为文档元数据（frontmatter），以获得更强的复现性（默认仍不落盘）。
- 无障碍与键盘导航：为更多控件增加 aria-label 与快捷键，提升可达性。
- 国际化：将 UI 文案与文档抽离为可本地化资源。
- 测试与稳定性：
  - 增加对 `parseInlineInit` 的健壮性测试（多行/嵌套/转义）。
  - 针对多块滚动与 PlayBar 重挂载的集成测试。

## 参考与相关文档

- 使用手册与示例：`docs/sop/alphatex-ui-init-sop.md`
- 源码：
  - `src/markdown/AlphaTexBlock.ts`
  - `src/components/PlayBar.ts`
  - `src/main.ts`
  - `src/settings/SettingTab.ts`
  - `src/editor/EmbeddableMarkdownEditor.ts`
