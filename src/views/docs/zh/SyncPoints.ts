// 文档面板：Sync Points（开发中）
export default {
	id: 'sync-points',
	title: 'Sync points（开发中）',
	render(container: HTMLElement) {
		container.empty();
		container.createEl('h3', { text: 'Sync points（外部媒体同步点）' });
		container.createEl('p', {
			text: '开发中：将提供基于 \n\\sync BarIndex Occurence MillisecondOffset [Ratio] 的示例，并与外部音频同步演示对接。',
		});
	},
};
