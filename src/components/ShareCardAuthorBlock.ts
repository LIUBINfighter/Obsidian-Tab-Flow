interface AuthorBlockInitial {
	t: (key: string) => string;
	showAuthor?: boolean;
	authorName?: string;
	authorRemark?: string;
	showAvatar?: boolean;
	authorAlign?: string;
	authorPosition?: string;
	authorBg?: string;
	authorTextColor?: string;
	authorFontSize?: number;
}

interface AuthorBlockCallbacks {
	onShowAuthor?: (value: boolean) => void;
	onAuthorName?: (value: string) => void;
	onAuthorRemark?: (value: string) => void;
	onShowAvatar?: (value: boolean) => void;
	onAvatarChange?: (data: string) => void;
	onAuthorAlign?: (value: string) => void;
	onAuthorPosition?: (value: string) => void;
	onAuthorBg?: (value: string) => void;
	onAuthorColor?: (value: string) => void;
	onAuthorFontSize?: (value: number) => void;
}

export function createAuthorBlock(
	parent: HTMLElement,
	initial: AuthorBlockInitial,
	callbacks: AuthorBlockCallbacks
) {
	const authorSection = parent.createDiv({ cls: 'share-card-form-grid' });
	authorSection.createEl('div', { text: initial.t('shareCard.showAuthor'), cls: 'sc-label' });
	const authorShowCb = authorSection.createEl('input', {
		attr: { type: 'checkbox' },
	});
	authorShowCb.checked = !!initial.showAuthor;

	authorSection.createEl('div', { text: initial.t('shareCard.authorName'), cls: 'sc-label' });
	const authorNameInput = authorSection.createEl('input');
	authorNameInput.type = 'text';
	authorNameInput.value = initial.authorName || '';

	authorSection.createEl('div', { text: initial.t('shareCard.authorRemark'), cls: 'sc-label' });
	const authorRemarkInput = authorSection.createEl('input');
	authorRemarkInput.type = 'text';
	authorRemarkInput.value = initial.authorRemark || '';

	authorSection.createEl('div', { text: initial.t('shareCard.showAvatar'), cls: 'sc-label' });
	const authorAvatarCb = authorSection.createEl('input', {
		attr: { type: 'checkbox' },
	});
	authorAvatarCb.checked = !!initial.showAvatar;

	authorSection.createEl('div', { text: initial.t('shareCard.avatarUpload'), cls: 'sc-label' });
	const avatarInput = authorSection.createEl('input');
	avatarInput.type = 'file';
	avatarInput.accept = 'image/*';

	authorSection.createEl('div', { text: initial.t('shareCard.authorAlign'), cls: 'sc-label' });
	const authorAlignSelect = authorSection.createEl('select');
	[
		[initial.t('shareCard.align.left'), 'left'],
		[initial.t('shareCard.align.center'), 'center'],
		[initial.t('shareCard.align.right'), 'right'],
	].forEach(([tt, v]) => {
		const opt = authorAlignSelect.createEl('option', { text: String(tt) });
		opt.value = String(v);
	});
	authorAlignSelect.value = initial.authorAlign || 'left';

	authorSection.createEl('div', { text: initial.t('shareCard.authorPosition'), cls: 'sc-label' });
	const authorPosSelect = authorSection.createEl('select');
	[
		[initial.t('shareCard.position.top'), 'top'],
		[initial.t('shareCard.position.bottom'), 'bottom'],
	].forEach(([tt, v]) => {
		const opt = authorPosSelect.createEl('option', { text: String(tt) });
		opt.value = String(v);
	});
	authorPosSelect.value = initial.authorPosition || 'bottom';

	authorSection.createEl('div', { text: initial.t('shareCard.authorBg'), cls: 'sc-label' });
	const authorBgInput = authorSection.createEl('input');
	authorBgInput.type = 'color';
	authorBgInput.value = initial.authorBg || '#ffffff';

	authorSection.createEl('div', {
		text: initial.t('shareCard.authorTextColor'),
		cls: 'sc-label',
	});
	const authorColorInput = authorSection.createEl('input');
	authorColorInput.type = 'color';
	authorColorInput.value = initial.authorTextColor || '#000000';

	authorSection.createEl('div', { text: initial.t('shareCard.authorFontSize'), cls: 'sc-label' });
	const authorFontInput = authorSection.createEl('input');
	authorFontInput.type = 'number';
	authorFontInput.value = String(initial.authorFontSize || 13);

	// events
	authorShowCb.addEventListener(
		'change',
		() => callbacks.onShowAuthor && callbacks.onShowAuthor(authorShowCb.checked)
	);
	authorNameInput.addEventListener(
		'input',
		() => callbacks.onAuthorName && callbacks.onAuthorName(authorNameInput.value)
	);
	authorRemarkInput.addEventListener(
		'input',
		() => callbacks.onAuthorRemark && callbacks.onAuthorRemark(authorRemarkInput.value)
	);
	authorAvatarCb.addEventListener(
		'change',
		() => callbacks.onShowAvatar && callbacks.onShowAvatar(authorAvatarCb.checked)
	);
	avatarInput.addEventListener(
		'change',
		() =>
			void (async () => {
				const f = avatarInput.files?.[0];
				if (!f) return;
				const arr = await f.arrayBuffer();
				const blob = new Blob([arr], { type: f.type });
				const reader = new FileReader();
				reader.onload = () => {
					if (!callbacks.onAvatarChange) return;
					const result = reader.result;
					if (typeof result === 'string') {
						callbacks.onAvatarChange(result);
					}
				};
				reader.readAsDataURL(blob);
			})()
	);
	authorAlignSelect.addEventListener(
		'change',
		() => callbacks.onAuthorAlign && callbacks.onAuthorAlign(authorAlignSelect.value)
	);
	authorPosSelect.addEventListener(
		'change',
		() => callbacks.onAuthorPosition && callbacks.onAuthorPosition(authorPosSelect.value)
	);
	authorBgInput.addEventListener(
		'change',
		() => callbacks.onAuthorBg && callbacks.onAuthorBg(authorBgInput.value)
	);
	authorColorInput.addEventListener(
		'change',
		() => callbacks.onAuthorColor && callbacks.onAuthorColor(authorColorInput.value)
	);
	authorFontInput.addEventListener(
		'change',
		() =>
			callbacks.onAuthorFontSize &&
			callbacks.onAuthorFontSize(Number(authorFontInput.value) || 13)
	);

	return {
		authorSection,
		authorShowCb,
		authorNameInput,
		authorRemarkInput,
		authorAvatarCb,
		avatarInput,
		authorAlignSelect,
		authorPosSelect,
		authorBgInput,
		authorColorInput,
		authorFontInput,
		setValues(values: Partial<AuthorBlockInitial>) {
			authorShowCb.checked = !!values.showAuthor;
			authorNameInput.value = values.authorName || '';
			authorRemarkInput.value = values.authorRemark || '';
			authorAvatarCb.checked = !!values.showAvatar;
			authorPosSelect.value = values.authorPosition || authorPosSelect.value;
			authorBgInput.value = values.authorBg || authorBgInput.value;
			authorColorInput.value = values.authorTextColor || authorColorInput.value;
			authorFontInput.value = String(values.authorFontSize || authorFontInput.value);
			authorAlignSelect.value = values.authorAlign || authorAlignSelect.value;
		},
	};
}

export default createAuthorBlock;
