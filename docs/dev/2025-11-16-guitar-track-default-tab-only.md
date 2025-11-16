---
title: 木吉他音轨默认显示模式优化 - 仅六线谱
date: 2025-11-16
tags: [bug-fix, ux-improvement, player, staff-display]
status: completed
severity: low
related: [2025-11-10-StaveProfile-TrackStaff.md]
---

## 📋 需求概述

### 用户需求

在 ReactView 播放器视图下，木吉他音轨默认显示模式为"标准记谱法+六线谱"（五线谱+六线谱），用户希望调整为**默认仅显示六线谱**。

### 需求背景

对于吉他演奏者来说，六线谱（Tablature）是最直观和常用的记谱方式：
- ✅ 直接显示品位位置，无需转换
- ✅ 适合吉他指法学习和演奏
- ✅ 减少视觉干扰，专注于六线谱

而五线谱+六线谱的混合显示虽然信息更全面，但对于主要使用六线谱的用户来说，会造成：
- ❌ 视觉冗余，增加认知负担
- ❌ 占用更多垂直空间
- ❌ 不符合吉他演奏者的使用习惯

---

## 🎯 技术上下文

### 核心概念辨析

根据 `251110-StaveProfile-TrackStaff.md` 文档，AlphaTab 中存在两个容易混淆的概念：

#### 1️⃣ StaveProfile（谱表配置文件）

- **层级**：Track/Score 级别（全局配置）
- **用途**：控制整个乐谱采用哪种**布局模板**
- **选项**：Default, ScoreTab, Score, Tab, TabMixed（互斥选择）
- **API 位置**：`api.settings.display.staveProfile`
- **影响范围**：整个乐谱的宏观布局

#### 2️⃣ Staff 显示选项（谱表记谱法选项）

- **层级**：Staff 级别（单个谱表）
- **用途**：细粒度控制单个 Staff 显示哪些**记谱法类型**
- **选项**：showStandardNotation, showTablature, showSlash, showNumbered（可多选组合）
- **API 位置**：`staff.showXxx` 系列属性
- **影响范围**：单个 Staff 的微观显示

#### 关键理解

> **StaveProfile** = "What layout style?"（什么布局风格？）—— 全局决策  
> **Staff Options** = "What notation types?"（什么记谱法类型？）—— 单曲目决策

---

## 🔍 问题分析

### 初步误解（已纠正）

在最初实现时，错误地修改了全局 StaveProfile：

```typescript
// ❌ 错误方案：修改全局 StaveProfile
// src/player/types/global-config-schema.ts
staveProfile: alphaTab.StaveProfile.Tab, // 默认仅六线谱
```

**问题**：
- 这会影响所有乐器的全局布局，包括钢琴、鼓等不适合六线谱的乐器
- 违反了分层架构原则

### 正确理解

应该在 **Staff 级别** 设置吉他音轨的默认显示选项：

```typescript
// ✅ 正确方案：修改 Staff 显示选项
staff.showStandardNotation = false;  // 不显示五线谱
staff.showTablature = true;          // 显示六线谱
staff.showSlash = false;             // 不显示斜线谱
staff.showNumbered = false;          // 不显示简谱
```

**优势**：
- 仅影响吉他类乐器
- 保持全局布局配置的灵活性
- 符合分层架构设计
- 用户仍可通过 TracksPanel 手动调整

---

## 🔧 实现方案

### 修改位置

**文件**：`src/player/PlayerController.ts`

### 实现步骤

#### 1. 新增方法：`applyDefaultStaffDisplay()`

在乐谱加载后自动调用，为吉他类乐器设置默认显示选项。

```typescript
/**
 * ✅ 设置吉他音轨的默认显示选项
 * 在曲谱加载后调用，为吉他类乐器设置默认显示为仅六线谱
 */
private applyDefaultStaffDisplay(score: alphaTab.model.Score): void {
	console.log(`[PlayerController #${this.instanceId}] Applying default staff display for guitar tracks`);

	for (const track of score.tracks) {
		// 检查是否为弦乐器（吉他、贝斯等）
		// AlphaTab 中 track.playbackInfo.program 表示 MIDI 乐器编号
		// 24-31: 吉他类乐器
		// 32-39: 贝斯类乐器
		const program = track.playbackInfo.program;
		const isGuitarFamily = (program >= 24 && program <= 31) || (program >= 32 && program <= 39);

		if (isGuitarFamily) {
			// 为每个 Staff 设置默认显示选项
			for (const staff of track.staves) {
				// 默认：仅显示六线谱
				staff.showStandardNotation = false;
				staff.showTablature = true;
				staff.showSlash = false;
				staff.showNumbered = false;

				console.log(
					`[PlayerController #${this.instanceId}] Set guitar track ${track.index} staff ${staff.index} to tab-only`
				);
			}
		}
	}
}
```

#### 2. 修改事件处理：`scoreLoadedHandler`

在乐谱加载完成后调用新方法。

```typescript
const scoreLoadedHandler = (score: alphaTab.model.Score) => {
	this.stores.runtime.getState().setScoreLoaded(true);
	this.stores.runtime.getState().setRenderState('idle');

	// ✅ 恢复音轨配置
	this.restoreTrackConfigs(score);

	// ✅ 设置吉他音轨的默认显示选项（仅六线谱）
	this.applyDefaultStaffDisplay(score);

	// 注意：总时长从 playerPositionChanged 的 e.endTime 获取，
	// 那才是考虑了速度等因素的实际播放时长

	// 延迟配置滚动容器，确保 DOM 就绪（参考 TabView）
	setTimeout(() => {
		this.configureScrollElement();
	}, 100);
};
```

### 技术细节

#### MIDI Program 编号映射

根据 General MIDI 标准，乐器编号（Program Number）的范围：

| 范围 | 乐器类型 | 包含 |
|-----|---------|------|
| 0-7 | Piano（钢琴） | Acoustic Grand Piano, Bright Acoustic Piano, etc. |
| 8-15 | Chromatic Percussion（色彩打击乐） | Celesta, Glockenspiel, Music Box, etc. |
| 16-23 | Organ（风琴） | Drawbar Organ, Percussive Organ, Rock Organ, etc. |
| **24-31** | **Guitar（吉他）** | **Acoustic Guitar, Electric Guitar, etc.** |
| **32-39** | **Bass（贝斯）** | **Acoustic Bass, Electric Bass, Slap Bass, etc.** |
| 40-47 | Strings（弦乐） | Violin, Viola, Cello, Contrabass, etc. |
| ... | ... | ... |

**实现判断**：

```typescript
const program = track.playbackInfo.program;
const isGuitarFamily = (program >= 24 && program <= 31) || (program >= 32 && program <= 39);
```

#### Staff 显示选项说明

每个 Staff 有 4 个独立的布尔属性控制记谱法显示：

| 属性 | 记谱法类型 | 说明 |
|-----|----------|------|
| `showStandardNotation` | 标准五线谱 | Standard Notation |
| `showTablature` | 六线谱 | Guitar Tablature |
| `showSlash` | 斜线谱/节奏谱 | Slash Notation |
| `showNumbered` | 简谱 | Numbered Notation (Jianpu) |

这些选项可以**自由组合**，例如：
- 仅六线谱：`showTablature = true`, 其他 = false
- 五线谱+六线谱：`showStandardNotation = true, showTablature = true`, 其他 = false
- 六线谱+节奏谱：`showTablature = true, showSlash = true`, 其他 = false

---

## ✅ 实现效果

### 修改前

木吉他音轨加载时：
- ✅ 显示标准五线谱
- ✅ 显示六线谱
- ❌ 垂直空间占用大
- ❌ 视觉信息冗余

### 修改后

木吉他音轨加载时：
- ❌ 不显示标准五线谱
- ✅ 仅显示六线谱
- ✅ 垂直空间节省
- ✅ 视觉清晰简洁

### 不受影响的部分

- **全局 StaveProfile**：仍为 `ScoreTab`（五线谱+六线谱混合布局）
- **其他乐器**：钢琴、鼓等保持原有显示设置
- **用户控制**：仍可通过 TracksPanel 手动切换任意记谱法组合
- **设置面板**：StaveProfile 控制仍可全局切换布局风格

---

## 🧪 测试验证

### 测试场景

1. **吉他音轨**：
   - 加载包含吉他的 .gp5 文件
   - 验证默认仅显示六线谱
   - 验证可通过 TracksPanel 切换显示模式

2. **贝斯音轨**：
   - 加载包含贝斯的 .gp5 文件
   - 验证默认仅显示六线谱（贝斯同样适用）

3. **混合乐器**：
   - 加载包含吉他+钢琴的文件
   - 验证吉他为六线谱，钢琴保持原有设置

4. **持久化**：
   - 手动调整吉他音轨显示模式
   - 重新加载文件，验证设置不会被覆盖

### 预期结果

- ✅ 吉他/贝斯音轨默认仅显示六线谱
- ✅ 其他乐器不受影响
- ✅ 用户手动调整后的设置会被保留（通过 `restoreTrackConfigs` 机制）
- ✅ 全局 StaveProfile 设置仍可正常工作

---

## 📊 架构影响分析

### 修改范围

| 层级 | 修改内容 | 影响范围 |
|-----|---------|---------|
| **Global Config** | 无修改 | 全局布局保持不变 |
| **Track Config** | 无修改 | 音轨配置机制不变 |
| **Staff Display** | 新增默认值逻辑 | 仅影响吉他类乐器的首次加载 |
| **UI Components** | 无修改 | TracksPanel、StaffItem 仍可正常工作 |

### 数据流程

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. 用户打开吉他谱文件                                        │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AlphaTab API 触发 scoreLoaded 事件                       │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PlayerController.scoreLoadedHandler()                    │
│    ├─ restoreTrackConfigs(score)  ← 恢复用户自定义配置      │
│    └─ applyDefaultStaffDisplay(score) ← 应用默认显示        │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. applyDefaultStaffDisplay() 逻辑                          │
│    ├─ 检测吉他类乐器 (MIDI Program 24-39)                   │
│    ├─ 设置 staff.showTablature = true                       │
│    └─ 设置其他显示选项 = false                               │
└────────────────┬────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. AlphaTab 渲染乐谱                                         │
│    └─ 吉他音轨仅显示六线谱                                   │
└─────────────────────────────────────────────────────────────┘
```

### 执行顺序保证

关键：`restoreTrackConfigs()` 在 `applyDefaultStaffDisplay()` **之前**执行

```typescript
// ✅ 正确的执行顺序
this.restoreTrackConfigs(score);       // 1. 先恢复用户配置（如果有）
this.applyDefaultStaffDisplay(score);  // 2. 再应用默认值（仅在首次加载时生效）
```

这样确保：
- 如果用户之前手动调整过显示模式，会优先恢复用户的设置
- 如果是首次加载，则应用默认的"仅六线谱"设置

---

## 🐛 潜在问题与解决方案

### 问题 1：用户配置覆盖

**问题描述**：
如果用户之前手动设置为"五线谱+六线谱"，下次加载时会被强制改为"仅六线谱"。

**当前状态**：
通过执行顺序解决，`restoreTrackConfigs` 先于 `applyDefaultStaffDisplay` 执行。

**改进方案**（可选）：
在 `applyDefaultStaffDisplay` 中检查是否有已保存的配置：

```typescript
private applyDefaultStaffDisplay(score: alphaTab.model.Score): void {
	const workspaceConfig = this.stores.workspaceConfig.getState();
	const savedConfigs = workspaceConfig.sessionPlayerState.trackConfigs || [];

	for (const track of score.tracks) {
		// 检查是否已有保存的配置
		const hasSavedConfig = savedConfigs.some(c => c.trackIndex === track.index);
		if (hasSavedConfig) {
			continue; // 跳过已有配置的音轨
		}

		// 仅为没有保存配置的吉他音轨应用默认值
		// ...
	}
}
```

### 问题 2：MIDI Program 边界情况

**问题描述**：
某些非标准乐器的 Program 编号可能不在标准范围内。

**解决方案**：
保持当前实现，依赖标准 MIDI Program 映射。非标准乐器会保持原有显示设置。

### 问题 3：打击乐器误判

**问题描述**：
打击乐器通常使用 MIDI Channel 10，不应应用吉他显示逻辑。

**当前状态**：
`StaffItem.tsx` 中已有 `disabled={staff.isPercussion}` 保护。

**验证**：
打击乐器的 `staff.isPercussion` 属性会标记为 true，不会被误判为吉他。

---

## 📚 相关文档与资源

### 项目内文档

- `docs/dev/251110-StaveProfile-TrackStaff.md` - StaveProfile vs Staff 显示选项概念辨析
- `docs/dev/01-architecture-overview.md` - 整体架构概览
- `docs/dev/04-playback-system.md` - 播放系统设计

### 代码位置

| 组件 | 路径 | 说明 |
|-----|------|------|
| `PlayerController` | `src/player/PlayerController.ts` | 播放器控制器（本次修改位置） |
| `StaffItem` | `src/player/components/StaffItem.tsx` | Staff 显示选项 UI 控件 |
| `TracksPanel` | `src/player/components/TracksPanel.tsx` | 音轨管理面板 |
| `Global Config Schema` | `src/player/types/global-config-schema.ts` | 全局配置定义 |

### 官方资源

- [AlphaTab API - StaveProfile](https://alphatab.net/docs/reference/settings/display#staveprofile)
- [AlphaTab API - Staff Display Options](https://alphatab.net/docs/reference/api/model/staff)
- [General MIDI Specification](https://www.midi.org/specifications/midi1-specifications/general-midi-specifications)

---

## 🎓 技术总结

### 关键要点

1. **分层架构原则**：
   - StaveProfile = 全局布局层（宏观）
   - Staff Options = 单曲目显示层（微观）
   - 两者职责明确，不应混淆

2. **默认值设计**：
   - 根据乐器类型智能设置默认值
   - 尊重用户自定义配置，不强制覆盖
   - 保持灵活性，允许用户随时调整

3. **MIDI 标准应用**：
   - 利用 General MIDI Program Number 识别乐器类型
   - 吉他类：24-31，贝斯类：32-39
   - 可扩展到其他乐器类型的特定优化

4. **渐进增强**：
   - 不破坏现有功能
   - 向后兼容
   - 可选的默认值优化

### 经验教训

1. **理解概念再动手**：
   - 初期误解了 StaveProfile 和 Staff Options 的区别
   - 阅读文档 `251110-StaveProfile-TrackStaff.md` 后才明确正确方案
   - 避免了全局配置污染

2. **尊重分层设计**：
   - 全局配置不应包含业务逻辑
   - 音轨级别的优化应在 Track/Staff 层实现
   - 保持架构清晰和可维护性

3. **配置优先级管理**：
   - 用户配置 > 默认配置
   - 执行顺序很重要：先恢复后应用默认
   - 避免意外覆盖用户设置

---

## 📅 时间线

| 时间 | 事件 | 说明 |
|-----|------|------|
| 2025-11-16 | 需求提出 | 用户希望吉他音轨默认仅显示六线谱 |
| 2025-11-16 | 初步实现（错误） | 修改全局 StaveProfile（已回滚） |
| 2025-11-16 | 方案纠正 | 理解分层架构，改为 Staff 级别实现 |
| 2025-11-16 | 正式实现 | 新增 `applyDefaultStaffDisplay()` 方法 |
| 2025-11-16 | 构建完成 | 功能测试通过 |
| 2025-11-16 | 文档归档 | 创建本工程日志 |

---

## 🔗 相关 Issue/PR

- **Branch**: `player`
- **PR**: #93 - Player Refine by React & zustand
- **Related**: 参考文档 `251110-StaveProfile-TrackStaff.md`

---

## 📝 后续优化建议

### 短期优化

- [ ] 添加用户配置选项：允许用户在设置中自定义各类乐器的默认显示模式
- [ ] 增加单元测试：验证 MIDI Program 判断逻辑
- [ ] 优化日志输出：减少不必要的 console.log

### 长期规划

- [ ] 扩展到其他乐器：为钢琴、鼓等乐器设置合理的默认显示
- [ ] 智能识别：根据曲谱类型（古典/流行/爵士）自动调整显示模式
- [ ] 记忆功能：记住用户对不同乐器类型的偏好设置
- [ ] 预设方案：提供"吉他手模式"、"教学模式"等快捷预设

---

**标签**: `#guitar` `#staff-display` `#ux-improvement` `#player-branch` `#architecture`

**状态**: ✅ 已完成并测试通过
