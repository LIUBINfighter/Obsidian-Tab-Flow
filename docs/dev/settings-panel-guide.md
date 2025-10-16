# Settings Panel - 开发调试组件

## 概述

Settings Panel 是一个强大的调试和配置组件，参考 AlphaTab 官方 Playground 实现，提供完整的 AlphaTab Settings 配置和插件扩展设置。

## 功能特性

### 🎛️ 完整的设置控制

#### Display ▸ General
- **Render Engine**: SVG / HTML5 切换
- **Scale**: 缩放比例 (0.25 - 2.0)
- **Stretch Force**: 拉伸力度 (0.25 - 2.0)
- **Layout Mode**: 布局模式（水平/页面）
- **Bars Per Row**: 每行小节数 (-1 = 自动)
- **Start Bar**: 起始小节
- **Bar Count**: 小节数量

#### Display ▸ Stave Profile
- **Stave Profile**: 谱表模式（默认/仅五线谱/仅六线谱等）

#### Player ▸ Playback
- **Master Volume**: 主音量 (0.0 - 1.0)
- **Metronome Volume**: 节拍器音量
- **Count-In Volume**: 预备拍音量
- **Playback Speed**: 播放速度 (0.25x - 2x)
- **Looping**: 循环播放开关

#### Player ▸ Cursor & Scroll
- **Show Cursor**: 显示播放光标
- **Animated Beat Cursor**: 动画节拍光标
- **Scroll Mode**: 滚动模式（连续/关闭/垂直）
- **Scroll Speed**: 滚动速度（毫秒）
- **Scroll Offset X/Y**: 滚动偏移量

#### Player ▸ Advanced
- **Player Mode**: 播放器模式
- **Enable User Interaction**: 启用用户交互

#### Core ▸ Engine
- **Use Workers**: 使用 Web Workers
- **Include Note Bounds**: 包含音符边界
- **Log Level**: 日志级别

### 🛠️ 调试工具

#### 配置管理
- **📋 Log Current Settings**: 在控制台输出当前设置
- **📄 Copy Config to Clipboard**: 复制配置到剪贴板
- **💾 Export Config as JSON**: 导出配置为 JSON 文件
- **📂 Import Config from JSON**: 从 JSON 文件导入配置
- **🔄 Reset to Defaults**: 重置为默认设置

## 架构设计

### 三层配置架构

```
┌─────────────────────────────────────┐
│   SettingsPanel (React Component)  │
│   • UI 渲染和交互                   │
│   • 控件组件（Toggle/Range/Select）│
└─────────────────────────────────────┘
              ↓ Context
┌─────────────────────────────────────┐
│      Settings Context               │
│   • controller: PlayerController    │
│   • onSettingsUpdated: callback     │
└─────────────────────────────────────┘
              ↓ Accessors
┌─────────────────────────────────────┐
│      Value Accessors (Factory)      │
│   • settingAccessors (AlphaTab API) │
│   • apiAccessors (API properties)   │
│   • configAccessors (Zustand Store) │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Target Stores & API               │
│   • AlphaTab.Settings               │
│   • ConfigStore (持久化)            │
│   • RuntimeStore (会话)             │
└─────────────────────────────────────┘
```

### Factory Pattern

参考官方实现，使用工厂模式创建设置访问器：

```typescript
const factory = {
  // AlphaTab Settings 访问器
  settingAccessors(setting: string, updateOptions?: UpdateSettingsOptions) {
    return {
      getValue(context) { /* 从 api.settings 读取 */ },
      setValue(context, value) { 
        /* 更新 api.settings + api.updateSettings() + api.render() */ 
      }
    };
  },
  
  // API 直接属性访问器
  apiAccessors(property: string) {
    return {
      getValue(context) { return api[property]; },
      setValue(context, value) { api[property] = value; }
    };
  },
  
  // Config Store 访问器（持久化）
  configAccessors(path: string) {
    return {
      getValue(context) { /* 从 ConfigStore 读取 */ },
      setValue(context, value) { /* 更新 ConfigStore */ }
    };
  }
};
```

### 控件组件

所有控件都实现统一的接口：

```typescript
type ControlProps = ValueAccessor & { inputId: string };

// 示例：EnumDropDown
const EnumDropDown: React.FC<EnumDropDownSchema & ControlProps> = ({
  enumType,
  inputId,
  getValue,
  setValue
}) => {
  const context = useContext(SettingsContext)!;
  const currentValue = getValue(context);
  
  return (
    <select 
      id={inputId} 
      value={currentValue}
      onChange={(e) => setValue(context, Number.parseInt(e.target.value))}
    >
      {/* options */}
    </select>
  );
};
```

支持的控件类型：
- **ButtonGroup**: 按钮组（如 SVG/HTML5）
- **EnumDropDown**: 枚举下拉框
- **NumberRange**: 数字滑块（带实时预览）
- **NumberInput**: 数字输入框
- **BooleanToggle**: 开关切换

## 使用方法

### 1. 集成到 TablatureView

```tsx
import { SettingsPanel } from './SettingsPanel';

const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

return (
  <div>
    <PlayBar 
      controller={controller} 
      onSettingsClick={() => setSettingsPanelOpen(true)} 
    />
    
    <SettingsPanel
      controller={controller}
      isOpen={settingsPanelOpen}
      onClose={() => setSettingsPanelOpen(false)}
    />
  </div>
);
```

### 2. 添加 SettingsToggle 到 PlayBar

```tsx
import { SettingsToggle } from './SettingsToggle';

<SettingsToggle 
  controller={controller} 
  onClick={onSettingsClick} 
/>
```

### 3. 导入样式

在 `src/styles/` 中已创建 `settings-panel.css`，使用 merge-styles 脚本合并。

## 扩展设置项

### 添加新的设置组

```typescript
{
  title: 'My Custom Group',
  settings: [
    factory.toggle('My Toggle', 'mySection.myToggle'),
    factory.numberRange('My Range', 'mySection.myRange', 0, 10, 1),
    factory.enumDropDown('My Enum', 'mySection.myEnum', MyEnum),
  ]
}
```

### 添加自定义访问器

```typescript
{
  label: 'Custom Setting',
  getValue(context: SettingsContextProps) {
    // 自定义读取逻辑
    return context.controller.getSomeValue();
  },
  setValue(context: SettingsContextProps, value: any) {
    // 自定义写入逻辑
    context.controller.setSomeValue(value);
    context.onSettingsUpdated();
  },
  control: { type: 'boolean-toggle' }
}
```

## 配置持久化

### 自动持久化
- AlphaTab Settings 通过 `ConfigStore` 自动持久化到 localStorage
- 使用 Zustand persist 中间件，key: `alphatab-player-config`

### 导出/导入
- 导出为 JSON 文件（包含完整配置）
- 从 JSON 文件导入（自动重载页面）
- 复制到剪贴板（便于分享）

### 配置迁移
ConfigStore 支持版本迁移：

```typescript
{
  name: 'alphatab-player-config',
  version: 2,
  migrate: (persistedState, version) => {
    if (version < 2) {
      // 迁移逻辑
    }
    return persistedState;
  }
}
```

## 样式定制

### CSS 变量适配

所有样式使用 Obsidian CSS 变量：

```css
.settings-panel {
  background-color: var(--background-primary);
  border-left: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
}

.settings-button-active {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}
```

### 响应式设计

- 桌面：固定宽度 400px，从右侧滑入
- 移动端：全屏显示

## 调试技巧

### 1. 查看实时配置
点击 "Log Current Settings" 查看：
- `api.settings`: AlphaTab 当前设置
- `ConfigStore`: 持久化配置

### 2. 对比设置差异
```javascript
const apiSettings = api.settings;
const storeConfig = useConfigStore.getState().config.alphaTabSettings;
console.log('Diff:', deepDiff(apiSettings, storeConfig));
```

### 3. 测试配置组合
1. 调整设置
2. 导出 JSON
3. 在不同环境导入测试

### 4. 重置为已知良好状态
- 保存工作配置的 JSON 备份
- 实验后快速导入恢复

## 注意事项

### ⚠️ 设置更新时机

部分设置需要 `api.updateSettings()` + `api.render()`：
- Display 相关设置
- Layout 变化

部分设置仅需 `api.updateSettings()`：
- Player 滚动相关

部分设置直接生效：
- API 属性（masterVolume, playbackSpeed）

### ⚠️ 配置同步

Settings Panel 操作的是三个目标：
1. **AlphaTab API Settings** - 运行时生效
2. **ConfigStore** - 持久化存储
3. **RuntimeStore** - 会话状态

确保访问器正确更新所有相关存储。

### ⚠️ 枚举值映射

TypeScript 枚举在 AlphaTab 中：
```typescript
enum ScrollMode {
  Off = 0,
  Continuous = 1,
  OffsetContinuous = 2
}
```

使用 `EnumDropDown` 自动处理枚举映射。

## 未来扩展

- [ ] 颜色选择器（参考官方 ColorPicker）
- [ ] 字体选择器（Font Picker）
- [ ] 预设配置管理（保存/加载多个配置）
- [ ] 设置搜索和过滤
- [ ] 设置分组折叠状态持久化
- [ ] 实时预览（悬停显示效果）
- [ ] 快捷键支持
- [ ] 多语言支持

## 相关文件

- `src/player/components/SettingsPanel.tsx` - 主组件
- `src/player/components/SettingsToggle.tsx` - 切换按钮
- `src/player/utils/settingsUtils.ts` - 工具函数
- `src/styles/settings-panel.css` - 样式文件
- `src/player/types/config-schema.ts` - 配置类型定义
