# 源码阅读指南：StaveProfile Bug 相关代码

## 🎯 阅读目标

理解"错误实现"（StaveProfile）和"正确实现"（Staff 显示选项）的区别

---

## 📚 推荐阅读顺序

### 阶段 1：理解问题 - 错误实现（15 分钟）

#### 1. 旧版遗留代码（0.3.x）⚠️ 
**文件**：`src/components/controls/StaveProfileButton.ts`

**关键代码**：
```typescript
// 查看循环切换的 5 个 StaveProfile 选项
private readonly profiles = [
  { value: alphaTab.StaveProfile.Default, label: '默认模式' },
  { value: alphaTab.StaveProfile.ScoreTab, label: '五线谱+六线谱' },
  { value: alphaTab.StaveProfile.Score, label: '仅五线谱' },
  { value: alphaTab.StaveProfile.Tab, label: '仅六线谱' },  // ← Bug！
  { value: alphaTab.StaveProfile.TabMixed, label: '混合六线谱' },
];

private handleClick(): void {
  // 注意：这里只是简单切换枚举值
  this.currentProfile = this.profiles[nextIndex].value;
  this.onClick?.(this.currentProfile);
}
```

**问题点**：
- ❌ 使用 `StaveProfile.Tab` 只会隐藏五线谱
- ❌ 不会在六线谱上显示节奏信息
- ❌ 因为 StaveProfile 只是个布局模板，不是记谱法组合

---

#### 2. 新版继承代码（0.4.x player 分支）⚠️
**文件**：`src/player/components/StaveProfileControl.tsx`

**关键代码**（第 14-22 行）：
```typescript
export const StaveProfileControl: React.FC<StaveProfileControlProps> = ({ controller }) => {
  const globalConfig = controller.getGlobalConfigStore();

  const profiles = [
    { name: '五线谱+六线谱', value: alphaTab.StaveProfile.ScoreTab },
    { name: '仅五线谱', value: alphaTab.StaveProfile.Score },
    { name: '仅六线谱', value: alphaTab.StaveProfile.Tab },  // ← 继承了 Bug！
    { name: '混合模式', value: alphaTab.StaveProfile.TabMixed },
  ];
  // ...
```

**关键方法**（第 28-41 行）：
```typescript
const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const newProfile = parseInt(e.target.value) as alphaTab.StaveProfile;
  setProfile(newProfile);

  // 更新全局配置（持久化）
  globalConfig.getState().updateAlphaTabSettings({
    display: {
      ...globalConfig.getState().alphaTabSettings.display,
      staveProfile: newProfile,  // ← 仍然只是切换全局模板
    },
  });

  // 同步到 API
  controller.setStaveProfile(newProfile);  // ← 看这里！
};
```

**问题点**：
- ❌ 直接从 `.ts` 改写为 `.tsx`，逻辑未改变
- ❌ 仍然使用 `controller.setStaveProfile()`
- ❌ 没有控制 Staff 级别的显示选项

---

#### 3. PlayerController 中的 setStaveProfile 方法
**文件**：`src/player/PlayerController.ts`

**关键代码**（第 750-757 行）：
```typescript
/**
 * 设置谱表模式
 */
setStaveProfile(profile: alphaTab.StaveProfile): void {
  if (!this.api) return;
  // StaveProfile 需要通过 settings.display.staveProfile 设置
  this.api.settings.display.staveProfile = profile;
  this.api.updateSettings();
  this.api.render();
}
```

**问题点**：
- ⚠️ 这个方法本身没问题（正确使用了 AlphaTab API）
- ❌ 但 `StaveProfile` 这个 API 设计就是粗粒度的，无法解决 bug
- ✅ 需要的是修改 Staff 属性，而不是 StaveProfile

---

### 阶段 2：理解正解 - 正确实现（20 分钟）

#### 4. Staff 显示选项组件 ✅
**文件**：`src/player/components/StaffItem.tsx`

**核心状态**（第 47-52 行）：
```typescript
const [staffOptions, _setStaffOptions] = useState<StaffOptions>({
  showNumbered: staff.showNumbered,           // 简谱
  showSlash: staff.showSlash,                 // 节奏谱 ← 关键！
  showTablature: staff.showTablature,         // 六线谱
  showStandardNotation: staff.showStandardNotation,  // 五线谱
});
```

**副作用应用**（第 58-65 行）：
```typescript
useEffect(() => {
  // 应用配置到 staff 对象
  for (const key in staffOptions) {
    (staff as any)[key] = (staffOptions as any)[key];
  }

  // 重新渲染
  api.render();
}, [api, staff, staffOptions]);
```

**切换方法示例**（第 89-93 行）：
```typescript
const toggleTablature = () => {
  setStaffOptions((options) => ({
    ...options,
    showTablature: !options.showTablature,  // ← 直接控制 Staff 属性！
  }));
};
```

**紧凑模式渲染**（第 125-167 行）：
```typescript
if (isCompact) {
  return (
    <>
      {/* 标准记谱法按钮 - 五线谱 */}
      <button onClick={toggleStandardNotation}>𝅘𝅥</button>
      
      {/* 六线谱按钮 */}
      <button onClick={toggleTablature}>TAB</button>
      
      {/* 斜线记谱法按钮 - 节奏谱 ← 这个就是解决方案！ */}
      <button onClick={toggleSlash}>𝄍</button>
      
      {/* 简谱按钮 */}
      <button onClick={toggleNumbered}>123</button>
    </>
  );
}
```

**优势**：
- ✅ 直接操作 `staff.showXxx` 属性（AlphaTab 原生支持）
- ✅ 可以自由组合 4 种记谱法
- ✅ 例如：`showTablature + showSlash` = 带节奏的六线谱！

---

#### 5. TrackItem 组件（包含 StaffItem）
**文件**：`src/player/components/TrackItem.tsx`

**StaffItem 的使用**（第 242-245 行）：
```typescript
<div className="tabflow-track-header-row-2">
  {track.staves.map((staff) => (
    <StaffItem key={staff.index} api={api} staff={staff} isCompact={true} />
  ))}
</div>
```

**关键理解**：
- ✅ 每个 Track 可以有多个 Staff
- ✅ 每个 Staff 独立控制显示选项
- ✅ 这就是为什么可以精细控制

---

#### 6. TracksPanel 顶层组件
**文件**：`src/player/components/TracksPanel.tsx`

**TrackItem 的使用**（第 132-141 行）：
```typescript
{score.tracks.map((track) => (
  <TrackItem
    key={track.index}
    api={api}
    track={track}
    isSelected={selectedTracks.has(track.index)}
    onSelectionChange={handleTrackSelectionChange}
    controller={controller}  // ← 传递 controller 用于配置持久化
  />
))}
```

**UI 入口**（DebugBar 中调用）：
- 用户点击音轨管理按钮 → 打开 TracksPanel
- 在面板中可以看到每个音轨的 4 个记谱法按钮
- 点击切换，实时生效

---

### 阶段 3：对比 API 使用（10 分钟）

#### 7. AlphaTab 配置创建
**文件**：`src/player/PlayerController.ts`

**createAlphaTabSettings 方法**（第 277-360 行）：
```typescript
private createAlphaTabSettings(): any {
  const globalConfig = this.stores.globalConfig.getState();
  
  const settings: any = {
    display: {
      // ...
      // ⚠️ 这里设置了 staveProfile（全局）
      // 但没有设置 staff 级别的显示选项
    },
    // ...
  };
  
  return settings;
}
```

**问题**：
- 初始化时只设置了 `staveProfile`
- 没有初始化 `staff.showXxx` 属性
- 导致后续只能全局切换，不能精细控制

**改进方向**：
```typescript
// 建议在乐谱加载后，初始化 staff 显示选项
score.tracks.forEach(track => {
  track.staves.forEach(staff => {
    staff.showTablature = true;
    staff.showSlash = true;  // ← 确保节奏信息显示
    // ...
  });
});
```

---

#### 8. 全局配置结构
**文件**：`src/player/types/global-config-schema.ts`

**StaveProfile 在配置中的定义**（第 35 行）：
```typescript
display: {
  scale: number;
  layoutMode: alphaTab.LayoutMode;
  barsPerRow: number;
  stretchForce: number;
  staveProfile: alphaTab.StaveProfile; // 谱表模式 ← 全局配置
};
```

**默认值**（第 127 行）：
```typescript
staveProfile: alphaTab.StaveProfile.ScoreTab, // 默认五线谱+六线谱
```

**问题**：
- ⚠️ 配置中只有 `staveProfile`（全局）
- ❌ 没有 Staff 级别的显示选项配置
- 💡 Staff 选项应该在 Workspace Config（会话级）或 Track Config 中

---

### 阶段 4：理解数据流（10 分钟）

#### 9. 状态管理 - GlobalConfig Store
**文件**：`src/player/store/GlobalConfigStore.ts`（如果存在）

查看：
- `alphaTabSettings.display.staveProfile` 的更新逻辑
- 是否有 Staff 显示选项的状态管理

#### 10. 状态管理 - WorkspaceConfig Store
**文件**：`src/player/store/WorkspaceConfigStore.ts`（如果存在）

查看：
- Track 配置的保存和恢复
- 是否应该在这里保存 Staff 显示选项

---

## 🔑 关键代码对比总结

### ❌ 错误实现（StaveProfile）

```typescript
// 1. 定义选项（互斥）
const profiles = [
  { name: '仅六线谱', value: alphaTab.StaveProfile.Tab }
];

// 2. 应用到 API（全局）
api.settings.display.staveProfile = alphaTab.StaveProfile.Tab;
api.updateSettings();
api.render();

// 结果：只显示六线谱，但没有节奏信息
```

### ✅ 正确实现（Staff 显示选项）

```typescript
// 1. 定义选项（可组合）
const staffOptions = {
  showTablature: true,         // 显示六线谱
  showSlash: true,             // 显示节奏信息 ← 关键！
  showStandardNotation: false, // 不显示五线谱
  showNumbered: false          // 不显示简谱
};

// 2. 应用到 Staff（细粒度）
staff.showTablature = true;
staff.showSlash = true;
api.render();

// 结果：六线谱带有完整的节奏符干和时值信息
```

---

## 📊 代码调用链

### 错误实现的调用链 ❌

```
用户点击"仅六线谱"
    ↓
StaveProfileControl.handleChange()
    ↓
controller.setStaveProfile(StaveProfile.Tab)
    ↓
api.settings.display.staveProfile = Tab
    ↓
api.updateSettings() + api.render()
    ↓
结果：只有"光秃秃"的六线谱数字
```

### 正确实现的调用链 ✅

```
用户点击 StaffItem 的按钮
    ↓
toggleTablature() / toggleSlash()
    ↓
setStaffOptions({ showTablature: true, showSlash: true })
    ↓
useEffect 触发：staff.showXxx = value
    ↓
api.render()
    ↓
结果：六线谱 + 节奏符干（完整信息）
```

---

## 🎯 阅读检查清单

完成以下理解后，你就掌握了这个 bug 的全貌：

- [ ] 理解 `StaveProfile` 是全局枚举（5 选 1）
- [ ] 理解 `Staff 显示选项` 是布尔标志（可组合）
- [ ] 看到 `StaveProfileControl.tsx` 继承了旧 bug
- [ ] 看到 `StaffItem.tsx` 使用了正确的 API
- [ ] 理解 `staff.showSlash` 是显示节奏信息的关键
- [ ] 知道为什么 TracksPanel 可以精细控制
- [ ] 知道如何修复 DebugBar 中的控件

---

## 🔧 实验建议

### 实验 1：复现 Bug

1. 在 DebugBar 中选择"仅六线谱"
2. 观察：六线谱上没有节奏符干
3. 打开浏览器 DevTools → Console
4. 输入：`api.settings.display.staveProfile`
5. 确认输出：`3` (StaveProfile.Tab)

### 实验 2：验证正解

1. 打开 TracksPanel
2. 点击某个音轨的按钮组合：TAB（开）+ 𝄍（开）
3. 观察：六线谱带有完整的节奏信息
4. DevTools Console 输入：
   ```javascript
   api.score.tracks[0].staves[0].showTablature  // true
   api.score.tracks[0].staves[0].showSlash      // true
   ```

---

## 📚 额外阅读（可选）

如果想深入理解 AlphaTab API：

1. **AlphaTab 数据模型**：
   - `node_modules/@coderline/alphatab/dist/alphaTab.d.ts`
   - 搜索 `interface Staff` 和 `enum StaveProfile`

2. **官方示例**（alphaTex 语法）：
   - `\staff {score tabs slash numbered}` 的实现原理

3. **渲染流程**：
   - `PlayerController.rebuildApi()` 方法
   - 理解何时重新创建 API vs 何时只重新渲染

---

## 🎓 总结

**核心认知**：
- `StaveProfile` = 宏观布局模板（粗调）
- `Staff 显示选项` = 微观记谱法组合（精调）

**Bug 本质**：
- 用了"粗调"工具去做"精调"任务
- 就像用扳手去拧螺丝——能用，但不精确

**修复方向**：
- 把 DebugBar 的快捷切换改为预设的 Staff 选项组合
- 或者直接引导用户使用 TracksPanel 的精细控制

---

**Happy Code Reading! 🎸**
