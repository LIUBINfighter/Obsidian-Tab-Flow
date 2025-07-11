import { FileView, TFile, WorkspaceLeaf, Plugin, Notice } from "obsidian";

export const VIEW_TYPE_TAB = "tab-view";

import * as alphaTab from "@coderline/alphatab";
import * as convert from "color-convert";
import { registerApiEventHandlers } from "../events/apiEventHandlers";

export type AlphaTabResources = {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
};

export class TabView extends FileView {
	private static instanceId = 0;
	private _api!: alphaTab.AlphaTabApi;
	private _styles: HTMLStyleElement;
	private _fontStyle: HTMLStyleElement | null = null; // 新增属性
	private currentFile: TFile | null = null;
	private fileModifyHandler: (file: TFile) => void;

	/**
	 * 检查音频是否已加载
	 */
	private isAudioLoaded(): boolean {
		try {
			// 基本检查：API 和 player 是否存在
			if (!this._api?.player) {
				console.debug("[TabView] Player not available");
				return false;
			}

			// 简化检查：如果 player 对象存在且有播放方法，就认为音频已准备好
			// @ts-ignore
			if (
				typeof this._api.player.play === "function" &&
				// @ts-ignore
				typeof this._api.player.pause === "function"
			) {
				console.debug("[TabView] Player methods available - audio ready");
				return true;
			}

			// 检查 player 状态
			// @ts-ignore
			const playerState = this._api.player.state;
			console.debug("[TabView] Player state:", playerState);

			if (typeof playerState === "number") {
				// PlayerState 枚举值：0 = Paused, 1 = Playing, 2 = Paused
				// 任何非负状态都表示播放器已初始化
				return playerState >= 0;
			}

			// 备用检查：如果有 readyForPlayback 属性
			// @ts-ignore
			if (this._api.player.readyForPlayback === true) {
				return true;
			}

			console.debug("[TabView] Audio not ready yet");
			return false;
		} catch (error) {
			console.error("[TabView] Error checking audio status:", error);
			return false;
		}
	}

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: Plugin,
		private resources: AlphaTabResources
	) {
		super(leaf);

		// 初始化文件修改监听处理器
		this.fileModifyHandler = (file: TFile) => {
			// 检查修改的文件是否是当前打开的文件
			if (
				this.currentFile &&
				file &&
				file.path === this.currentFile.path
			) {
				console.debug(
					`[TabView] 检测到文件变化: ${file.basename}，正在重新加载...`
				);
				this.reloadFile();
			}
		};
	}

	getViewType(): string {
		return VIEW_TYPE_TAB;
	}

	getDisplayText(): string {
		return "alphaTab";
	}

	onload(): void {
		// --- START: 新增字体注入逻辑 ---
		const fontFaceRule = `
			@font-face {
				font-family: 'alphaTab';
				src: url(${this.resources.bravuraUri});
			}
		`;
		this._fontStyle = this.containerEl.ownerDocument.createElement("style");
		this._fontStyle.id = `alphatab-font-style-${TabView.instanceId}`;
		this._fontStyle.innerHTML = fontFaceRule;
		this.containerEl.ownerDocument.head.appendChild(this._fontStyle);
		console.debug(`[TabView] Injected @font-face rule for alphaTab font.`);
		// --- END: 新增字体注入逻辑 ---

		const cls = `alphatab-${TabView.instanceId++}`;

		const styles = this.containerEl.createEl("style");
		styles.innerHTML = `
		.${cls} .at-cursor-bar {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			opacity: 0.2
		}

		.${cls} .at-selection div {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			opacity: 0.4
		}

		.${cls} .at-cursor-beat {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			width: 3px;
		}

		.${cls} .at-highlight * {
			fill: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			stroke: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
		}
		`;
		this._styles = styles;

		// 注册文件变更监听
		this.registerFileWatcher();


		// 1. 创建主内容容器和样式（只保留一次声明）
		const element = this.contentEl.createDiv({ cls: cls });
		const style = window.getComputedStyle(element);

		// 2. 初始化 AlphaTabApi（只保留一次声明）
		this._api = new alphaTab.AlphaTabApi(element, {
			core: {
				scriptFile: this.resources.alphaTabWorkerUri,
				smuflFontSources: new Map(),
				fontDirectory: "",
			},
			player: {
				enablePlayer: true,
				playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				enableCursor: true,
				enableAnimatedBeatCursor: true,
				soundFont: this.resources.soundFontUri,
				scrollMode: alphaTab.ScrollMode.Continuous, // 启用连续滚动
				scrollSpeed: 500, // 滚动动画时长（毫秒）
				scrollOffsetY: -25, // 顶部偏移，预留空间
				scrollOffsetX: 25, // 水平偏移
				nativeBrowserSmoothScroll: false, // 使用自定义平滑滚动
			},
			display: {
				resources: {
					mainGlyphColor: style.getPropertyValue("--color-base-100"),
					secondaryGlyphColor: style.getPropertyValue("--color-base-60"),
					staffLineColor: style.getPropertyValue("--color-base-40"),
					barSeparatorColor: style.getPropertyValue("--color-base-40"),
					barNumberColor:
						"#" +
						convert.hsl.hex([
							parseFloat(style.getPropertyValue("--accent-h")),
							parseFloat(style.getPropertyValue("--accent-s")),
							parseFloat(style.getPropertyValue("--accent-l")),
						]),
					scoreInfoColor: style.getPropertyValue("--color-base-100"),
				},
			},
		});

		// 配置 Obsidian 环境的滚动容器
		this.configureScrollElement();

		// 3. 渲染 DebugBar
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { createDebugBar } = require("../components/DebugBar");
		const debugBar = createDebugBar({
			api: this._api,
			isAudioLoaded: this.isAudioLoaded.bind(this),
			onTrackModal: () => {
				if (!this._api || !this._api.score || !Array.isArray(this._api.score.tracks)) {
					new Notice("乐谱未加载，无法选择音轨");
					return;
				}
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const { TracksModal } = require("../components/TracksModal");
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const { handleTrackEvent } = require("../events/trackEvents");
				const modal = new TracksModal(
					this.app,
					this._api.score.tracks,
					(selectedTracks) => {
						if (selectedTracks && selectedTracks.length > 0) {
							if (typeof this._api.renderTracks === 'function') {
								this._api.renderTracks(selectedTracks);
							} else {
								new Notice("当前 AlphaTab API 不支持音轨切换");
							}
							if (typeof this._api.render === 'function') {
								this._api.render();
							}
						}
					},
					(payload) => handleTrackEvent(this._api, payload)
				);
				modal.open();
			}
		});
		// 保证 debugBar 在最前面
		this.contentEl.insertBefore(debugBar, this.contentEl.firstChild);

		// 4. 音频状态更新逻辑
		const audioStatus = (debugBar as HTMLDivElement & { audioStatus: HTMLSpanElement }).audioStatus;
		const updateAudioStatus = () => {
			if (!this._api) {
				audioStatus.innerText = "音频：API未初始化";
				audioStatus.style.color = "red";
				return;
			}
			if (!this._api.player) {
				audioStatus.innerText = "音频：播放器未初始化";
				audioStatus.style.color = "red";
				return;
			}
			const audioReady = this.isAudioLoaded();
			if (audioReady) {
				audioStatus.innerText = "音频：已加载";
				audioStatus.style.color = "green";
			} else {
				audioStatus.innerText = "音频：加载中...";
				audioStatus.style.color = "orange";
			}
		};
		// 5. 监听音频相关事件
		// this._api.soundFontLoaded.on(updateAudioStatus);
		// this._api.playerReady.on(updateAudioStatus);
		// this._api.scoreLoaded.on(updateAudioStatus);

		// 添加错误处理
		this._api.error.on((error) => {
			console.error("[AlphaTab] Error occurred:", error);
		});

		// 添加渲染事件监听
		this._api.renderStarted.on((isResize) => {
			console.debug("[AlphaTab] Render started, isResize:", isResize);
		});

		this._api.renderFinished.on((result) => {
			console.debug("[AlphaTab] Render finished");
		});

		// --- START: 补充播放器事件监听 ---
		// 播放器就绪
		this._api.playerReady.on(() => {
			console.debug("[AlphaTab] Player ready");
			// 滚动到当前光标位置
			if (typeof this._api.scrollToCursor === 'function') {
				this._api.scrollToCursor();
			}
		});
		// 播放状态改变
		this._api.playerStateChanged.on((args) => {
			console.debug("[AlphaTab] Player state changed:", args.state);
			// 播放时自动滚动到当前位置
			if (args.state === alphaTab.synth.PlayerState.Playing) {
				if (typeof this._api.scrollToCursor === 'function') {
					this._api.scrollToCursor();
				}
			}
		});
		// 播放位置改变
		this._api.playerPositionChanged.on((args) => {
			// console.debug(`[AlphaTab] Position changed: ${args.currentTime} / ${args.endTime}`);
			// AlphaTab 会自动处理滚动，无需额外处理
		});
		// 播放结束
		this._api.playerFinished.on(() => {
			console.debug("[AlphaTab] Playback finished");
		});
		// MIDI 事件播放
		this._api.midiEventsPlayed.on((evt) => {
			evt.events.forEach((midi) => {
				// 简化 MIDI 事件处理，移除不存在的属性
				console.debug("[AlphaTab] MIDI event:", midi);
			});
		});
		// --- END: 补充播放器事件监听 ---
		// 使用统一的事件注册入口
		registerApiEventHandlers(this._api, audioStatus, this.isAudioLoaded.bind(this));

		// 初始化时也检查一次音频状态
		setTimeout(updateAudioStatus, 500);
	}

	onunload(): void {
		console.debug("[TabView] Starting cleanup process");

		// --- START: 新增字体样式清理逻辑 ---
		if (this._fontStyle) {
			this._fontStyle.remove();
			console.debug("[TabView] Removed injected @font-face style.");
		}
		// --- END: 新增字体样式清理逻辑 ---

		// 注销文件监听
		this.unregisterFileWatcher();

		// 销毁 AlphaTab API - 根据文档，这会清理所有内部资源
		if (this._api) {
			try {
				this._api.destroy();
				console.debug("[TabView] AlphaTab API destroyed successfully");
			} catch (error) {
				console.error(
					"[TabView] Error destroying AlphaTab API:",
					error
				);
			}
		}

		// 清理样式
		if (this._styles) {
			this._styles.remove();
		}

		// 清理引用
		this.currentFile = null;

		console.debug("[TabView] View unloaded and resources cleaned up");
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;

		try {
			// 确保 API 已初始化
			if (!this._api) {
				throw new Error("AlphaTab API not initialized");
			}

			console.debug(`[TabView] Loading file: ${file.name}`);

			// 读取并加载文件
			const inputFile = await this.app.vault.readBinary(file);
			this._api.load(new Uint8Array(inputFile));

			console.debug(`[TabView] File loaded successfully: ${file.name}`);
		} catch (error) {
			console.error("[TabView] Failed to load file:", error);
			new Notice(`加载乐谱文件失败: ${error.message || "未知错误"}`);
		}
	}

	/**
	 * 配置 Obsidian 环境的滚动容器
	 */
	private configureScrollElement(): void {
		// 查找合适的滚动容器
		const selectors = [
			'.workspace-leaf-content.mod-active',
			'.view-content',
			'.workspace-leaf-content'
		];

		let scrollElement: HTMLElement | null = null;
		for (const selector of selectors) {
			scrollElement = document.querySelector(selector) as HTMLElement;
			if (scrollElement) {
				break;
			}
		}

		if (scrollElement) {
			this._api.settings.player.scrollElement = scrollElement;
			console.debug("[TabView] 设置滚动容器:", scrollElement.className);
		} else {
			this._api.settings.player.scrollElement = "html,body";
			console.debug("[TabView] 使用默认滚动容器");
		}

		// 应用设置
		this._api.updateSettings();
	}

	// 注册文件变更监听
	private registerFileWatcher(): void {
		this.app.vault.on("modify", this.fileModifyHandler);
		console.debug("[TabView] 已注册文件监听");
	}

	// 注销文件变更监听
	private unregisterFileWatcher(): void {
		this.app.vault.off("modify", this.fileModifyHandler);
		console.debug("[TabView] 已注销文件监听");
	}

	// 重新加载当前文件内容
	private async reloadFile(): Promise<void> {
		if (!this.currentFile || !this._api) {
			return;
		}

		try {
			const inputFile = await this.app.vault.readBinary(this.currentFile);
			this._api.load(new Uint8Array(inputFile));
			console.debug(
				`[TabView] 已重新加载文件: ${this.currentFile.basename}`
			);
		} catch (error) {
			console.error("[TabView] 重新加载文件失败", error);
		}
	}

	// Override onUnloadFile to ensure proper cleanup when file is closed
	override async onUnloadFile(file: TFile): Promise<void> {
		console.debug(`[TabView] Unloading file: ${file.name}`);
		this.currentFile = null;
		await super.onUnloadFile(file);
	}

	/**
	 * 滚动到乐谱底部（特殊需求）
	 */
	public scrollToBottom(): void {
		if (!this._api || !this._api.score) {
			console.warn("[TabView] 乐谱未加载，无法滚动到底部");
			return;
		}

		try {
			const masterBars = this._api.score.masterBars;
			if (!masterBars || masterBars.length === 0) {
				return;
			}

			// 设置到最后一个小节
			const lastBar = masterBars[masterBars.length - 1];
			const endTick = lastBar.start + lastBar.calculateDuration();
			
			this._api.tickPosition = endTick;
			
			// 延迟滚动确保位置设置生效
			setTimeout(() => {
				if (this._api) {
					this._api.scrollToCursor();
				}
			}, 100);
		} catch (error) {
			console.warn("[TabView] 滚动到底部失败:", error);
		}
	}
}
