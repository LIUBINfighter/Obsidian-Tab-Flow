// <-- ./src/services/AlphaTabService.ts -->

import * as alphaTab from "@coderline/alphatab";
import { App } from "obsidian";
import { EventBus } from "../utils/EventBus";
import { ScrollConfigProxy } from "../services/ScrollConfigProxy";
import * as convert from "color-convert";
import { convertSamplesToWavBlobUrl } from "../utils/audioUtils";

export class AlphaTabService {
	private api: alphaTab.AlphaTabApi;
	private scrollProxy: ScrollConfigProxy;
	private eventBus: EventBus;
	private app: App;
	private element: HTMLElement;
	private resources: {
		alphaTabWorkerUri: string;
		soundFontUri: string;
		bravuraUri: string;
	};

	constructor(
		app: App,
		element: HTMLElement,
		resources: {
			alphaTabWorkerUri: string;
			soundFontUri: string;
			bravuraUri: string;
		},
		eventBus: EventBus
	) {
		this.app = app;
		this.eventBus = eventBus;
		this.element = element;
		this.resources = resources;

		// 获取当前元素的计算样式用于暗色适配
		const style = window.getComputedStyle(element);

		this.api = new alphaTab.AlphaTabApi(element, {
			core: {
				scriptFile: resources.alphaTabWorkerUri,
				smuflFontSources: (resources.bravuraUri
					? new Map([
							[
								(alphaTab as any).rendering?.glyphs
									?.FontFileFormat?.Woff2 ?? 0,
								resources.bravuraUri,
							],
					  ])
					: new Map()) as unknown as Map<number, string>,
				fontDirectory: "",
			},
			player: {
				enablePlayer: true,
				playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				enableCursor: true,
				enableAnimatedBeatCursor: true,
				soundFont: resources.soundFontUri,
				scrollMode: alphaTab.ScrollMode.Continuous,
				scrollSpeed: 500,
				scrollOffsetY: -25,
				scrollOffsetX: 25,
				nativeBrowserSmoothScroll: false,
			},
			display: {
				resources: {
					mainGlyphColor: style.getPropertyValue("--color-base-100"),
					secondaryGlyphColor:
						style.getPropertyValue("--color-base-60"),
					staffLineColor: style.getPropertyValue("--color-base-40"),
					barSeparatorColor:
						style.getPropertyValue("--color-base-40"),
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
		this.scrollProxy = new ScrollConfigProxy(this.api);

		this.registerCommandHandlers();
		this.registerApiListeners();
		this.registerWorkspaceEvents();
	}

	private registerCommandHandlers() {
		// 选择音轨事件（弹出轨道选择 Modal） - 不再直接实例化 TracksModal，而是发出事件
		this.eventBus.subscribe("命令:选择音轨", () => {
			this.eventBus.publish("UI:showTracksModal");
		});
		this.eventBus.subscribe("命令:播放暂停", () => this.api.playPause());
		this.eventBus.subscribe("命令:停止", () => this.api.stop());
		this.eventBus.subscribe("命令:设置速度", (speed: number) => {
			this.api.playbackSpeed = speed;
		});
		this.eventBus.subscribe("命令:设置谱表", (profile: number) => {
			this.api.settings.display.staveProfile = profile;
			this.api.updateSettings();
			this.api.render();
		});
		this.eventBus.subscribe("命令:设置节拍器", (enabled: boolean) => {
			this.api.metronomeVolume = enabled ? 1 : 0;
		});
		this.eventBus.subscribe("命令:设置预备拍", (enabled: boolean) => {
			this.api.countInVolume = enabled ? 1 : 0;
		});
		this.eventBus.subscribe("命令:设置缩放", (scale: number) => {
			this.api.settings.display.scale = scale;
			this.api.updateSettings();
			this.api.render();
		});
		// 滚动相关
		this.eventBus.subscribe("命令:设置滚动模式", (mode: number) =>
			this.scrollProxy.setScrollMode(mode)
		);
		this.eventBus.subscribe("命令:设置滚动速度", (speed: number) =>
			this.scrollProxy.setScrollSpeed(speed)
		);
		this.eventBus.subscribe("命令:设置Y偏移", (offset: number) =>
			this.scrollProxy.setScrollOffsetY(offset)
		);
		this.eventBus.subscribe("命令:设置X偏移", (offset: number) =>
			this.scrollProxy.setScrollOffsetX(offset)
		);
		this.eventBus.subscribe("命令:设置原生滚动", (enabled: boolean) =>
			this.scrollProxy.setNativeBrowserSmoothScroll(enabled)
		);
		this.eventBus.subscribe("命令:滚动到光标", () =>
			this.scrollProxy.triggerScrollToCursor()
		);
		// 新增：布局切换事件
		this.eventBus.subscribe("命令:切换布局", (layoutMode: number) => {
			if (this.api.settings && this.api.settings.display) {
				this.api.settings.display.layoutMode = layoutMode;
				this.api.updateSettings();
				this.api.render();
			}
		});
		// 新增：刷新播放器（重新渲染当前乐谱）
		this.eventBus.subscribe("命令:刷新播放器", () => {
			try {
				if ((this.api as any)?.score) {
					// 方案A：仅强制渲染
					this.api.render();
				}
			} catch (e) {
				console.warn("[AlphaTabService] 刷新播放器失败:", e);
			}
		});
		// 音频导出事件
		this.eventBus.subscribe(
			"命令:导出音频",
			async (
				payload?: {
					fileName?: string;
				} & Partial<alphaTab.synth.AudioExportOptions>
			) => {
				try {
					const { fileName, ...options } = payload || {};
					const wavUrl = await this.exportAudioToWav(options);
					this.eventBus.publish("状态:音频导出完成", wavUrl);
				} catch (e) {
					this.eventBus.publish("状态:音频导出失败", e);
				}
			}
		);
		// 新增：导出 MIDI / PDF / GP 事件
		this.eventBus.subscribe(
			"命令:导出MIDI",
			(payload?: { fileName?: string }) => {
				try {
					// 动态注册并执行
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const {
						registerExportEventHandlers,
					} = require("../events/exportEvents");
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || "").trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || "Untitled";
						},
						app: this.app,
					});
					handlers.exportMidi();
				} catch (e) {
					console.warn("[AlphaTabService] 导出MIDI失败:", e);
				}
			}
		);
		this.eventBus.subscribe(
			"命令:导出PDF",
			(payload?: { fileName?: string }) => {
				try {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const {
						registerExportEventHandlers,
					} = require("../events/exportEvents");
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || "").trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || "Untitled";
						},
						app: this.app,
					});
					handlers.exportPdf();
				} catch (e) {
					console.warn("[AlphaTabService] 导出PDF失败:", e);
				}
			}
		);
		this.eventBus.subscribe(
			"命令:导出GP",
			(payload?: { fileName?: string }) => {
				try {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const {
						registerExportEventHandlers,
					} = require("../events/exportEvents");
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || "").trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || "Untitled";
						},
						app: this.app,
					});
					handlers.exportGp();
				} catch (e) {
					console.warn("[AlphaTabService] 导出GP失败:", e);
				}
			}
		);
		// 命令：加载乐谱（传入 Uint8Array 或 ArrayBuffer）
		this.eventBus.subscribe(
			"命令:加载乐谱",
			async (data: Uint8Array | ArrayBuffer) => {
				try {
					const bytes =
						data instanceof Uint8Array
							? data
							: new Uint8Array(data);
					await this.loadScore(bytes);
					this.eventBus.publish("状态:乐谱已加载");
				} catch (e) {
					this.eventBus.publish("状态:加载失败", e);
				}
			}
		);

		// 命令：加载 AlphaTex 乐谱（传入文本内容）
		this.eventBus.subscribe(
			"命令:加载AlphaTex乐谱",
			async (textContent: string) => {
				try {
					await this.loadAlphaTexScore(textContent);
					this.eventBus.publish("状态:乐谱已加载");
				} catch (e) {
					this.eventBus.publish("状态:加载失败", e);
				}
			}
		);
		// 命令：重新构造 AlphaTabApi
		this.eventBus.subscribe("命令:重建AlphaTabApi", () => {
			this.reconstructApi();
		});
		// 轨道事件处理 - 用于状态同步和日志记录
		this.eventBus.subscribe(
			"track:solo",
			(data: { track: Record<string, unknown>; value: boolean }) => {
				console.debug(
					`[AlphaTabService] 轨道 ${data.track.name} 独奏状态: ${data.value}`
				);
			}
		);
		this.eventBus.subscribe(
			"track:mute",
			(data: { track: Record<string, unknown>; value: boolean }) => {
				console.debug(
					`[AlphaTabService] 轨道 ${data.track.name} 静音状态: ${data.value}`
				);
			}
		);
		this.eventBus.subscribe(
			"track:volume",
			(data: { track: Record<string, unknown>; value: number }) => {
				console.debug(
					`[AlphaTabService] 轨道 ${data.track.name} 音量: ${data.value}`
				);
			}
		);
		this.eventBus.subscribe(
			"track:transpose",
			(data: { track: Record<string, unknown>; value: number }) => {
				console.debug(
					`[AlphaTabService] 轨道 ${data.track.name} 移调: ${data.value}`
				);
			}
		);
		this.eventBus.subscribe(
			"track:transposeAudio",
			(data: { track: Record<string, unknown>; value: number }) => {
				console.debug(
					`[AlphaTabService] 轨道 ${data.track.name} 音频移调: ${data.value}`
				);
			}
		);
	}

	private registerApiListeners() {
		this.api.playerReady.on(() => this.eventBus.publish("状态:音频就绪"));
		this.api.error.on((err) => this.eventBus.publish("状态:错误", err));

		// 添加播放位置变化事件监听，用于进度条更新
		this.api.playerPositionChanged.on((args) => {
			this.eventBus.publish("状态:播放位置变化", {
				currentTime: args.currentTime || 0,
				endTime: args.endTime || 0,
			});
		});

		// 可继续补充其它 alphaTab 事件的监听和广播
	}

	private registerWorkspaceEvents() {
		// 监听手动刷新事件 - 使用事件总线而不是 workspace
		this.eventBus.subscribe("命令:手动刷新", () => {
			try {
				console.debug("[AlphaTabService] 收到手动刷新事件");
				// 强制重新渲染
				if (this.api && (this.api as any).score) {
					this.api.render();
				}
				// 重新配置滚动元素
				this.configureScrollElement();
			} catch (e) {
				console.warn("[AlphaTabService] 手动刷新失败:", e);
			}
		});
	}

	public async loadScore(fileData: Uint8Array) {
		await this.api.load(fileData);
	}

	public async loadAlphaTexScore(textContent: string) {
		try {
			// 使用 AlphaTab 的 tex 方法加载 AlphaTex 内容
			if (typeof (this.api as any).tex === "function") {
				await (this.api as any).tex(textContent);
			} else {
				// 备用方案：使用 AlphaTexImporter
				const Importer: any = (alphaTab as any).importer
					?.AlphaTexImporter;
				if (Importer) {
					const importer = new Importer();
					importer.initFromString(textContent, this.api.settings);
					const score = importer.readScore();
					this.api.renderScore(score);
				} else {
					throw new Error("AlphaTexImporter not available");
				}
			}
		} catch (error) {
			console.error(
				"[AlphaTabService] Failed to load AlphaTex content:",
				error
			);
			throw error;
		}
	}

	/**
	 * 获取内部 API 实例 (仅用于兼容旧代码)
	 */
	public getApi(): alphaTab.AlphaTabApi {
		return this.api;
	}

	public destroy() {
		this.api.destroy();
		this.scrollProxy.destroy();
	}

	/**
	 * 重新构造 AlphaTabApi（不重复注册命令订阅，仅重建 API 和其事件监听）
	 */
	public reconstructApi(): void {
		try {
			if (this.api) {
				try {
					this.api.destroy();
				} catch {}
			}
			if (this.scrollProxy) {
				try {
					this.scrollProxy.destroy();
				} catch {}
			}
			const style = window.getComputedStyle(this.element);
			this.api = new alphaTab.AlphaTabApi(this.element, {
				core: {
					scriptFile: this.resources.alphaTabWorkerUri,
					smuflFontSources: (this.resources.bravuraUri
						? new Map([
								[
									(alphaTab as any).rendering?.glyphs
										?.FontFileFormat?.Woff2 ?? 0,
									this.resources.bravuraUri,
								],
						  ])
						: new Map()) as unknown as Map<number, string>,
					fontDirectory: "",
				},
				player: {
					enablePlayer: true,
					playerMode: alphaTab.PlayerMode.EnabledAutomatic,
					enableCursor: true,
					enableAnimatedBeatCursor: true,
					soundFont: this.resources.soundFontUri,
					scrollMode: alphaTab.ScrollMode.Continuous,
					scrollSpeed: 500,
					scrollOffsetY: -25,
					scrollOffsetX: 25,
					nativeBrowserSmoothScroll: false,
				},
				display: {
					resources: {
						mainGlyphColor:
							style.getPropertyValue("--color-base-100"),
						secondaryGlyphColor:
							style.getPropertyValue("--color-base-60"),
						staffLineColor:
							style.getPropertyValue("--color-base-40"),
						barSeparatorColor:
							style.getPropertyValue("--color-base-40"),
						barNumberColor:
							"#" +
							convert.hsl.hex([
								parseFloat(
									style.getPropertyValue("--accent-h")
								),
								parseFloat(
									style.getPropertyValue("--accent-s")
								),
								parseFloat(
									style.getPropertyValue("--accent-l")
								),
							]),
						scoreInfoColor:
							style.getPropertyValue("--color-base-100"),
					},
				},
			});
			this.scrollProxy = new ScrollConfigProxy(this.api);
			this.registerApiListeners();
			// 将新 API 上报给外界：某些组件直接持有 _api 引用
			this.eventBus.publish("状态:API已重建", this.api);
		} catch (e) {
			console.warn("[AlphaTabService] 重建 AlphaTabApi 失败:", e);
		}
	}

	/**
	 * 配置滚动元素
	 */
	public configureScrollElement(scrollElement?: HTMLElement | string): void {
		if (this.api.settings.player) {
			this.api.settings.player.scrollElement =
				scrollElement || "html,body";
			this.api.updateSettings();
			console.debug("[AlphaTabService] 滚动元素已配置:", scrollElement);
		}
	}
	/**
	 * 导出音频并返回 WAV Blob URL
	 */
	public async exportAudioToWav(
		options?: Partial<alphaTab.synth.AudioExportOptions>
	): Promise<string> {
		const exportOptions = new alphaTab.synth.AudioExportOptions();
		Object.assign(exportOptions, options);
		const exporter = await this.api.exportAudio(exportOptions);
		const chunks: Float32Array[] = [];
		try {
			while (true) {
				const chunk = await exporter.render(500);
				if (!chunk) break;
				chunks.push(chunk.samples);
			}
		} finally {
			exporter.destroy();
		}
		return convertSamplesToWavBlobUrl(chunks, exportOptions.sampleRate);
	}

	// WAV conversion implemented in src/utils/audioUtils.ts
}
