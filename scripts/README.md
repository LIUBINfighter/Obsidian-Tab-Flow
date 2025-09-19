# 脚本工具说明

本目录包含用于代码合并和管理的工具脚本。

## 可用脚本

### 1. mix-code.js

**作用**: 通用代码合并工具，用于将整个项目的源代码文件合并到一个文件中。

**合并范围**:
- 所有 TypeScript 源文件 (.ts)
- README.md 文档
- styles.css 样式文件  
- GitHub Actions 工作流文件 (.yml)

**使用方法**:
```bash
npm run mix
# 或
node scripts/mix-code.js --dir ../src
```

**输出**: 在 `scripts/mix/` 目录下生成 `merged-{timestamp}.mix.txt` 文件

---

### 2. mix-code-tabview.js

**作用**: 专门用于合并 TabView 相关文件的工具，专注于状态持久化改造。

**合并范围**:
- [`src/components/TracksModal.ts`](../src/components/TracksModal.ts) - 音轨模态框组件
- [`src/views/TabView.ts`](../src/views/TabView.ts) - 主视图组件
- [`src/services/ScorePersistenceService.ts`](../src/services/ScorePersistenceService.ts) - 乐谱持久化服务
- [`src/utils/EventBus.ts`](../src/utils/EventBus.ts) - 事件总线
- [`src/events/trackEvents.ts`](../src/events/trackEvents.ts) - 音轨相关事件
- 相关的类型定义和工具文件

**使用方法**:
```bash
npm run mix-tabview
# 或
node scripts/mix-code-tabview.js --dir ../src
```

**输出**: 在 `scripts/mix/` 目录下生成 `tabview-merged-{timestamp}.mix.txt` 文件

---

### 3. merge-styles.js

**作用**: 合并样式文件，将多个 CSS 文件合并为单个 styles.css

**使用方法**:
```bash
npm run dev  # 自动执行
# 或手动执行
node scripts/merge-styles.js --dir src/styles
```

---

### 4. clean.js

**作用**: 清理构建产物和临时文件

**使用方法**:
```bash
npm run clean
# 清理构建产物并删除 styles.css 等文件
npm run clean-build
```

---

## 目录结构

```
scripts/
├── README.md          # 本说明文件
├── clean.js          # 清理脚本
├── merge-styles.js   # 样式合并脚本
├── mix-code.js       # 通用代码合并脚本
├── mix-code-tabview.js # TabView专用合并脚本
└── mix/              # 合并输出目录
    ├── *.mix.txt     # 合并后的文件
```

## 使用场景

1. **代码审查**: 将相关代码合并到一个文件中便于审查
2. **架构分析**: 分析特定功能模块的代码结构
3. **文档生成**: 为特定功能生成完整的代码文档
4. **备份**: 创建特定时间点的代码快照

## 注意事项

- 合并文件仅用于审查和分析，不应直接用于构建
- 每次运行都会生成带时间戳的新文件，旧文件需要手动清理
- 使用 `--dir` 参数可以指定要合并的源代码目录

## 相关 npm 命令

在 [`package.json`](../package.json) 中定义的命令:

```json
{
  "scripts": {
    "mix": "node ./scripts/mix-code.js --dir ../src",
    "mix-tabview": "node ./scripts/mix-code-tabview.js --dir ../src",
    "clean": "node ./scripts/clean.js",
    "clean-build": "node ./scripts/clean.js --delete styles.css data.json main.js"
  }
}
