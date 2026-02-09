# Media Sync 同步模式指南

## 📋 概述

Media Sync 支持三种同步模式，满足不同的使用场景：

1. **双向同步**（Bidirectional）- 默认模式
2. **媒体为主**（Media Master）
3. **曲谱为主**（Score Master）

---

## 🎯 三种模式详解

### 1️⃣ 双向同步（Bidirectional）⇄

**适用场景**：
- 同时查看曲谱和音频/视频
- 需要灵活控制播放进度
- 学习和练习新曲目

**行为说明**：

| 操作来源 | 对应效果 |
|---------|---------|
| 点击曲谱中的小节 | ✅ 外部媒体跳转到对应位置 |
| 点击 AlphaTab 播放按钮 | ✅ 外部媒体开始播放 |
| 拖动外部媒体进度条 | ✅ 曲谱光标跳转到对应位置 |
| 点击外部媒体播放按钮 | ✅ 曲谱开始播放 |
| 调整外部媒体音量 | ✅ AlphaTab 主音量同步 |
| 调整外部媒体速度 | ✅ AlphaTab 播放速度同步 |

**代码示例**：
```typescript
mediaSyncService.setSyncMode(SyncMode.Bidirectional);
```

---

### 2️⃣ 媒体为主（Media Master）▶

**适用场景**：
- 使用高质量录音学习
- 跟随音乐会录像练习
- YouTube 视频教学跟谱

**行为说明**：

| 操作来源 | 对应效果 |
|---------|---------|
| 点击曲谱中的小节 | ❌ 外部媒体**不会**跳转 |
| 点击 AlphaTab 播放按钮 | ❌ 外部媒体**不会**播放 |
| 拖动外部媒体进度条 | ✅ 曲谱光标跳转到对应位置 |
| 点击外部媒体播放按钮 | ✅ 曲谱开始播放 |
| 调整外部媒体音量 | ✅ AlphaTab 主音量同步 |
| 调整外部媒体速度 | ✅ AlphaTab 播放速度同步 |

**特点**：
- 🎯 外部媒体**完全独立**，用户手动控制
- 📍 曲谱光标**自动跟随**外部媒体
- 🎓 适合观看视频教程时对照曲谱

**代码示例**：
```typescript
mediaSyncService.setSyncMode(SyncMode.MediaMaster);
```

---

### 3️⃣ 曲谱为主（Score Master）♪

**适用场景**：
- 精准练习特定小节
- 使用 AlphaTab 的循环播放功能
- 需要频繁跳转到不同位置

**行为说明**：

| 操作来源 | 对应效果 |
|---------|---------|
| 点击曲谱中的小节 | ✅ 外部媒体跳转到对应位置 |
| 点击 AlphaTab 播放按钮 | ✅ 外部媒体开始播放 |
| 拖动外部媒体进度条 | ❌ 曲谱光标**不会**跳转 |
| 点击外部媒体播放按钮 | ❌ 曲谱**不会**播放 |
| 调整外部媒体音量 | ❌ AlphaTab 主音量**不同步** |
| 调整外部媒体速度 | ❌ AlphaTab 播放速度**不同步** |

**特点**：
- 🎹 曲谱控制一切，外部媒体**被动跟随**
- 🔄 适合使用 AlphaTab 的高级功能（循环、计数等）
- 🎯 外部媒体的手动操作**不影响**曲谱状态

**代码示例**：
```typescript
mediaSyncService.setSyncMode(SyncMode.ScoreMaster);
```

---

## 💻 UI 使用方法

### 选择同步模式

在 Media Sync 面板的工具栏右侧有一个下拉菜单：

```
┌─────────────────────────────────────┐
│ 🎵 ▶️ 📹 YouTube     [⇄ 双向同步 ▼] │
├─────────────────────────────────────┤
│                                     │
│  选项：                             │
│  • ⇄ 双向同步    (默认)             │
│  • ▶ 媒体为主                       │
│  • ♪ 曲谱为主                       │
│                                     │
└─────────────────────────────────────┘
```

### 动态切换

- ✅ 可以在播放过程中切换同步模式
- ✅ 切换立即生效，无需重新加载媒体
- ⚠️ 切换后当前的播放状态可能需要手动调整

---

## 🔧 技术实现

### SyncMode 枚举

```typescript
export enum SyncMode {
  Bidirectional = 'bidirectional',  // 双向同步
  MediaMaster = 'media-master',     // 媒体为主
  ScoreMaster = 'score-master',     // 曲谱为主
}
```

### SyncModeConfig 接口

```typescript
interface SyncModeConfig {
  mode: SyncMode;
  allowMediaControlScore: boolean;  // 是否允许媒体控制曲谱
  allowScoreControlMedia: boolean;  // 是否允许曲谱控制媒体
}
```

### 控制逻辑

#### AlphaTab → 外部媒体

```typescript
// 在 IExternalMediaHandler 中
play(): void {
  if (mediaElement && config.allowScoreControlMedia) {
    mediaElement.play();
  }
}
```

#### 外部媒体 → AlphaTab

```typescript
// 在 media event handlers 中
const onPlay = () => {
  if (config.allowMediaControlScore) {
    api.play();
  }
};
```

---

## 📊 模式对比表

| 功能 | 双向同步 | 媒体为主 | 曲谱为主 |
|------|:--------:|:--------:|:--------:|
| 点击曲谱跳转媒体 | ✅ | ❌ | ✅ |
| 曲谱控制媒体播放 | ✅ | ❌ | ✅ |
| 媒体进度更新曲谱 | ✅ | ✅ | ❌ |
| 媒体控制曲谱播放 | ✅ | ✅ | ❌ |
| 音量同步 | ✅ | ✅ | ❌ |
| 速度同步 | ✅ | ✅ | ❌ |

---

## 🎓 使用建议

### 初学者
推荐使用 **双向同步**，可以灵活地在曲谱和音频之间切换。

### 跟随视频学习
推荐使用 **媒体为主**，曲谱自动跟随 YouTube 教程进度。

### 精准练习
推荐使用 **曲谱为主**，使用 AlphaTab 的循环功能反复练习特定段落。

---

## 🔮 未来扩展

可能的增强功能：

1. **智能模式切换**：根据用户行为自动切换模式
2. **自定义同步规则**：允许用户精细控制每个同步方向
3. **模式记忆**：为每个谱子记住上次使用的同步模式
4. **快捷键切换**：例如 `Ctrl+M` 循环切换模式

---

## 📝 注意事项

1. **YouTube 模式**：由于 YouTube IFrame API 的限制，某些操作可能有延迟
2. **性能考虑**：媒体为主模式下，高频率的 `timeupdate` 事件可能影响性能
3. **同步精度**：受限于浏览器的 `currentTime` 精度（通常为 100ms）
