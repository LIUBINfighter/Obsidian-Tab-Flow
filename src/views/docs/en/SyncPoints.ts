// Documentation Panel: Sync Points (In Development)
export default {
	id: 'sync-points',
	title: 'Sync points (in development)',
	render(container: HTMLElement) {
		container.empty();
		container.createEl('h3', { text: 'Sync points (external media synchronization)' });
		container.createEl('p', {
			text: 'In development: Will provide examples based on \\sync BarIndex Occurence MillisecondOffset [Ratio] syntax, and demonstrate integration with external audio synchronization.',
		});
	},
};
