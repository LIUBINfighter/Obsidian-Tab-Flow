# 🧪 音轨配置持久化功能测试指南

## ✅ 实施完成

所有代码修改已完成并成功构建。以下是测试和验证步骤。

---

## 📋 实施清单

### ✅ 已完成的修改

1. **Schema 扩展** (`workspace-config-schema.ts`)
   - ✅ 添加 `TrackConfig` 接口
   - ✅ 在 `SessionPlayerState` 中添加 `trackConfigs: TrackConfig[]`
   - ✅ 更新默认配置包含空数组

2. **Store Actions** (`workspaceConfigStore.ts`)
   - ✅ 添加 `updateTrackConfig()` - 更新单个音轨配置
   - ✅ 添加 `getTrackConfig()` - 获取单个音轨配置
   - ✅ 添加 `resetTrackConfigs()` - 重置所有音轨配置

3. **组件集成** (`TrackItem.tsx`)
   - ✅ 添加 `controller` 属性
   - ✅ 从配置读取初始值（mute/solo/volume/transpose）
   - ✅ 修改后立即同步到配置

4. **配置恢复** (`PlayerController.ts`)
   - ✅ 添加 `restoreTrackConfigs()` 方法
   - ✅ 在 `scoreLoaded` 事件中调用恢复逻辑

5. **组件传递** (`TracksPanel.tsx`)
   - ✅ 传递 `controller` 给 `TrackItem`

---

## 🧪 测试步骤

### 测试 1：基本持久化

**目的**：验证音轨配置能够保存和恢复

1. **打开一个曲谱文件**（例如 `.gp` 或 `.alphatex`）
2. **打开音轨面板**（点击 Tracks 按钮）
3. **修改第一个音轨的设置**：
   - 点击 Mute 按钮（静音）
   - 调整音量滑块到 8
4. **关闭标签页**
5. **重新打开同一个曲谱文件**
6. **打开音轨面板**

**✅ 预期结果**：
- 第一个音轨仍然是静音状态
- 音量仍然是 8
- 其他音轨保持默认状态

**❌ 失败表现**：
- 音轨恢复为默认状态（非静音，音量 16）

---

### 测试 2：多音轨配置

**目的**：验证可以保存多个音轨的不同配置

1. **打开一个多音轨曲谱**
2. **修改多个音轨**：
   - Track 0: Mute = true
   - Track 1: Solo = true
   - Track 2: Volume = 10
3. **关闭并重新打开**

**✅ 预期结果**：
- Track 0 静音
- Track 1 独奏
- Track 2 音量 10
- 所有配置都正确恢复

---

### 测试 3：曲谱隔离

**目的**：验证不同曲谱的配置相互独立

1. **打开曲谱 A**
   - 设置 Track 0 为 Mute
   - 记下配置
2. **打开曲谱 B**（不修改任何设置）
3. **切换回曲谱 A**

**✅ 预期结果**：
- 曲谱 A 的 Track 0 仍是 Mute
- 曲谱 B 的所有音轨使用默认配置
- 两个曲谱的配置互不影响

---

### 测试 4：移调持久化

**目的**：验证移调设置也能正确保存

1. **打开曲谱**
2. **设置移调**：
   - Audio Transpose: +2
   - Full Transpose: -1
3. **关闭并重新打开**

**✅ 预期结果**：
- Audio Transpose 恢复为 +2
- Full Transpose 恢复为 -1
- 音高正确

---

### 测试 5：重启 Obsidian

**目的**：验证配置能在 Obsidian 重启后恢复

1. **打开曲谱并配置音轨**
2. **完全关闭 Obsidian**
3. **重新启动 Obsidian**
4. **打开之前的工作区**

**✅ 预期结果**：
- 所有音轨配置正确恢复
- 配置持久化到 workspace.json

---

## 🔍 调试验证

### 查看保存的配置

**方法 1：浏览器控制台**

```javascript
// 打开 Obsidian 开发者工具 (Ctrl+Shift+I)
// 在控制台中运行：

const view = app.workspace.getActiveViewOfType(require('obsidian').ItemView);
const state = view.getState();
console.log('Workspace State:', state);
console.log('Track Configs:', state.trackConfigs);
```

**方法 2：检查 workspace.json**

```bash
# 路径：.obsidian/workspace.json
# 搜索关键字：trackConfigs

# 示例内容：
{
  "state": {
    "type": "react-tab-view",
    "state": {
      "scoreSource": { ... },
      "sessionPlayerState": {
        "loopRange": null,
        "isLooping": false,
        "trackConfigs": [
          {
            "trackIndex": 0,
            "isMute": true,
            "volume": 8
          },
          {
            "trackIndex": 1,
            "isSolo": true
          }
        ]
      }
    }
  }
}
```

---

## 📊 日志检查

在 Obsidian 控制台中查看以下日志：

### 保存时的日志

```
[WorkspaceConfigStore] Updating track config: { trackIndex: 0, isMute: true }
[WorkspaceStorage] Saved to workspace: workspace-session-config
```

### 恢复时的日志

```
[PlayerController #5] Restoring track configs: [
  { trackIndex: 0, isMute: true, volume: 8 },
  { trackIndex: 1, isSolo: true }
]
[PlayerController #5] Applied transposition settings, triggering re-render
```

### 无配置时的日志

```
[PlayerController #5] No saved track configs to restore
```

---

## ⚠️ 已知限制

1. **音轨索引必须匹配**
   - 配置基于音轨索引（trackIndex）
   - 如果曲谱文件修改了音轨顺序，配置可能不匹配
   - 这是预期行为（与文件内容绑定）

2. **配置随标签页清除**
   - 配置保存在 workspace.json 的 view state 中
   - 关闭标签页会清除配置
   - 这是 Obsidian 的正常行为

3. **不同文件的配置独立**
   - 每个文件有独立的配置
   - 无法在文件之间共享音轨配置
   - 这是预期设计

---

## 🐛 常见问题排查

### Q1: 配置没有保存

**检查点**：
1. 确认修改后是否触发了 `updateTrackConfig()`
2. 检查浏览器控制台是否有错误
3. 确认 `workspaceConfig` store 正常工作
4. 查看 workspace.json 是否包含 trackConfigs

**解决方案**：
```javascript
// 手动测试保存
const controller = /* 获取 controller */;
controller.getWorkspaceConfigStore().getState().updateTrackConfig(0, {
  trackIndex: 0,
  isMute: true
});
```

### Q2: 配置没有恢复

**检查点**：
1. 确认 `restoreTrackConfigs()` 被调用（查看日志）
2. 确认 `scoreLoaded` 事件触发
3. 检查配置是否正确保存（见上文）
4. 确认音轨索引匹配

**解决方案**：
```javascript
// 手动测试恢复
const controller = /* 获取 controller */;
const configs = controller.getWorkspaceConfigStore().getState().sessionPlayerState.trackConfigs;
console.log('Saved configs:', configs);
```

### Q3: 重启后配置丢失

**检查点**：
1. 确认 workspace.json 包含配置
2. 确认使用的是同一个工作区
3. 检查 Obsidian 是否正确保存 workspace 状态

**解决方案**：
- 检查 Obsidian 设置 → 文件与链接 → 工作区
- 确保 "自动保存工作区" 已启用

---

## ✅ 验收标准

### 必须通过的测试

- ✅ 测试 1：基本持久化（Mute/Volume）
- ✅ 测试 2：多音轨配置
- ✅ 测试 3：曲谱隔离
- ✅ 测试 4：移调持久化
- ✅ 测试 5：重启恢复

### 日志验证

- ✅ 保存时有日志输出
- ✅ 恢复时有日志输出
- ✅ workspace.json 包含正确数据

### 用户体验

- ✅ 修改立即生效
- ✅ 配置持久化透明（用户无感知）
- ✅ 性能无明显影响

---

## 🎉 预期效果

修复完成后，用户将获得：

1. **一致的用户体验**
   - 音轨配置与曲谱绑定
   - 每次打开相同曲谱时配置自动恢复

2. **工作流改进**
   - 无需重复配置音轨
   - 支持练习特定声部（Solo/Mute）
   - 保存个性化音量设置

3. **符合直觉**
   - 行为与 DAW 软件一致
   - 配置保存在工作区状态中
   - 关闭标签页清除，重启保留

---

## 📝 下一步

如果测试通过：
- ✅ 合并到主分支
- ✅ 更新 CHANGELOG
- ✅ 关闭相关 Issue

如果测试失败：
- 🔍 查看日志定位问题
- 🐛 根据错误修复代码
- 🧪 重新测试
