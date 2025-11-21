---
date: 2025-11-18
tags: [bugfix, ui, tracks-panel, react, alphatab]
severity: high
status: resolved
---

# TracksPanel 多谱表渲染修复

## 问题描述

### 症状
在 `TracksPanel` 中，当一个 Track 包含多个 Staves（如钢琴的大谱表：右手高音谱表 + 左手低音谱表）时，出现以下问题：

1. **React Key 冲突**：所有谱表的控制按钮都渲染在同一行，无法区分不同的谱表
2. **UI 混乱**：8 个按钮（2 个谱表 × 4 个按钮）全部挤在一行显示
3. **用户体验差**：无法识别哪些按钮属于哪个谱表

### 测试用例
```alphatex
\title "简单钢琴练习曲"
\track "Piano" 
    \instrument "Acoustic Grand Piano"
    \tuning piano
    
    // 右手部分 (高音谱表)
    \staff {score}
        :4 C4 D4 E4 F4 | G4 A4 B5 C5 |
    
    // 左手部分 (低音谱表)
    \staff {score} \clef F4
        (C3 E3 G3).1 | (G2 B2 D3).1 |
```

此代码定义了 **1 个 Track** 包含 **2 个 Staves**，但在 UI 中只显示为一个音轨条目，且两个谱表的按钮混在一起。

## 根本原因分析

### 数据模型理解
根据 alphaTab 官方文档，数据层级结构为：
- **Score** → 包含多个 **Tracks**
- **Track** → 可以包含多个 **Staves**（如钢琴的 Grand Staff）
- **Staff** → 具体的谱表，可以是五线谱/六线谱/简谱/斜线谱等

### 代码问题定位

#### 问题 1：TracksPanel.tsx 中的 Track Key 生成
**原代码**（第 151 行）：
```tsx
score.tracks.map((track) => (
    <TrackItem
        key={track.index}  // ❌ 如果两个 Track 的 index 相同会冲突
        ...
    />
))
```

#### 问题 2：TrackItem.tsx 中的 Staff Key 生成
**原代码**（第 243 行）：
```tsx
track.staves.map((staff) => (
    <StaffItem 
        key={staff.index}  // ❌ 同一 Track 内的多个 Staves 可能 index 相同
        ...
    />
))
```

#### 问题 3：Staff 按钮布局问题
**原代码**：
```tsx
<div className="tabflow-track-header-row-2">
    {track.staves.map((staff) => (
        <StaffItem ... />  // ❌ 所有 Staff 的按钮都渲染在同一容器内
    ))}
</div>
```

所有谱表的按钮（`isCompact=true` 模式下直接返回按钮组）都被渲染到同一个 flex 容器中，导致无法区分。

## 解决方案

### 1. 修复 React Key 生成策略

#### TracksPanel.tsx
```tsx
score.tracks.map((track, arrayIndex) => (
    <TrackItem
        key={`track-${track.index}-${arrayIndex}-${track.name}`}
        // ✅ 组合三个维度：index + 数组位置 + 名称
        ...
    />
))
```

#### TrackItem.tsx - Staff 分组渲染
```tsx
<div className="tabflow-track-header-row-2">
    {track.staves.map((staff, staffArrayIndex) => (
        <div
            key={`staff-${track.index}-${staff.index}-${staffArrayIndex}`}
            // ✅ 组合：Track index + Staff index + 数组位置
            className="tabflow-staff-group"
        >
            <span className="tabflow-staff-label">谱表 {staffArrayIndex + 1}</span>
            <StaffItem api={api} staff={staff} isCompact={true} />
        </div>
    ))}
</div>
```

### 2. 优化 CSS 布局

#### tracks-panel.css
```css
/* 将谱表容器改为纵向布局 */
.tabflow-track-header-row-2 {
    display: flex;
    flex-direction: column;  /* ✅ 改为纵向 */
    gap: 8px;
    width: 100%;
}

/* 为每个谱表创建独立的卡片式容器 */
.tabflow-staff-group {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
}

/* 谱表标签样式 */
.tabflow-staff-label {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
    min-width: 50px;
    flex-shrink: 0;
}
```

## 修改文件清单

1. **src/player/components/TracksPanel.tsx**
   - 修改 Track 的 React key 生成逻辑

2. **src/player/components/TrackItem.tsx**
   - 修改 Staff 的 React key 生成逻辑
   - 为每个 Staff 添加独立的分组容器
   - 添加谱表标签（"谱表 1", "谱表 2"）

3. **src/styles/new-react-player/tracks-panel.css**
   - 更新 `.tabflow-track-header-row-2` 为纵向布局
   - 新增 `.tabflow-staff-group` 卡片容器样式
   - 新增 `.tabflow-staff-label` 标签样式

## 修复效果

### 修复前
```
Piano [👁️] [🎤] [🔊]
[♪] [TAB] [/] [123] [♪] [TAB] [/] [123]  ← 8 个按钮挤在一行
```

### 修复后
```
Piano [👁️] [🎤] [🔊]
┌─────────────────────────────────┐
│ 谱表 1  [♪] [TAB] [/] [123]    │  ← 独立的谱表组 1
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 谱表 2  [♪] [TAB] [/] [123]    │  ← 独立的谱表组 2
└─────────────────────────────────┘
音量: [==========] 94%
完全移调: [====] 0
音频移调: [====] 0
```

## 技术要点

### React Key 最佳实践
1. **避免使用单一属性作为 key**：`index` 或 `name` 单独使用可能不唯一
2. **组合多个维度**：`${type}-${id}-${arrayIndex}-${name}` 确保唯一性
3. **数组位置作为后备**：`arrayIndex` 可以保证在同一数组中的唯一性

### alphaTab 数据模型理解
- 一个 **Track** 可以包含多个 **Staves**（如钢琴大谱表）
- **Staves** 是真正的显示单元，每个 Staff 有独立的显示选项
- UI 设计应该反映这种层级关系：Track → Staves

### UI/UX 改进
- 使用卡片式分组增强视觉层次
- 添加明确的标签（"谱表 1", "谱表 2"）提升可识别性
- 纵向布局避免横向拥挤，提升可读性

## 相关问题

### 已解决
- ✅ TracksPanel 中同名 Track 的分离问题
- ✅ 多谱表 Track 的 UI 显示问题
- ✅ Staff 级别的独立控制

### 潜在风险
- ⚠️ 如果 alphaTab 返回的 `staff.index` 为 `undefined` 或 `null`，key 生成可能仍有问题
- ⚠️ 需要在大量音轨（如交响乐总谱）场景下测试性能

## 测试建议

1. **基础测试**：
   - 单 Track 单 Staff（吉他独奏）
   - 单 Track 双 Staff（钢琴大谱表）
   - 多 Track 混合（乐队编制）

2. **边界测试**：
   - 同名 Track（如两个 "Piano"）
   - 超多 Staves 的 Track（如 4 个以上）
   - 空 Track（无 Staff）

3. **交互测试**：
   - 切换不同谱表的显示选项
   - Solo/Mute 不同音轨
   - 音量和移调控制

## 参考资料

- [alphaTab 官方文档 - Tracks & Staves](https://alphatab.net/docs/alphatex/tracks-staves)
- [React 官方文档 - Lists and Keys](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)
- alphaTab 数据模型查询（通过 #mcp_context7_get-library-docs）

## 后续优化建议

1. **可折叠谱表组**：当 Staves 较多时，允许折叠/展开每个谱表的控制
2. **谱表重命名**：允许用户为每个 Staff 自定义名称（如 "右手"、"左手"）
3. **快捷操作**：添加"全选/全不选"当前 Track 所有 Staves 的快捷按钮
4. **状态持久化**：记住用户对每个 Staff 的显示偏好设置

## 提交信息

```
fix(TracksPanel): separate multi-staff rendering with proper React keys

- Add unique composite keys for Track and Staff components
- Create independent staff groups with labels
- Update CSS for vertical staff layout
- Improve UI clarity for Grand Staff tracks (e.g., Piano)

Closes: Multiple staff rendering issue in TracksPanel
```
