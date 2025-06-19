// ITabUIManager.ts
import { PlayPauseButton } from "./components/controls/playPauseButton";
import { TimePositionDisplay } from "./components/controls/TimePositionDisplay";
import { StopButton } from "./components/controls/StopButton";
import { SelectControl } from "./components/controls/SelectControl";
import { ToggleButton } from "./components/controls/ToggleButton";

// 负责 AlphaTab 相关 UI 元素的创建与管理

export interface ITabUIManagerOptions {
	container: HTMLElement;
}

interface IControls {
	playPauseButton?: PlayPauseButton;
	stopButton?: StopButton;
	timePositionDisplay?: TimePositionDisplay;
	layoutControl?: SelectControl;
	zoomControl?: SelectControl;
	speedControl?: SelectControl;
	metronomeButton?: ToggleButton;
	countInButton?: ToggleButton;
	scrollFollowButton?: ToggleButton;
}

export class ITabUIManager {
	private elements: Record<string, HTMLElement> = {};
	private controls: IControls = {};

	public atWrap!: HTMLElement;
	public atOverlayRef!: HTMLElement;
	public atOverlayContentRef!: HTMLElement;
	public atMainRef!: HTMLElement;
	public atViewportRef!: HTMLElement;
	public atControlsRef!: HTMLElement;
	container?: HTMLElement;

	constructor(options: ITabUIManagerOptions) {
		this.createUI(options.container);
	}

	createUI(container: HTMLElement) {
		this.container = container;
		this.atWrap = this.createElement('atWrap', container, 'div', { cls: 'at-wrap' });
		this.atOverlayRef = this.createElement('atOverlayRef', this.atWrap, 'div', { cls: 'at-overlay', attr: { style: 'display: none;' } });
		this.atOverlayContentRef = this.createElement('atOverlayContentRef', this.atOverlayRef, 'div', { cls: 'at-overlay-content' });
		const atContent = this.createElement('atContent', this.atWrap, 'div', { cls: 'at-content' });
		this.atViewportRef = this.createElement('atViewportRef', atContent, 'div', { cls: 'at-viewport' });
		this.atMainRef = this.createElement('atMainRef', this.atViewportRef, 'div', { cls: 'at-main' });
		this.atControlsRef = this.createElement('atControlsRef', this.atWrap, 'div', { cls: 'at-controls' });
	}

	private createElement(key: string, parent: HTMLElement, tag: keyof HTMLElementTagNameMap, options: { cls?: string, attr?: Record<string, string> } = {}): HTMLElement {
		const el = parent.createEl(tag, options);
		this.elements[key] = el;
		return el;
	}

	getElement(key: string): HTMLElement | undefined {
		return this.elements[key];
	}

	removeElement(key: string) {
		const el = this.elements[key];
		if (el && el.parentElement) {
			el.parentElement.removeChild(el);
			delete this.elements[key];
		}
	}

	renderControlBar(onPlayPause: () => void, onStop: () => void) {
		this.atControlsRef.empty();
		// 时间显示元素
		const timePositionDiv = this.createElement('timePositionDiv', this.atControlsRef, 'div', { cls: 'time-position' });
		this.controls.timePositionDisplay = new TimePositionDisplay(timePositionDiv, {
			initialText: '00:00 / 00:00',
			className: 'time-position-display'
		});
		// 播放控制按钮
		this.controls.playPauseButton = new PlayPauseButton(this.atControlsRef, {
			onClick: onPlayPause,
			initialText: '播放',
			className: 'play-pause'
		});
		this.controls.stopButton = new StopButton(this.atControlsRef, {
			onClick: onStop,
			initialText: '停止',
			className: 'stop'
		});
		this.controls.stopButton.setEnabled(false);
		// 布局控制下拉框
		const layoutDiv = this.createElement('layoutDiv', this.atControlsRef, 'div', { cls: 'layout-control' });
		this.controls.layoutControl = new SelectControl({
			label: '布局：',
			options: [
				{ value: '页面', text: '页面' },
				{ value: '水平', text: '水平' },
				{ value: '垂直', text: '垂直' }
			]
		});
		layoutDiv.appendChild(this.controls.layoutControl.render());
		// 缩放控制下拉框
		const zoomDiv = this.createElement('zoomDiv', this.atControlsRef, 'div', { cls: 'zoom-control' });
		this.controls.zoomControl = new SelectControl({
			label: '缩放：',
			options: [
				{ value: '0.5x', text: '0.5x' },
				{ value: '0.75x', text: '0.75x' },
				{ value: '1x', text: '1x' },
				{ value: '1.25x', text: '1.25x' },
				{ value: '1.5x', text: '1.5x' },
				{ value: '2x', text: '2x' }
			],
			defaultValue: '1x'
		});
		zoomDiv.appendChild(this.controls.zoomControl.render());
		// 速度控制下拉框
		const speedDiv = this.createElement('speedDiv', this.atControlsRef, 'div', { cls: 'speed-control' });
		this.controls.speedControl = new SelectControl({
			label: '速度：',
			options: [
				{ value: '0.25', text: '0.25x' },
				{ value: '0.5', text: '0.5x' },
				{ value: '0.75', text: '0.75x' },
				{ value: '1', text: '1x' },
				{ value: '1.25', text: '1.25x' },
				{ value: '1.5', text: '1.5x' },
				{ value: '2', text: '2x' }
			],
			defaultValue: '1'
		});
		speedDiv.appendChild(this.controls.speedControl.render());
		// 节拍器按钮
		this.controls.metronomeButton = new ToggleButton({
			text: '节拍器',
			active: false
		});
		this.atControlsRef.appendChild(this.controls.metronomeButton.getElement());
		// 前置四拍按钮
		this.controls.countInButton = new ToggleButton({
			text: '前置四拍',
			active: false
		});
		this.atControlsRef.appendChild(this.controls.countInButton.getElement());
		// 光标跟随滚动按钮
		// this.controls.scrollFollowButton = new ToggleButton({
		// 	text: '跟随光标',
		// 	active: true // 默认启用
		// });
		// this.atControlsRef.appendChild(this.controls.scrollFollowButton.getElement());
	}

	// getter 统一访问控件实例
	get playPauseButton() { return this.controls.playPauseButton; }
	get stopButton() { return this.controls.stopButton; }
	get timePositionDisplay() { return this.controls.timePositionDisplay; }
	get layoutControl() { return this.controls.layoutControl; }
	get zoomControl() { return this.controls.zoomControl; }
	get speedControl() { return this.controls.speedControl; }
	get metronomeButton() { return this.controls.metronomeButton; }
	get countInButton() { return this.controls.countInButton; }
	get scrollFollowButton() { return this.controls.scrollFollowButton; }

	showLoadingOverlay(message: string) {
		this.atOverlayContentRef.setText(message);
		this.atOverlayRef.style.display = "flex";
		this.atOverlayRef.removeClass("error");
	}
	showErrorInOverlay(message: string, timeout = 5000): void {
		this.atOverlayContentRef.setText(message);
		this.atOverlayRef.style.display = "flex";
		this.atOverlayRef.addClass("error");
		if (timeout > 0) {
			setTimeout(() => {
				this.hideErrorOverlay();
			}, timeout);
		}
	}
	hideLoadingOverlay() {
		this.atOverlayRef.style.display = "none";
		this.atOverlayRef.removeClass("error");
	}
	setPlayPauseButtonText(text: string) {
		if (this.playPauseButton) this.playPauseButton.setText(text);
	}
	setStopButtonEnabled(enabled: boolean) {
		if (this.stopButton) this.stopButton.setEnabled(enabled);
	}
	
	// 新增的辅助方法
	updateTimePosition(currentTime: string, totalTime: string) {
		if (this.timePositionDisplay) {
			this.timePositionDisplay.setText(`${currentTime} / ${totalTime}`);
		}
	}
	
	setMetronomeActive(active: boolean) {
		if (this.metronomeButton) {
			this.metronomeButton.setActive(active);
		}
	}
	
	setCountInActive(active: boolean) {
		if (this.countInButton) {
			this.countInButton.setActive(active);
		}
	}
	
	isScrollFollowEnabled(): boolean {
		return this.scrollFollowButton ? this.scrollFollowButton.isActive() : true;
	}
	
	setScrollFollowEnabled(enabled: boolean) {
		if (this.scrollFollowButton) {
			this.scrollFollowButton.setActive(enabled);
		}
	}

	/**
	 * 隐藏错误覆盖层
	 */
	hideErrorOverlay(): void {
		this.atOverlayRef.style.display = "none";
		this.atOverlayRef.removeClass("error");
		this.atOverlayContentRef.empty();
	}
}
