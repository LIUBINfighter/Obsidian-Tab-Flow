// Documentation Panel: Sync Points (In Development)
export default {
	id: 'sync-points',
	title: 'Sync Points (In Development)',
	render(container: HTMLElement) {
		container.empty();
		container.createEl('h3', { text: 'Sync Points (External Media Synchronization)' });
		container.createEl('p', {
			text: 'In development: Will provide examples based on \\sync BarIndex Occurence MillisecondOffset [Ratio] syntax, and demonstrate integration with external audio synchronization.',
		});
	},
};
