# Settings Panel & Tracks Panel 实现总结

## 🎉 完成内容

本次重构成功实现了两个强大的调试和管理组件：

### 1. SettingsPanel - 设置调试面板

**位置**: 右侧滑入侧边栏

**功能**:
- ✅ 完整的 AlphaTab Settings 配置
- ✅ Display、Player、Core 等 6 个设置组
- ✅ 支持多种控件类型（Range、Toggle、Dropdown、ButtonGroup、NumberInput）
- ✅ 配置导出/导入（JSON）
- ✅ 复制配置到剪贴板
- ✅ 重置为默认值
- ✅ 日志调试工具

**文件**:
- `src/player/components/SettingsPanel.tsx`
- `src/player/components/SettingsToggle.tsx`
- `src/styles/settings-panel.css`
- `src/player/utils/settingsUtils.ts`
- `docs/dev/settings-panel-guide.md`

### 2. TracksPanel - 音轨管理面板

**位置**: 左侧滑入侧边栏

**功能**:
- ✅ 音轨选择/取消选择
- ✅ Solo/Mute 控制
- ✅ 音量调节（实时生效）
- ✅ 完全移调（影响显示和播放）
- ✅ 音频移调（仅影响播放）
- ✅ 全选/清空批量操作
- ✅ 实时预览调整效果

**文件**:
- `src/player/components/TracksPanel.tsx`
- `src/player/components/TrackItem.tsx`（复用）
- `src/player/components/StaffItem.tsx`（复用）
- `src/styles/tracks-panel.css`
- `docs/dev/tracks-panel-guide.md`

## 🎨 设计亮点

### 统一的交互体验

```
Left Panel (Tracks)         Main View         Right Panel (Settings)
┌──────────────┐       ┌─────────────────┐       ┌──────────────┐
│ Solo/Mute    │       │                 │       │ Scale        │
│ Volume       │       │   AlphaTab      │       │ Layout       │
│ Transpose    │◄──────┤   Rendering     │──────►│ Player       │
│              │       │                 │       │ Core         │
└──────────────┘       └─────────────────┘       └──────────────┘
   实时音轨控制              可同时查看效果              实时设置调试
```

### 关键优势

| 特性 | 实现方式 | 用户收益 |
|------|---------|---------|
| **非阻塞交互** | 侧边栏设计 | 调整时可实时查看谱面 |
| **多面板共存** | 独立位置（左/右） | 可同时调试音轨和设置 |
| **实时反馈** | 直接操作 API | 无需关闭面板即可生效 |
| **配置持久化** | Zustand + localStorage | 设置在会话间保留 |
| **样式统一** | CSS 变量 | 完美融入 Obsidian 主题 |

## 📐 架构设计

### Factory Pattern（SettingsPanel）

参考 AlphaTab 官方 Playground：

```typescript
const factory = {
  settingAccessors(setting: string) {
    // AlphaTab Settings 访问器
  },
  
  apiAccessors(property: string) {
    // API 直接属性访问器
  },
  
  configAccessors(path: string) {
    // ConfigStore 访问器（持久化）
  },
  
  // 便捷方法
  numberRange(label, setting, min, max, step) { ... },
  toggle(label, setting) { ... },
  enumDropDown(label, setting, enumType) { ... },
};
```

### Event-Driven Updates（TracksPanel）

```typescript
// 监听 AlphaTab 事件，自动同步状态
useAlphaTabEvent(api, 'renderStarted', () => {
  updateSelectedTracks();
});

useAlphaTabEvent(api, 'scoreLoaded', (score) => {
  setScore(score);
});
```

### 控件抽象

所有控件实现统一接口：

```typescript
interface ControlProps extends ValueAccessor {
  inputId: string;
}

interface ValueAccessor {
  getValue(context: SettingsContextProps): any;
  setValue(context: SettingsContextProps, value: any): void;
}
```

支持的控件：
- `EnumDropDown` - 枚举下拉框
- `NumberRange` - 数字滑块
- `NumberInput` - 数字输入框
- `BooleanToggle` - 开关切换
- `ButtonGroup` - 按钮组

## 🔧 集成方式

### TablatureView 集成

```tsx
const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
const [tracksPanelOpen, setTracksPanelOpen] = useState(false);

return (
  <div>
    <PlayBar
      controller={controller}
      onTracksClick={() => setTracksPanelOpen(true)}
      onSettingsClick={() => setSettingsPanelOpen(true)}
    />
    
    <TracksPanel
      controller={controller}
      isOpen={tracksPanelOpen}
      onClose={() => setTracksPanelOpen(false)}
    />
    
    <SettingsPanel
      controller={controller}
      isOpen={settingsPanelOpen}
      onClose={() => setSettingsPanelOpen(false)}
    />
  </div>
);
```

### PlayBar 更新

```tsx
interface PlayBarProps {
  controller: PlayerController;
  onSettingsClick?: () => void;  // 新增
  onTracksClick?: () => void;    // 新增
}

// 添加切换按钮
{onTracksClick && <TracksToggle onClick={onTracksClick} />}
{onSettingsClick && <SettingsToggle onClick={onSettingsClick} />}
```

## 📝 配置管理

### SettingsPanel 工具

**日志当前设置**:
```javascript
console.log('API Settings:', api.settings);
console.log('Config Store:', useConfigStore.getState().config);
```

**导出配置**:
```typescript
exportConfigToJSON(config, 'my-settings.json');
```

**导入配置**:
```typescript
const config = await importConfigFromJSON();
useConfigStore.getState().updateConfig(() => config);
```

**复制到剪贴板**:
```typescript
await copyConfigToClipboard(config);
```

### 配置持久化

```typescript
// Zustand persist 中间件
{
  name: 'alphatab-player-config',
  version: 2,
  migrate: (state, version) => {
    // 自动迁移旧配置
  }
}
```

## 🎯 使用场景

### 场景 1：调试布局问题

1. 打开 SettingsPanel（右侧）
2. 调整 Display → General:
   - Scale: 1.5
   - Layout Mode: Horizontal
   - Bars Per Row: 4
3. 实时查看渲染效果
4. 导出配置分享给团队

### 场景 2：混音调整

1. 打开 TracksPanel（左侧）
2. 调整各音轨音量：
   - Guitar: 80%
   - Bass: 60%
   - Drums: 70%
3. 使用 Solo/Mute 对比效果
4. 无需关闭面板，实时听到变化

### 场景 3：为伴奏转调

1. 打开 TracksPanel
2. 选择伴奏音轨
3. 调整"音频移调": +2
4. 乐谱显示不变，音频升 2 个半音
5. 适合演唱不同调性的歌曲

### 场景 4：同时调试

1. **左侧** TracksPanel: 调整音量、移调
2. **右侧** SettingsPanel: 调整缩放、布局
3. **中间** 主视图: 实时查看所有效果
4. 极高的调试效率！

## 💡 技术亮点

### 1. Context Pattern

```typescript
const SettingsContext = createContext<SettingsContextProps>(null!);

// 所有控件共享 context
const context = useContext(SettingsContext);
const value = getValue(context);
setValue(context, newValue);
```

### 2. Factory Pattern

```typescript
const setting = factory.numberRange(
  'Scale',
  'display.scale',
  0.25,
  2,
  0.25
);
// 自动生成访问器和控件配置
```

### 3. Event Hook

```typescript
useAlphaTabEvent(api, 'eventName', callback, dependencies);
// 自动订阅/取消订阅
```

### 4. 样式变量

```css
.settings-panel {
  background: var(--background-primary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
}
```

自动适配 Obsidian 亮色/暗色主题！

## 📊 代码统计

| 组件 | 代码行数 | 样式行数 |
|------|---------|---------|
| SettingsPanel.tsx | ~650 | - |
| TracksPanel.tsx | ~160 | - |
| settings-panel.css | - | ~320 |
| tracks-panel.css | - | ~280 |
| settingsUtils.ts | ~80 | - |
| **总计** | **~890** | **~600** |

## 🚀 性能优化

### 已实现

- ✅ 使用 `useState` 本地缓存（减少 store 订阅）
- ✅ 控件 `onChange` 直接更新（无防抖延迟）
- ✅ 折叠分组（减少 DOM 节点）
- ✅ 条件渲染（面板关闭时不渲染内容）

### 可选增强

- [ ] 虚拟滚动（大量音轨时）
- [ ] 防抖音量调整（减少 API 调用）
- [ ] Lazy Loading（分组按需加载）
- [ ] Memoization（React.memo 优化）

## 📚 文档

### 已创建文档

1. **settings-panel-guide.md** - Settings Panel 完整指南
   - 功能特性
   - 架构设计
   - 使用方法
   - 扩展指南

2. **tracks-panel-guide.md** - Tracks Panel 完整指南
   - 设计理念
   - 功能特性
   - 与 Modal 对比
   - 工作流示例

### 示例代码

所有文档都包含：
- ✅ 完整的代码示例
- ✅ 使用场景演示
- ✅ 调试技巧
- ✅ 注意事项

## 🎓 学到的经验

### 1. 参考官方实现的重要性

AlphaTab Playground 的设计非常优秀：
- Factory Pattern 提高可维护性
- Context Pattern 简化状态传递
- 统一的控件接口易于扩展

### 2. 用户体验至上

从 Modal 改为 Panel 的决策：
- 需求：实时查看调整效果
- 解决：侧边栏不完全遮挡
- 结果：显著提升用户体验

### 3. 样式一致性

两个面板使用相同的设计语言：
- 相同的 header/footer 结构
- 相同的控件样式
- 相同的动画效果
- 用户学习成本低

## ⚠️ 已知限制

### SettingsPanel

1. 颜色选择器未实现（需 Chrome Color Picker 库）
2. 字体选择器未实现（需字体列表）
3. 部分高级设置未暴露（如 Notation Elements）

### TracksPanel

1. 音轨数量过多时（>20）可能需要虚拟滚动
2. 移调后重新渲染有短暂延迟
3. 至少保留一个音轨的限制

## 🔮 未来扩展

### SettingsPanel

- [ ] 颜色选择器（参考官方 ColorPicker）
- [ ] 字体选择器
- [ ] 预设配置管理（保存多个配置）
- [ ] 设置搜索和过滤
- [ ] 实时预览（悬停显示效果）
- [ ] 导出为分享链接

### TracksPanel

- [ ] 音轨拖拽排序
- [ ] 音轨颜色标记
- [ ] 音轨分组
- [ ] 音轨效果器（EQ、Reverb）
- [ ] 单音轨导出
- [ ] 音轨模板

### 通用

- [ ] 快捷键支持
- [ ] 多语言支持
- [ ] 暗色/亮色主题切换
- [ ] 面板位置自定义
- [ ] 面板宽度调整

## ✅ 总结

本次实现成功创建了两个专业级的调试和管理组件：

**技术成就**:
- ✨ 参考官方最佳实践
- 🏗️ 清晰的架构设计
- 🎨 优秀的用户体验
- 📝 完善的文档

**用户价值**:
- 🚀 极大提升调试效率
- 🎛️ 实时预览调整效果
- 💾 配置导入导出便捷
- 🎯 符合 DAW 软件习惯

**代码质量**:
- ✅ TypeScript 类型安全
- ✅ 模块化设计
- ✅ 可扩展架构
- ✅ 良好的注释

这是一个非常成功的重构！🎉🎸
