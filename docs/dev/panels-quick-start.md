# Settings Panel & Tracks Panel - Quick Start

## 概述

新增两个强大的侧边栏组件，提供专业级的调试和管理功能。

## 快速使用

### 打开 Settings Panel（设置面板）

点击 PlayBar 右侧的 **⚙️ Settings** 按钮

**功能**:
- 调整显示设置（缩放、布局、谱表）
- 配置播放参数（速度、音量、滚动）
- 核心引擎设置（Workers、日志级别）
- 导出/导入配置
- 重置为默认值

### 打开 Tracks Panel（音轨面板）

点击 PlayBar 左侧的 **🎵 Tracks** 按钮

**功能**:
- 选择/取消选择音轨
- Solo/Mute 控制
- 调整音量（实时生效）
- 移调（完全移调 / 仅音频）
- 全选/清空批量操作

## 主要特性

### 🎨 双侧边栏设计

```
Tracks Panel (左)    Main View (中)    Settings Panel (右)
```

- 可同时打开两个面板
- 实时预览调整效果
- 不完全遮挡主视图

### 💾 配置持久化

- 所有设置自动保存到 localStorage
- 支持导出为 JSON 文件
- 可从 JSON 文件导入配置
- 一键重置为默认值

### 🎯 实时反馈

- 音量调整立即生效
- 移调实时听到变化
- 布局调整即刻渲染
- 无需关闭面板

## 详细文档

- [Settings Panel 完整指南](./settings-panel-guide.md)
- [Tracks Panel 完整指南](./tracks-panel-guide.md)
- [实现总结](./panels-implementation-summary.md)

## 键盘快捷键（计划中）

- `Ctrl/Cmd + ,` - 打开 Settings Panel
- `Ctrl/Cmd + T` - 打开 Tracks Panel
- `Esc` - 关闭当前面板

## 常见使用场景

**调试布局问题**:
1. 打开 Settings Panel
2. 调整 Scale、Layout Mode、Bars Per Row
3. 实时查看效果

**混音调整**:
1. 打开 Tracks Panel
2. 调整各音轨音量
3. 使用 Solo/Mute 对比

**为伴奏转调**:
1. 打开 Tracks Panel
2. 选择伴奏音轨
3. 调整"音频移调"（乐谱显示不变）

**同时调试**:
1. 左侧打开 Tracks Panel（音轨控制）
2. 右侧打开 Settings Panel（显示设置）
3. 实时查看所有变化

## 注意事项

- ⚠️ 至少保留一个音轨
- ⚠️ 移调范围：-12 ~ +12 半音
- ⚠️ 某些设置需要重新渲染（可能有短暂延迟）

## 问题反馈

如有问题或建议，请提交 Issue！
