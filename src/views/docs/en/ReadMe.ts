// 示例面板：ReadMe
export default {
	id: 'readme',
	title: 'ReadMe',
	render(container: HTMLElement, _plugin?: unknown) {
		container.empty();
		container.createEl('h3', { text: 'ReadMe Panel' });

		const paragraphs: string[] = [
			'Welcome to TabFlow! This is your interactive workspace in Obsidian for "writing tabs + listening + managing creative inspiration".',
			'TabFlow is based on the AlphaTab engine, supporting playback and rendering of formats like .atex / .gp / .gp3 / .gp4 / .gp5 / .gpx; it also introduces the lightweight and expressive AlphaTex syntax—describe tracks, beats, fingering, and effects in plain text, just like writing Markdown.',
			"You can: quickly preview and play; draft sections with AlphaTex and export to traditional notation; integrate with Obsidian's bi-directional links and knowledge base to document your creative process.",
			'Future plans: auto-scroll, syntax highlighting, speed/layout/style customization, PDF/PNG export, templates and auto-completion, visual editor, multimodal OCR, etc.',
			"Now, start with a simple AlphaTex snippet—let inspiration flow without being interrupted by complex tools. If you have ideas or improvements, feel free to submit Issues/PRs, let's make this a creative paradise for musicians and composers together. Happy creating!",
		];

		paragraphs.forEach((p) => container.createEl('p', { text: p }));
	},
};
