[![DOI](https://zenodo.org/badge/993982366.svg)](https://doi.org/10.5281/zenodo.18446852)
[![CI](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/actions/workflows/ci.yml/badge.svg)](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/actions/workflows/ci.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/LIUBINfighter/Obsidian-Tab-Flow)](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/releases/latest)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/LIUBINfighter/obsidian-tab-flow)

# Obsidian 交互式吉他谱插件 Tab Flow

在 Obsidian 中演奏和创作你的吉他谱！基于 [alphaTab](https://alphatab.net)。

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/7334f1e9-cdc4-404e-81a7-89683ebfab7f" />

## 功能

- 渲染并播放 Guitar Pro 文件（`.gp`、`.gp3`、`.gp4`、`.gp5`、`.gpx`）。
    - 谱面渲染、播放/暂停/停止、播放光标、自动滚动、暗色模式。
    - 控件：音轨、布局、缩放、速度、预备拍、节拍器。
- 用 `alphaTex` 写作乐谱（`.atex` 文件，或笔记中的 `alphatex` 代码块）并分享。
    - 语法高亮（CodeMirror）、导出 Guitar Pro、PNG 分享卡片、导出 PDF（开发中）。
- 内置可交互文档，边玩边学 alphaTex。

### 自定义播放体验

![visual-editor-playbar](https://github.com/user-attachments/assets/4fce8ba1-31fa-4ca5-ab78-d721374ce975)

### 像写 Markdown 一样写吉他谱

`.atex` 文件：

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/e3a86a1a-3a85-469f-aa07-bda97faaf891" />

笔记中的 `alphatex` 代码块：

![alphatex-copy-and-paste-writing](https://github.com/user-attachments/assets/ef402b18-9c3f-4e10-8772-a3fd8e50c507)

### 分享你的 riff（Beta）

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/2f784059-4fef-4345-a6e4-d543ea7b2169" />

### 在内置 Playground 里学习 alphaTex

<img width="2560" height="1504" alt="image" src="https://github.com/user-attachments/assets/df7ba557-2c15-4db8-bfdf-d011e5362a16" />

通过命令面板或左侧 `guitar` 图标打开文档视图：

![alphatex-and-doc](https://github.com/user-attachments/assets/92821b4a-739c-458b-a1f3-1df0d64421ef)

## 系统要求

- Obsidian 1.8.0 及以上。
- 仅桌面端。插件包含 Web Worker，并使用 Node API 加载本地资源。

## 安装

### 1. Obsidian 社区插件市场

Tab Flow 上架社区目录后：**设置 → 第三方插件 → 浏览**，搜索 `Tab Flow` 安装并启用。

### 2. BRAT（审核期间推荐）

1. 安装并启用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件。
2. 在 BRAT 中选择 **Add beta plugin**，填入：
    ```
    https://github.com/LIUBINfighter/Obsidian-Tab-Flow
    ```
3. 选择版本并添加插件。
4. 继续执行下面的「首次运行」。

### 3. 手动安装

1. 从 [最新 Release](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/releases/latest) 下载 `tab-flow.zip`（或 `main.js`、`manifest.json`、`styles.css`）。
2. 解压到 `<你的库>/.obsidian/plugins/tab-flow/`。
3. 重启 Obsidian，在 **设置 → 第三方插件** 中启用 **Tab Flow**。

## 首次运行：下载播放资源

出于安全考虑，社区插件不能自动下载文件。Tab Flow 不内置乐谱字体、音色库与 Worker，请在 **设置 → Tab Flow → 资产管理** 中下载：

1. 打开 **设置 → Tab Flow**。
2. 在 **资产管理** 页点击 **下载缺失的资源文件**，等待完成。
3. 重载插件（或重启 Obsidian）。

资源从插件的 GitHub Release 下载，保存在插件目录内，仅本地使用。详见下方「安全与资源」。

## 使用

- **播放 Guitar Pro 文件**：直接打开 `.gp` / `.gp3` / `.gp4` / `.gp5` / `.gpx` 文件，Tab Flow 会渲染谱面并打开播放器视图。
- **写作乐谱**：新建 `.atex` 文件，或在任意笔记中添加 `alphatex` 代码块：
    ````
    ```alphatex
    \title "My riff"
    .
    :4 0.6 2.5 2.4 2.3 | 3.2 2.2 0.1 3.1
    ```
    ````
- **学习 alphaTex**：点击左侧 `guitar` 图标（或命令面板）打开文档视图，在内置 Playground 中直接修改示例。
- **编辑器**：从命令面板打开 alphaTex 编辑器，左侧写作、右侧预览。
- **打印 / PDF**：在播放器工具栏打开打印预览，使用系统打印对话框导出。

## 路线图

- 0.5.x：播放器与编辑器打磨（React + Zustand），适配 alphaTab 1.8。
- 1.0.0：多模态 OCR 识别 alphaTex，更完整的谱面工具链。

更多实验见 [alphatab-vue](https://github.com/LIUBINfighter/alphatab-vue)。

## 贡献

感谢使用 Tab Flow，欢迎贡献：

- 功能建议或 Bug：请提交 Issue。
- Pull Request：建议先开 Issue/Discussion 对齐方案再动手。

## 灵感来源

[alphaTab.js](https://alphatab.net)、孤独摇滚、Girls' Band Cry。

## 安全与资源

Tab Flow 只在你主动点击时，从插件的 GitHub Release 下载运行资源（乐谱字体、音色库、Web Worker），并保存在插件目录内。没有遥测、不执行远程代码、运行时不访问网络（仅加载这些本地文件）。

## 免责声明

请为你的 gp 文件做好备份。插件不会改写你的 `.gp` 文件；部分乐谱因中/日文等字符编码差异，渲染效果可能不佳。

## 版权与致谢

Copyright (c) 2025 Jay Bridge 及其他贡献者。保留所有权利。

遵循 MPL 2.0 协议授权。

## Special Thanks to

![alphaTab 徽标](assets/alphaTab.svg)
