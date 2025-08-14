# TabFlow 交互式文档编写 SOP

> 目标：保证所有文档页签结构统一、职责清晰、可维护、可渐进增强。

## 1. 总体架构

- 每个文档页签 = `src/views/docs/<Name>.ts` 默认导出对象：`{ id, title, render(container, plugin) }`
- 注册中心：`src/views/docs/index.ts` 维护 `panels` 数组供 `DocView` 使用。
- 视图容器：`DocView.ts` 负责：
	1. 注入样式
	2. 左侧导航渲染与激活态
	3. 根据 `activeId` 查找 panel 并调用其 `render`
	4. 不关心面板内部实现细节

## 2. 新增一个文档页签流程

1. 创建文件：`src/views/docs/<Name>.ts`
2. 模板：

	 ```ts
	 // <Name> 文档面板
	 import type MyPlugin from '../../main';
	 const panel = {
		 id: '<lower-id>',          // 唯一短标识，建议小写 + 中横线
		 title: '显示名称',          // 左侧导航显示文字
		 render(container: HTMLElement, plugin?: MyPlugin) {
			 container.empty();
			 container.createEl('h3', { text: '标题' });
			 container.createEl('p', { text: '正文或说明。' });
			 // 可按需使用 playground / editor 等组件
		 }
	 };
	 export default panel;
	 ```

3. 在 `src/views/docs/index.ts` 中引入并加入 `panels` 数组。
4. Reload / 重新打开文档视图验证。

## 3. 内容类型与组件选用

| 需求 | 推荐方式 |
| ---- | -------- |
| 纯说明 / 列表 | 直接 DOM API: `container.createEl(...)` |
| 可编辑谱例 + 实时渲染 | `createAlphaTexPlayground(plugin, container, source, options)` |
| 仅需可编辑文本 | `createEmbeddableMarkdownEditor(app, container, { value })` |
| 多示例切换 | 在 panel 内部增加本地 state（按钮 / 下拉）切换 source，再调用 handle.refresh() |

### AlphaTexPlayground 常用选项

```ts
createAlphaTexPlayground(plugin, container, SOURCE, {
	placeholder: '输入 AlphaTex 内容...',
	debounceMs: 400,
	readOnly: false,
	alphaTabOptions: { scale: 1 },
	onChange: (value) => {/* 可做 autosave */}
});
```

## 4. 命名与约定

- `id` 采用短横线小写：如 `readme`, `in-markdown`, `shortcuts`
- 不在 `render` 外层产生副作用（不添加全局事件 / 不修改其它 tab 的 DOM）
- 每次 `render` 必须先 `container.empty()`
- 引入的重资源模块 (如 alphaTab) 使用局部动态 `require`（已封装在 playground 内）

## 5. 资源与错误处理

- 如果依赖 alphaTab 资源缺失：调用 `plugin.downloadAssets()` 或使用 playground 默认按钮
- 发生异常：`try/catch` 后显示用户可理解的提示（不要静默失败）

## 6. 性能指引

- 编辑频繁内容使用 **debounce >=300ms**
- 避免在文档打开时立刻加载所有重资源（只在相关 tab 渲染时加载）
- 切换 tab 时应销毁旧实例：Playground 已内置销毁；自定义组件需自己实现 `destroy()` 并在下一次 render 前调用

## 7. 面板生命周期建议

| 阶段 | 行为 |
| ---- | ---- |
| render 进入 | 绑定事件 / 创建编辑器 / 初始渲染 |
| render 再次调用（切换回来） | 重新构建（不依赖前一次 DOM） |
| 离开/销毁 | 由新面板渲染或视图关闭触发；组件内部 MutationObserver 已辅助清理 |

## 8. 测试要点（建议）

- 导航点击后 active class 切换正确
- Playground 输入后延迟渲染（可用 fake timers）
- 资源缺失分支：模拟 `plugin.resources = {}` 出现下载提示
- 销毁：切换 tab 后旧 DOM 中不再触发渲染（可观察控制台无额外日志）

## 9. 常见问题排查

| 问题 | 可能原因 | 处理 |
| ---- | -------- | ---- |
| Tab 点击无反应 | 未更新 `activeId` 或 render 抛错 | 打开控制台，给 render 外层再加 try/catch |
| 曲谱不显示 | 资源未下载 | 点击“下载资源”按钮或调用 plugin.downloadAssets |
| 编辑器无样式 | 样式注入失败 | 检查 `injectStyles()` 与路径 `/src/styles/doc.css` |
| 切换后内存泄漏 | 未销毁自建实例 | 在面板内部监听 DOM 移除或提供 destroy 手动调用 |

## 10. Roadmap（可选增强）

- 自动扫描 `src/views/docs` 生成列表（使用 `import.meta.glob` 或构建脚本）
- 搜索过滤 / 文档目录（左侧顶部加输入框）
- 最近访问列表（持久化到 plugin settings）
- i18n（title 与正文分离）
- 快捷操作 Toolbar（复制示例 / 重置 / 导出）

## 11. 最小面板示例（复制即用）

```ts
// src/views/docs/Shortcuts.ts
import type MyPlugin from '../../main';
export default {
	id: 'shortcuts',
	title: '快捷键',
	render(container: HTMLElement, _plugin?: MyPlugin) {
		container.empty();
		container.createEl('h3', { text: '快捷键' });
		const ul = container.createEl('ul');
		['Space 播放/暂停', 'M 切换节拍器'].forEach(t => ul.createEl('li', { text: t }));
	}
};
```

## 12. 提交流程建议

1. 新增 / 修改面板代码
2. 本地构建：`npm run build`
3. 手动验证交互
4. 更新 `live-doc.md`（若有结构或约定变化）
5. 提交 PR，描述变更点 & 截图

---

如需新增共用组件（例如更多预览类型），放入 `src/components/` 并在此 SOP 中补充使用说明。
