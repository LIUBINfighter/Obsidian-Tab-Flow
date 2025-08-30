# Obsidian 交互式吉他谱插件

在 Obsidian 中演奏和创作你的吉他谱！

## 功能特性

🎵 **交互式吉他谱播放器**
- 使用 [AlphaTab.js](https://alphatab.net) 引擎播放和创作吉他谱
- 支持多种格式：`.alphatab`、`.gp`、`.gp3`、`.gp4`、`.gp5`、`.gpx`
- 现代音乐字体和高品质声音合成

🎼 **Markdown 集成**
- 直接在 Markdown 中渲染 AlphaTex 代码块
- 实时预览和编辑
- 语法高亮和错误报告
- 与 Obsidian 工作流程无缝集成

🎛️ **高级播放控制**
- 播放/暂停、停止和轨道导航
- 可拖拽的交互式进度条
- 播放时自动滚动（可调速度）
- 节拍器和预备拍功能
- 速度调节和节拍控制
- 缩放和布局切换（分页/横向滚动）

🎯 **轨道管理**
- 多轨道支持，每轨独立控制
- 单独设置 Solo/静音
- 每轨音量控制
- 全局和单轨移调
- 轨道选择模态框

📤 **导出功能**
- 导出为音频文件（WAV 格式）
- 导出为 MIDI 文件
- 导出为 Guitar Pro 文件
- 打印为 PDF
- 自定义文件命名

🎨 **主题集成**
- 完整的深色/浅色模式支持
- 适配 Obsidian 的 CSS 变量
- 可自定义界面组件
- 响应式设计适配不同屏幕尺寸

⚙️ **可定制界面**
- 可配置播放栏组件
- 显示/隐藏各个控件
- 可重新排序的控件布局
- 开发者调试工具

🌐 **国际化**
- 多语言支持（中文/英文）
- 可扩展的翻译系统

## 安装方法

1. 从 Obsidian 社区插件安装（即将上线）
2. 或手动从 releases 下载并解压到 `.obsidian/plugins/tab-flow/`
3. 在 Obsidian 设置中启用插件
4. 根据提示下载所需资源（字体、音色包等）

## 使用方法

### 基础吉他谱播放
1. 打开任何支持的吉他谱文件（`.gp`、`.gp5` 等）
2. 交互式播放器将自动加载
3. 使用播放控件进行播放、暂停和导航

### Markdown 中的 AlphaTex
在你的 Markdown 文件中创建 AlphaTex 代码块：

```alphatex
\\title "我的歌曲"
\\tempo 120

1.2 3.1 | 4.2 2.3 | 
```

### 高级功能
- 通过播放栏中的设置按钮访问设置
- 使用轨道选择器管理多轨道文件
- 使用导出菜单导出你的吉他谱
- 在插件设置中自定义界面

## 路线图

### ✅ 已完成功能
- 核心吉他谱渲染和播放
- AlphaTex Markdown 集成
- 导出系统（音频、MIDI、GP、PDF）
- 主题适配和深色模式
- 多语言支持
- 可定制播放栏
- 自动滚动功能

### 🚧 开发中功能
- 高级 AlphaTex 编辑器与语法高亮
- 可视化所见即所得编辑器
- 模板系统和自动补全
- 增强的移动端支持

### 🔮 未来计划
- OCR 支持转换乐谱图片
- 社区功能和吉他谱分享
- 高级音频效果和处理
- 与外部音乐服务集成
- 插件 API 扩展支持

更多详细规划请见 [我的测试网站](https://liubinfighter.github.io/alphatab-vue/) 及 [开发仓库](https://github.com/LIUBINfighter/alphatab-vue)

## 贡献

感谢下载本插件，欢迎贡献你的力量！

### 报告问题
- 使用我们的 [Issue 模板](.github/ISSUE_TEMPLATE/) 报告 Bug 和功能请求
- 创建新 Issue 前请先检查现有问题
- 提供详细信息和重现步骤

### 贡献代码
- 使用我们的 [Pull Request 模板](.github/pull_request_template.md)
- 遵循现有的代码风格和约定
- 为新功能添加测试（如适用）
- 根据需要更新文档

### 开发环境设置
```bash
# 安装依赖
npm install

# 开发构建（自动重载）
npm run dev

# 生产构建
npm run build

# 运行测试
npm run test
```

<!-- 如果你想为 obsidian-tab-flow 添加新语言，请先阅读本指南。 -->

## 灵感来源

[AlphaTab.js](https://alphatab.net)

孤独摇滚！

Girls' Band Cry

## 免责声明

请为你的 gp 文件做好备份。部分乐谱因中/日文等字符编码方式不同，渲染效果可能不佳。

由于 Obsidian 社区插件政策，插件无法自动下载 `font`、`soundfont` 和 `worker.mjs`，但我们提供了按钮以便你完成设置。

<!-- 本插件与 AlphaTab.js 及 Obsidian 官方团队无官方关系。 -->

## 版权与致谢

Copyright (c) 2025 Jay Bridge 及其他贡献者。保留所有权利。

遵循 MPL 2.0 协议授权。

<!-- ## 使用的依赖包 -->

<!-- AlphaTab.js -->

<!-- ## 开发环境 -->

<!-- VSCode -->
