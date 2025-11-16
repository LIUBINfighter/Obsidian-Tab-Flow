# 2025-11-16 TabView 滚动问题排查与修复

## 问题概述

- 日期：2025-11-16
- 模块：`TabView` / AlphaTab 滚动代理
- 现象：用户报告在某些环境下 TabView 的乐谱"不滚动"，包括自动跟随光标滚动和鼠标滚轮操作

## 潜在原因分析

经过代码审查和 AlphaTab 官方文档对照，识别出三个可能导致"不滚动"的方向：

### 1. 滚动容器选择错误

**问题描述：**
- 原先使用 `document.querySelector('.workspace-leaf-content.mod-active')` 等全局选择器查找滚动容器
- 在多 pane / 复杂布局下可能命中其他视图的容器，导致 AlphaTab 的滚动事件发生在错误的 DOM 元素上
- 用户看到的是自己的 TabView，但 `scrollElement` 绑定到了另一个 pane，视觉上就像"完全不滚"

**修复方案：**
- 改为从 `this.containerEl` 出发，使用 `closest('.workspace-leaf-content, .mod-root, .view-content')` 找到当前视图所在的 leaf 根节点
- 在该根节点内优先查找 `.view-content`，找不到则使用根节点本身
- 失败才回退到全局选择器 / `'html,body'`

```typescript
const leafRoot = this.containerEl.closest(
  '.workspace-leaf-content, .mod-root, .view-content'
) as HTMLElement | null;
if (leafRoot) {
  scrollElement = (leafRoot.querySelector('.view-content') as HTMLElement | null) ?? leafRoot;
}
```

### 2. 滚动模式设置未生效或被覆盖

**问题描述：**
- 插件设置中的 `scrollMode` 可能因为以下原因未正确应用：
  - 设置变更后没有重新调用 `configureScrollElement()`
  - 多个地方（DebugBar / ScrollEventManager / SettingTab）可能互相覆盖 `scrollMode`
  - 用户误将滚动模式设为 `off`，导致 AlphaTab 完全不滚动
- `nativeBrowserSmoothScroll` 若为 `true`，会忽略 `scrollSpeed` 设置，可能导致滚动体验不符合预期

**修复方案（调试版本）：**
- 强制锁定为 `ScrollMode.Continuous` 以排除设置问题
- 关闭 `nativeBrowserSmoothScroll`，使用 AlphaTab 自己的滚动控制
- 固定 `scrollSpeed = 300`
- 确保 `enableCursor = true`（滚动需要光标配合）

```typescript
this._api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
this._api.settings.player.nativeBrowserSmoothScroll = false;
this._api.settings.player.scrollSpeed = 300;
this._api.settings.player.enableCursor = true;
this._api.updateSettings();
```

### 3. 横向滚轮代理问题

**问题描述：**
- `setupHorizontalScroll` 可能只在特定条件下响应（例如只处理 `Shift + wheel`）
- 如果用户期待"普通竖向滚轮就能横向/纵向滑动谱子"，但实际需要特定键位组合，看起来就像"不响应"
- 滚动容器错误也会导致滚轮事件绑定到错误元素上

**排查方向：**
- 检查 `setupHorizontalScroll` 的实现，确认事件监听条件
- 确保横向滚动绑定在正确的 `scrollElement` 上
- 必要时在事件回调中添加日志，确认是否触发

## 已实施的修复

### 修复 1：优化滚动容器选择逻辑

- 文件：`src/views/TabView.ts`
- 方法：`configureScrollElement()`
- 变更：从全局 `querySelector` 改为基于当前视图的相对查找
- 提交日期：2025-11-16

### 修复 2：强制连续滚动配置（调试版本）

- 文件：`src/views/TabView.ts`
- 方法：`configureScrollElement()`
- 变更：
  - 锁定 `scrollMode = Continuous`
  - 关闭 `nativeBrowserSmoothScroll`
  - 固定 `scrollSpeed = 300`
  - 添加调试日志输出滚动容器和配置参数
- 目的：排除设置相关变量的干扰，确认基础滚动链路是否正常
- 提交日期：2025-11-16

### 修复 3：添加调试日志

在 `configureScrollElement()` 中添加：

```typescript
console.debug('[TabView] 设置滚动容器:', scrollElement.className, scrollElement);
console.debug(
  '[TabView] 滚动配置:',
  'mode=Continuous',
  'nativeBrowserSmoothScroll=false',
  'scrollSpeed=300',
  'enableCursor=true'
);
```

方便在用户环境中快速确认：
- `scrollElement` 是否绑定到正确的 DOM
- 滚动参数是否如预期应用

## AlphaTab API 用法验证

对照 AlphaTab 官方文档（通过 Context7 查询 `/coderline/alphatabwebsite`），确认以下 API 用法正确：

| API / 设置 | 当前用法 | 文档要求 | 状态 |
|-----------|---------|---------|------|
| `settings.player.scrollMode` | `ScrollMode.Continuous` | `ScrollMode = ScrollMode.Continuous` | ✅ 正确 |
| `settings.player.scrollSpeed` | `300` (number) | `scrollSpeed: number = 300` | ✅ 正确 |
| `settings.player.nativeBrowserSmoothScroll` | `false` | `boolean` | ✅ 正确 |
| `settings.player.scrollElement` | `HTMLElement \| 'html,body'` | 支持元素或选择器 | ✅ 正确 |
| `settings.player.enableCursor` | `true` | `boolean = true` | ✅ 正确 |
| `scrollToCursor()` | 配合 `tickPosition` 使用 | 官方示例一致 | ✅ 正确 |
| `updateSettings()` | 修改设置后调用 | 必须调用以应用更改 | ✅ 正确 |

**结论：** 当前代码对 AlphaTab API 的使用方式符合官方文档规范，问题更多出在"滚动容器选择"和"设置应用时机"上。

## 验证步骤

### 开发环境验证

1. 在 Obsidian 中重载插件（已执行 `npm run build`）
2. 打开 DevTools Console
3. 打开一个 TabView，观察日志：
   ```
   [TabView] 设置滚动容器: view-content <HTMLElement>
   [TabView] 滚动配置: mode=Continuous nativeBrowserSmoothScroll=false scrollSpeed=300 enableCursor=true
   ```
4. 播放或点击小节，观察：
   - 乐谱是否自动滚动到当前播放位置
   - 使用鼠标滚轮是否能滚动谱面
5. 在多 pane 布局下重复测试（左右分栏、上下分栏、浮动窗口）

### 用户环境排查清单

如果用户仍报告"不滚动"，请收集以下信息：

- [ ] Console 中的日志输出（尤其是 `[TabView] 设置滚动容器` 和 `滚动配置`）
- [ ] 使用的主题名称和版本
- [ ] 是否安装了其他修改布局/滚动行为的插件
- [ ] Obsidian 版本号
- [ ] 复现步骤（单 pane / 多 pane / 特定文件格式等）
- [ ] DevTools 中手动执行以下命令的结果：
  ```javascript
  const leaf = app.workspace.getLeavesOfType('tab-view')[0];
  const view = leaf.view;
  console.log('scrollElement:', view._api.settings.player.scrollElement);
  console.log('scrollMode:', view._api.settings.player.scrollMode);
  console.log('enableCursor:', view._api.settings.player.enableCursor);
  ```

## 后续优化方向

### 短期（当前调试版本验证通过后）

1. **恢复从插件设置读取滚动模式**
   - 将强制 `Continuous` 改回从 `this.plugin.settings.scrollMode` 读取
   - 添加设置变更监听，确保 SettingTab 修改后能实时应用到已打开的 TabView
   - 在 `DebugBar` / `ScrollEventManager` 中统一滚动配置接口，避免多处覆盖

2. **完善横向滚轮逻辑**
   - 检查 `setupHorizontalScroll` 实现，确认触发条件
   - 考虑添加插件设置："是否启用横向滚轮" / "滚轮行为（横向 / 纵向 / 缩放）"
   - 在调试模式下为滚轮事件添加日志

3. **在布局变化时重新配置滚动**
   - 监听 Obsidian 的 `layout-change` / `active-leaf-change` 事件
   - 在 pane 拖动、split、合并后重新调用 `configureScrollElement()`
   - 确保滚动容器始终绑定到当前活动的 TabView

### 中长期

1. **抽象滚动配置管理**
   - 创建 `ScrollConfigManager` 统一管理所有滚动相关设置
   - 提供事件驱动接口，避免直接修改 `_api.settings.player`
   - 确保 DebugBar、SettingTab、ScrollEventManager 之间的配置同步

2. **提供滚动诊断命令**
   - 在插件命令面板中添加"诊断滚动配置"命令
   - 输出当前 TabView 的滚动容器、模式、相关设置到 Notice / Console
   - 方便用户和开发者快速排查问题

3. **完善文档**
   - 在用户文档中说明滚动模式的区别（Continuous / OffScreen / Off）
   - 提供"滚动不工作"故障排除指南
   - 记录已知的主题/插件兼容性问题

## 相关文件

- `src/views/TabView.ts` - 主要修改
- `src/events/scrollEvents.ts` - 滚动事件管理器
- `src/utils/index.ts` - `setupHorizontalScroll` 实现
- `src/settings/tabs/PlayerTab.ts` - 滚动模式设置 UI

## 参考资料

- [AlphaTab 官方文档 - Player Settings](https://alphatab.net/docs/reference/settings/player)
- [AlphaTab 官方文档 - scrollToCursor](https://alphatab.net/docs/reference/api/scrolltocursor)
- [2025-11-16-editor-lifecycle.md](./2025-11-16-editor-lifecycle.md) - 相关生命周期问题复盘
