// Documentation Panel: Sync Points (In Development)
export default {
	id: 'sync-points',
	title: 'Sync points (in development)',
	render(container: HTMLElement) {
		container.empty();
		container.createEl('h3', { text: 'Sync points (external media synchronization)' });
		container.createEl('p', {
			text: 'In development: will provide examples based on \\sync barindex occurence millisecondoffset [ratio] syntax, and demonstrate integration with external audio synchronization.',
		});
	},
};
