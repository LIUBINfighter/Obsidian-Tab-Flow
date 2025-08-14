// 示例面板：ReadMe
export default {
	id: 'readme',
	title: 'ReadMe',
	render(container: HTMLElement, _plugin?: unknown) {
		container.empty();
			container.createEl('h3', { text: 'ReadMe 面板' });

			const paragraphs: string[] = [
				'欢迎使用 TabFlow！这里是你在 Obsidian 中 “写谱 + 听谱 + 管理创作灵感” 的交互式工作区。',
				'TabFlow 基于 AlphaTab 引擎，支持 .alphatab / .gp / .gp3 / .gp4 / .gp5 / .gpx 等格式播放与渲染；同时引入轻量且极具表达力的 AlphaTex 语法——用纯文本即可描述音轨、节拍、指法与效果，像写 Markdown 一样写乐谱。',
				'你可以：快速预览与播放；用 AlphaTex 起草段落再导出为传统谱面；结合 Obsidian 双链与知识库沉淀创作过程。',
				'未来计划：自动滚动、语法高亮、速度 / 布局 / 样式定制、PDF / PNG 导出、模板与自动补全、可视化编辑器、多模态 OCR 等。',
				'现在，就从一段简单的 AlphaTex 开始——让灵感不再被复杂工具打断。若你有想法或改进，欢迎提交 Issue / PR，一起把这里打造为吉他手与编曲者的创作乐园。祝创作愉快！'
			];

			paragraphs.forEach(p => container.createEl('p', { text: p }));
	}
};

