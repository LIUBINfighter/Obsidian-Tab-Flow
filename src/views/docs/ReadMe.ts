// 示例面板：ReadMe
export default {
	id: 'readme',
	title: 'ReadMe',
	render(container: HTMLElement, _plugin?: unknown) {
		container.empty();
		const h = container.createEl('h3', { text: 'ReadMe 面板（占位）' });
		container.createEl('p', { text: '这是一个示例页面，由独立模块 ReadMe.ts 提供渲染。' });
	}
};

