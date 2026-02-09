# Bug 简要说明：谱表切换功能不完整

## 🎯 一句话总结

**旧版"五线谱/六线谱切换"功能是残缺的，新版本直接搬运了这个 bug，但正确的实现方式已经在 TracksPanel 中完成了。**

---

## 🐛 问题描述

### 0.3.x 的遗留问题

在原版播放器中，"谱表切换"功能存在缺陷：

```
用户操作：选择"仅显示六线谱"
实际效果：❌ 只是隐藏了五线谱，节拍/时值等元素没有显示到六线谱上
预期效果：✅ 六线谱应该包含完整的音乐信息（节奏记号、时值符干等）
```

**原因**：使用了错误的 API（`StaveProfile`），这只是个全局布局开关，不能精细控制。

### 0.4.x player 分支的继承

- ❌ 新版 `StaveProfileControl.tsx` 直接从旧 `StaveProfileButton.ts` 改写
- ❌ **没有修复原有功能缺陷**
- ✅ 但 `TracksPanel` 使用了正确的实现方式

---

## ✅ 正确的实现（已存在于 TracksPanel）

### 两个不同的概念

| 概念 | 作用 | 现状 |
|-----|------|------|
| **StaveProfile** | 全局布局模式（5选1） | ⚠️ 当前 DebugBar 使用（有问题） |
| **Staff 显示选项** | 单个谱表记谱法控制（可组合） | ✅ TracksPanel 使用（正确） |

### Staff 显示选项的优势

可以自由组合 4 种记谱法：

```typescript
// 示例：六线谱 + 节奏谱（这样节拍信息就显示出来了！）
staff.showStandardNotation = false;  // 不显示五线谱
staff.showTablature = true;          // 显示六线谱
staff.showSlash = true;              // 显示节奏谱 ← 关键！
staff.showNumbered = false;          // 不显示简谱
```

---

## 📊 对比示例

### 旧实现（StaveProfile）

```typescript
// ❌ 问题：只能二选一，无法显示节奏信息
api.settings.display.staveProfile = StaveProfile.Tab;  // 仅六线谱
// 结果：六线谱是"光秃秃"的，没有节拍符干
```

### 新实现（Staff 显示选项）

```typescript
// ✅ 正确：可以组合多种记谱法
staff.showTablature = true;   // 显示六线谱
staff.showSlash = true;        // 同时显示节奏信息
// 结果：六线谱带有完整的节奏符干和时值信息
```

---

## 🔧 修复建议

### 方案 1：替换现有控件（推荐）

将 `StaveProfileControl` 改为使用 Staff 显示选项：

```typescript
// 当前：切换 StaveProfile（功能残缺）
controller.setStaveProfile(profile);

// 改为：切换 Staff 显示选项（功能完整）
staff.showTablature = true;
staff.showSlash = true;  // 确保节奏信息显示
api.render();
```

### 方案 2：保留双控制（临时方案）

- `StaveProfileControl`：快速全局布局切换（保留，但添加警告提示）
- `TracksPanel` → `StaffItem`：精细控制（已经正确）

---

## 📚 技术细节

详见完整文档：`251110-StaveProfile-TrackStaff.md`

---

## 🎯 关键要点

1. **StaveProfile** 是全局布局模板（粗粒度）
2. **Staff 显示选项** 是记谱法组合（细粒度）✅
3. 旧版只用了 StaveProfile，所以"六线谱"模式是残缺的
4. TracksPanel 已经用了正确的方式（Staff 显示选项）

**一句话**：把 DebugBar 的快捷切换改成用 Staff 显示选项，就能修复这个十年老 bug 了。
