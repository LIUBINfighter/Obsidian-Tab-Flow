---
title: "Obsidian 社区目录提交方案（community.obsidian.md）"
date: 2026-09-17
tags:
  - release
  - community-directory
  - submission
  - checklist
---

## 背景：提交流程已变更

旧的 `obsidianmd/obsidian-releases` PR 流程已停用（该仓库不再接受 PR，历史 PR 已删除，机器人评论只存档于 issue #209）。
现在通过 **Obsidian Community 目录** 提交：

1. 登录 [community.obsidian.md](https://community.obsidian.md)（Obsidian 账号）
2. **Connect GitHub**（只读授权，用于验证仓库归属）
3. 侧栏 **Plugins → New plugin**，填仓库 URL + Owner，同意 Developer policies，Submit
4. 目录会自动审核，结果直接显示在目录页；改完**递增版本并重新发 release** 即可

关键机制：

- 目录读取 **默认分支 HEAD 的 `manifest.json`**
- 安装时按 manifest 的 `version` 去匹配 **GitHub release 的 tag**，并下载 `main.js` / `manifest.json` / `styles.css`
- 因此：**manifest 版本 = release tag = 已发布的 release**，三者必须一致

## 当前差距（vibe 分支状态）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| README.md / LICENSE / manifest.json | ✅ | 已具备；README 已重写为「用途 + 安装 + 首次运行 + 使用」 |
| `fundingUrl` | ✅ | 不收款 → 已从 manifest 移除 |
| 描述 | ✅ | 120 字符、以句号结尾、无 emoji：`Render, play and write guitar tabs. Supports Guitar Pro files (.gp, .gp3, .gp4, .gp5, .gpx) and alphaTex scores (.atex).` |
| `isDesktopOnly` | ✅ | `true`（使用 Node `path` 与 Web Worker） |
| 命令 ID 不含插件 ID / 无 sample 代码 | ✅ | eslint-plugin-obsidianmd recommended 全绿（0 errors） |
| 控制台日志 | ✅ | 调试日志改为 `debugLog()`，默认静默，命令 `Debug: toggle debug logging` 开启 |
| 设置页文案 | ✅ | `Player settings` → `Player`、`Editor settings` → `Editor`（en/zh） |
| **版本 / release 对齐** | ⚠️ 待发布 | manifest/package = **0.5.2**，最新 release = **0.5.1** |
| **默认分支** | ⚠️ 待决策 | 当前默认分支是 `dev`（旧线）；整合成果在 `vibe` |

## 待办 1：发布 0.5.2（对齐 manifest）

vibe 上 manifest/package/versions.json 均为 0.5.2，release workflow 已就绪（tag 触发 → 构建 → 创建 **draft** release 并附带 `main.js`、`manifest.json`、`styles.css`）。

发布步骤：

```bash
git switch vibe && git pull
git tag 0.5.2
git push origin 0.5.2
# 等待 Release workflow 完成（会创建 draft release）
gh release list                     # 找到 0.5.2 的 draft
gh release edit 0.5.2 --draft=false # 发布它（社区目录只认已发布 release）
```

> 注意：workflow 创建的是 draft；**必须手动 publish**，否则目录/用户端拿不到。

## 待办 2：默认分支决策

目录读取默认分支 HEAD 的 manifest。二选一：

- **方案 A（推荐）**：把 `vibe` 设为默认分支（`gh repo edit --default-branch vibe`），后续开发/发版都在 vibe 上；`dev`/`master` 保留为历史线。
- **方案 B**：在提交前把 `vibe` 合并回 `dev`（`git switch dev && git merge --ff-only vibe`），继续用 `dev` 作为默认分支。

无论哪种，**默认分支上的 manifest 版本必须有对应的已发布 release**。

## 待办 3：提交前自检

```bash
npm ci && npm run lint && npm run build   # 0 errors
git status                                 # 干净
node -e "const m=require('./manifest.json');console.log(m.id,m.version,m.minAppVersion)"
# 确认 release 资产：main.js / manifest.json / styles.css
gh release view 0.5.2 --json assets --jq '[.assets[].name]'
```

提交表单需要：

- GitHub 仓库 URL：`https://github.com/LIUBINfighter/Obsidian-Tab-Flow`
- Owner：个人或组织
- 勾选同意 Developer policies

## 规范要点（供后续迭代对照）

**硬性（Submission requirements）**：`fundingUrl` 仅用于赞助；`minAppVersion` 真实；描述 ≤250 字符、句号结尾、无 emoji、专有名词大小写正确；Node/Electron API 必须 `isDesktopOnly`；命令 ID 不重复插件 ID；删除 sample 代码。

**政策（Developer policies）**：不混淆代码、不注入联网广告、无客户端遥测、不自我更新/更新依赖；联网、付费/账号、访问 vault 外文件、闭源等必须在 README 披露。

**审查建议（Plugin guidelines）**：不用全局 `app`；控制台默认只输出错误；设置页不要顶层大标题、标题不含 "settings"；UI 文案 sentence case；用 `setHeading`；避免 `innerHTML`；`onunload` 不 detach leaves；不设默认快捷键；优先 Vault API；路径用 `normalizePath()`；避免 `workspace.activeLeaf`；CSS 不硬编码样式。

## 遗留（非阻塞）

1. `@typescript-eslint/no-deprecated` ×9：alphaTab `staveProfile` 已弃用，需迁移到 Staff notation-visibility API。
2. `settings-tab/prefer-setting-definitions`：实现声明式设置 API，设置项才能出现在 1.13+ 的设置搜索里。
3. 完整 `strict: true` 迁移（当前 `strictNullChecks` + `strictBindCallApply`）。
4. README 中「社区插件市场」条目在正式上架后再改为直接可安装的表述。

## 后续

- 审核结果与合规修法（attestation、CSS lint、React 18 降级、发布标准动作）见 [2026-09-20-directory-review-compliance.md](./2026-09-20-directory-review-compliance.md)
- 状态：**0.5.7 全量审核 `Completed`**（Errors 0，仅剩 3 条 Recommendation）
