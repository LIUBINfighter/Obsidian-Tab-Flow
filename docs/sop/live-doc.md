以下为后续编写“交互式文档”建议与操作要点（基于当前结构）：

一、基本文件组织
1. 每个文档页签：`src/views/docs/<Name>.ts`
2. 统一导出：`export default { id, title, render(container, plugin) }`
3. 在 `DocView` 中维护 tabs 注册（后续可抽离成一个注册表或自动扫描）

二、增加一个新页签步骤
1. 新建文件，例如 `src/views/docs/Shortcuts.ts`
2. 填写对象：
   id: 唯一短标识（用于 data-id）
   title: 左侧显示名称
   render: 只操作传入的 container（先 `container.empty()`）
3. 在 `DocView` 的 tabs 数组添加 { id, title }
4. 在切换逻辑中（需实现或扩展）根据 id 动态 import 该模块并调用其 render
5. 保持渲染纯函数化：不全局污染，不直接修改其他 tab 的 DOM

三、内容类型组件化
1. 代码/谱例交互：用 `createAlphaTexPlayground(plugin, container, source, options)`
   - options.debounceMs 控制渲染频率
   - options.readOnly=true 可做只读展示
2. 仅需可编辑 Markdown：用 `createEmbeddableMarkdownEditor(app, el, { value, placeholder, onChange })`
3. 纯说明文本：直接 `container.createEl('p', …)` 或未来可加简易 Markdown 渲染

四、交互模式建议
1. Tab 切换：给左侧 li 绑定 click，更新 active class + 右侧区域重渲染
2. 状态隔离：渲染前调用旧组件 handle.destroy()（若有）
3. 懒加载：首次点击再动态 `require()` 重型模块（alphaTab、playground等）
4. 错误兜底：try/catch 并显示“加载失败 + 重试按钮”

五、样式与布局
1. 使用现有类：
   - 外层：`tabflow-doc-layout` / `tabflow-doc-left` / `tabflow-doc-main`
   - 编辑器：`inmarkdown-editor-cm`
   - 预览容器：`inmarkdown-preview tabflow-doc-main-content`
2. 自定义附加样式，放 doc.css，前缀 `tabflow-` 或 `alphatex-` 避免冲突

六、性能与体验
1. Debounce：编辑频繁内容（Playground）≥300ms
2. 资源检测：缺字体/worker 优先提示下载而非反复尝试
3. 销毁：MutationObserver 或在 tab 切换时主动调用 destroy
4. 只在需要时导入：`require('../markdown/AlphaTexBlock')` 放在渲染函数内部

七、可扩展点（建议后续逐步实现）
- 动态注册：创建 `docs/index.ts` 导出列表或工厂
- 搜索 / 过滤：在左侧顶部加搜索框筛选标题
- 状态持久化：最近打开的 tab / 编辑中的谱文本保存到 plugin.settings
- 示例切换：Playground 支持多示例下拉
- 国际化：title 与文本走一个 i18n 映射表

八、测试要点
1. Tab 切换：激活 class 正确，旧内容销毁（可断言 DOM 清空）
2. Playground：
   - 初始渲染成功（存在谱容器）
   - 修改文本后延迟渲染（用 fake timers）
3. 资源缺失分支：模拟空 resources，出现下载按钮
4. 销毁：destroy 后不再触发渲染

九、最小模板示例（新页签）
(逻辑示例，加入后记得在 DocView 注册)
const panel = {
  id: 'shortcuts',
  title: '快捷键',
  render(container, plugin) {
    container.empty();
    container.createEl('h3', { text: '快捷键说明' });
    container.createEl('ul').createEl('li', { text: 'Space: 播放/暂停' });
  }
};
export default panel;

十、编写约定速记
- “只写本 tab 的 DOM，不跨区域”
- “需要复杂交互先封装组件”
- “避免立即加载大型依赖，延后至用户操作”
