import { setCssProps } from '../utils/styleUtils';

// Create the preview DOM structure used by ShareCardModal.
// We intentionally keep the API minimal and return the created elements so
// the caller (ShareCardModal) can attach event handlers and manage state.
export function createShareCardPreview(parent: HTMLElement, initialWidth: string) {
	const previewWrap = parent.createDiv({ cls: 'share-card-preview' });
	const panWrapper = previewWrap.createDiv({ cls: 'share-card-pan-wrapper' });
	const cardRoot = panWrapper.createDiv({ cls: 'share-card-root' });
	setCssProps(cardRoot, { '--share-card-width': `${initialWidth}px` });
	const playgroundContent = cardRoot.createDiv({ cls: 'share-card-content' });

	return {
		previewWrap,
		panWrapper,
		cardRoot,
		playgroundContent,
		destroy() {
			try {
				// attempt to remove nodes safely
				if (previewWrap && previewWrap.remove) previewWrap.remove();
			} catch {
				/* ignore */
			}
		},
	};
}

export default createShareCardPreview;
