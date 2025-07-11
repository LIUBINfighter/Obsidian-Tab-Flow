import { FileView, TFile, WorkspaceLeaf, Plugin, Notice } from "obsidian";

export const VIEW_TYPE_TAB = "tab-view";

import * as alphaTab from "@coderline/alphatab";
import * as convert from "color-convert";
import { EventBus } from "../utils/EventBus";
import { AlphaTabService } from "../services/AlphaTabService";

export type AlphaTabResources = {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
};

export class TabView extends FileView {
    private static instanceId = 0;
    private _styles: HTMLStyleElement;
    private _fontStyle: HTMLStyleElement | null = null; // 新增属性
    private currentFile: TFile | null = null;
    private fileModifyHandler: (file: TFile) => void;
    private eventBus: EventBus;
    private alphaTabService: AlphaTabService;
    // 为了兼容旧代码
    private _api!: alphaTab.AlphaTabApi;
    private plugin: Plugin;
    private resources: AlphaTabResources;

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
		plugin: Plugin,
		resources: AlphaTabResources,
		eventBus?: EventBus
	) {
		super(leaf);
		this.plugin = plugin;
		this.resources = resources;
		this.eventBus = eventBus ?? new EventBus();

		// 初始化文件修改监听处理器
		this.fileModifyHandler = (file: TFile) => {
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
		// --- 字体注入逻辑 ---
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

		// 1. 创建主内容容器和样式
		const element = this.contentEl.createDiv({ cls: cls });        // 2. 初始化 AlphaTabService
        this.alphaTabService = new AlphaTabService(
            element,
            this.resources,
            this.eventBus
        );
        
        // 为兼容性设置 _api 引用
        this._api = this.alphaTabService.getApi();

		// 3. 渲染 DebugBar
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { createDebugBar } = require("../components/DebugBar");
		const debugBar = createDebugBar({            api: this.alphaTabService.getApi(), // 仅用于兼容老接口
			isAudioLoaded: this.isAudioLoaded.bind(this),
			onTrackModal: () => {
				// 你可以在这里通过 eventBus 发送事件，或直接用 alphaTabService
				// ...原有逻辑...
			},
			eventBus: this.eventBus
		});
		this.contentEl.insertBefore(debugBar, this.contentEl.firstChild);

		// 4. 音频状态更新逻辑（可通过 eventBus 订阅“状态:音频就绪”等事件）
		// ...可补充...
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
			console.debug(`[TabView] Loading file: ${file.name}`);

			// 使用 AlphaTabService 加载文件
			const inputFile = await this.app.vault.readBinary(file);
			await this.alphaTabService.loadScore(new Uint8Array(inputFile));

			// 配置滚动元素 - 在乐谱加载后设置
			this.configureScrollElement();

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
		
		// 延迟确保设置生效后启用滚动
		setTimeout(() => {
			if (this._api.settings.player) {
				// 确保滚动模式是连续滚动
				this._api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
				// 确保启用光标
				this._api.settings.player.enableCursor = true;
				this._api.updateSettings();
				console.debug("[TabView] 滚动配置已更新");
			}
		}, 100);
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
