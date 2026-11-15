// StaveProfileButton.ts
import * as alphaTab from '@coderline/alphatab';
import { t } from '../../i18n';

interface StaveProfileButtonOptions {
	onClick?: (profile: alphaTab.StaveProfile) => void;
	initialProfile?: alphaTab.StaveProfile;
	className?: string;
}

export class StaveProfileButton {
	private element: HTMLElement;
	private currentProfile: alphaTab.StaveProfile = alphaTab.StaveProfile.Default;
	private onClick?: (profile: alphaTab.StaveProfile) => void;

	// 定义五种模式的配置
	private readonly profiles = [
		{
			value: alphaTab.StaveProfile.Default,
			label: t('settings.staveProfileDefault'),
			icon: 'settings',
		},
		{
			value: alphaTab.StaveProfile.ScoreTab,
			label: t('settings.scoreTab'),
			icon: 'music',
		},
		{
			value: alphaTab.StaveProfile.Score,
			label: t('settings.scoreOnly'),
			icon: 'file-music',
		},
		{
			value: alphaTab.StaveProfile.Tab,
			label: t('settings.tabOnly'),
			icon: 'hash',
		},
		{
			value: alphaTab.StaveProfile.TabMixed,
			label: t('settings.tabMixed'),
			icon: 'layers',
		},
	];

	constructor(parent: HTMLElement, options: StaveProfileButtonOptions = {}) {
		this.onClick = options.onClick;
		this.currentProfile = options.initialProfile ?? alphaTab.StaveProfile.Default;

		this.element = parent.createEl('button', {
			cls: `stave-profile-button ${options.className || ''}`,
			attr: {
				type: 'button',
				title: this.getCurrentProfileLabel(),
			},
		});

		this.updateButtonDisplay();
		this.element.addEventListener('click', () => this.handleClick());
	}

	private getCurrentProfileLabel(): string {
		const profile = this.profiles.find((p) => p.value === this.currentProfile);
		return profile ? profile.label : t('settings.staveProfileLabel');
	}

	private getCurrentProfileIcon(): string {
		const profile = this.profiles.find((p) => p.value === this.currentProfile);
		return profile ? profile.icon : 'music';
	}

	private updateButtonDisplay(): void {
		this.element.empty();

		// 添加图标
		this.element.createSpan({
			cls: `lucide lucide-${this.getCurrentProfileIcon()}`,
		});

		// 添加文本标签
		this.element.createSpan({
			text: this.getCurrentProfileLabel(),
			cls: 'button-text',
		});

		// 更新 title 属性
		this.element.setAttribute('title', this.getCurrentProfileLabel());
	}

	private handleClick(): void {
		// 循环切换到下一个模式
		const currentIndex = this.profiles.findIndex((p) => p.value === this.currentProfile);
		const nextIndex = (currentIndex + 1) % this.profiles.length;
		this.currentProfile = this.profiles[nextIndex].value;

		this.updateButtonDisplay();

		if (this.onClick) {
			this.onClick(this.currentProfile);
		}
	}

	public setProfile(profile: alphaTab.StaveProfile): void {
		this.currentProfile = profile;
		this.updateButtonDisplay();
	}

	public getProfile(): alphaTab.StaveProfile {
		return this.currentProfile;
	}

	public getElement(): HTMLElement {
		return this.element;
	}

	public setEnabled(enabled: boolean): void {
		const buttonEl = this.element as HTMLButtonElement;
		buttonEl.disabled = !enabled;
		if (enabled) {
			this.element.removeClass('disabled');
		} else {
			this.element.addClass('disabled');
		}
	}
}
