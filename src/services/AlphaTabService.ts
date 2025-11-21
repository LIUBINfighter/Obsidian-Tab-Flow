// <-- ./src/services/AlphaTabService.ts -->

import * as alphaTab from '@coderline/alphatab';
import { App } from 'obsidian';
import { EventBus, convertSamplesToWavBlobUrl } from '../utils';
import { ScrollEventManager } from '../events/scrollEvents';
import * as convert from 'color-convert';

export class AlphaTabService {
	private api: alphaTab.AlphaTabApi;
	private scrollManager: ScrollEventManager;
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
				smuflFontSources: resources.bravuraUri
					? new Map<number, string>([
							[
								(
									alphaTab as {
										rendering?: {
											glyphs?: { FontFileFormat?: { Woff2?: number } };
										};
									}
								).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0,
								resources.bravuraUri,
							],
						])
					: new Map<number, string>(),
				fontDirectory: '',
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
					mainGlyphColor: style.getPropertyValue('--color-base-100'),
					secondaryGlyphColor: style.getPropertyValue('--color-base-60'),
					staffLineColor: style.getPropertyValue('--color-base-40'),
					barSeparatorColor: style.getPropertyValue('--color-base-40'),
					barNumberColor:
						'#' +
						convert.hsl.hex([
							parseFloat(style.getPropertyValue('--accent-h')),
							parseFloat(style.getPropertyValue('--accent-s')),
							parseFloat(style.getPropertyValue('--accent-l')),
						]),
					scoreInfoColor: style.getPropertyValue('--color-base-100'),
				},
			},
		});
		this.scrollManager = new ScrollEventManager(this.api);

		this.registerCommandHandlers();
		this.registerApiListeners();
		this.registerWorkspaceEvents();
	}

	private registerCommandHandlers() {
		// 选择音轨事件（弹出轨道选择 Modal） - 不再直接实例化 TracksModal，而是发出事件
		this.eventBus.subscribe('命令:选择音轨', () => {
			this.eventBus.publish('UI:showTracksModal');
		});
		this.eventBus.subscribe('命令:播放暂停', () => this.api.playPause());
		this.eventBus.subscribe('命令:停止', () => this.api.stop());
		this.eventBus.subscribe('命令:设置速度', (speed: number) => {
			this.api.playbackSpeed = speed;
		});
		this.eventBus.subscribe('命令:设置谱表', (profile: number) => {
			this.api.settings.display.staveProfile = profile;
			this.api.updateSettings();
			this.api.render();
		});
		this.eventBus.subscribe('命令:设置节拍器', (enabled: boolean) => {
			this.api.metronomeVolume = enabled ? 1 : 0;
		});
		this.eventBus.subscribe('命令:设置预备拍', (enabled: boolean) => {
			this.api.countInVolume = enabled ? 1 : 0;
		});
		this.eventBus.subscribe('命令:设置缩放', (scale: number) => {
			this.api.settings.display.scale = scale;
			this.api.updateSettings();
			this.api.render();
		});
		// 滚动相关
		this.eventBus.subscribe('命令:设置滚动模式', (mode: number) =>
			this.scrollManager.setScrollMode(mode as alphaTab.ScrollMode)
		);
		this.eventBus.subscribe('命令:设置滚动速度', (speed: number) =>
			this.scrollManager.setScrollSpeed(speed)
		);
		this.eventBus.subscribe('命令:设置Y偏移', (offset: number) =>
			this.scrollManager.setScrollOffsetY(offset)
		);
		this.eventBus.subscribe('命令:设置X偏移', (offset: number) =>
			this.scrollManager.setScrollOffsetX(offset)
		);
		this.eventBus.subscribe('命令:设置原生滚动', (enabled: boolean) =>
			this.scrollManager.setNativeBrowserSmoothScroll(enabled)
		);
		this.eventBus.subscribe('命令:滚动到光标', () =>
			this.scrollManager.triggerScrollToCursor()
		);
		// 新增：布局切换事件
		this.eventBus.subscribe('命令:切换布局', (layoutMode: number) => {
			if (this.api.settings && this.api.settings.display) {
				this.api.settings.display.layoutMode = layoutMode;
				this.api.updateSettings();
				this.api.render();
			}
		});
		// 新增：刷新播放器（重新渲染当前乐谱）
		this.eventBus.subscribe('命令:刷新播放器', () => {
			try {
				if (this.api?.score) {
					// 方案A：仅强制渲染
					this.api.render();
				}
			} catch (e) {
				console.warn('[AlphaTabService] 刷新播放器失败:', e);
			}
		});
		// 音频导出事件
		this.eventBus.subscribe(
			'命令:导出音频',
			(
				payload?: {
					fileName?: string;
				} & Partial<alphaTab.synth.AudioExportOptions>
			) => {
				void (async () => {
					try {
						const options = payload || {};
						const wavUrl = await this.exportAudioToWav(options);
						this.eventBus.publish('状态:音频导出完成', wavUrl);
					} catch (e) {
						this.eventBus.publish('状态:音频导出失败', e);
					}
				})();
			}
		);
		// 新增：导出 MIDI / PDF / GP 事件
		this.eventBus.subscribe('命令:导出MIDI', (payload?: { fileName?: string }) => {
			void (async () => {
				try {
					// Dynamically import to avoid circular dependency with events module
					const { registerExportEventHandlers } = await import('../events/exportEvents');
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || '').trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || 'Untitled';
						},
						app: this.app,
					});
					handlers.exportMidi();
				} catch (e) {
					console.warn('[AlphaTabService] 导出MIDI失败:', e);
				}
			})();
		});
		this.eventBus.subscribe('命令:导出PDF', (payload?: { fileName?: string }) => {
			void (async () => {
				try {
					// Dynamically import to avoid circular dependency with events module
					const { registerExportEventHandlers } = await import('../events/exportEvents');
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || '').trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || 'Untitled';
						},
						app: this.app,
					});
					handlers.exportPdf();
				} catch (e) {
					console.warn('[AlphaTabService] 导出PDF失败:', e);
				}
			})();
		});
		this.eventBus.subscribe('命令:导出GP', (payload?: { fileName?: string }) => {
			void (async () => {
				try {
					// Dynamically import to avoid circular dependency with events module
					const { registerExportEventHandlers } = await import('../events/exportEvents');
					const handlers = registerExportEventHandlers({
						api: this.api,
						getFileName: () => {
							const p = (payload?.fileName || '').trim();
							if (p) return p;
							const t = this.api?.score?.title;
							return (t && String(t).trim()) || 'Untitled';
						},
						app: this.app,
					});
					handlers.exportGp();
				} catch (e) {
					console.warn('[AlphaTabService] 导出GP失败:', e);
				}
			})();
		});
		// 命令：加载乐谱（传入 Uint8Array 或 ArrayBuffer）
		this.eventBus.subscribe('命令:加载乐谱', (data: Uint8Array | ArrayBuffer) => {
			void (async () => {
				try {
					const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
					await this.loadScore(bytes);
					this.eventBus.publish('状态:乐谱已加载');
				} catch (e) {
					this.eventBus.publish('状态:加载失败', e);
				}
			})();
		});

		// 命令：加载 AlphaTex 乐谱（传入文本内容）
		this.eventBus.subscribe('命令:加载AlphaTex乐谱', (textContent: string) => {
			void (async () => {
				try {
					await this.loadAlphaTexScore(textContent);
					this.eventBus.publish('状态:乐谱已加载');
				} catch (e) {
					this.eventBus.publish('状态:加载失败', e);
				}
			})();
		});
		// 命令：重新构造 AlphaTabApi
		this.eventBus.subscribe('命令:重建AlphaTabApi', () => {
			this.reconstructApi();
		});
		// 轨道事件订阅已移除：改为 TrackStateStore -> TabView -> API 的单向数据流
	}

	private registerApiListeners() {
		this.api.playerReady.on(() => this.eventBus.publish('状态:音频就绪'));
		this.api.error.on((err) => this.eventBus.publish('状态:错误', err));

		// 添加播放位置变化事件监听，用于进度条更新
		this.api.playerPositionChanged.on((args) => {
			this.eventBus.publish('状态:播放位置变化', {
				currentTime: args.currentTime || 0,
				endTime: args.endTime || 0,
			});
		});

		// 可继续补充其它 alphaTab 事件的监听和广播
	}

	private registerWorkspaceEvents() {
		// 监听手动刷新事件 - 使用事件总线而不是 workspace
		this.eventBus.subscribe('命令:手动刷新', () => {
			try {
				// console.debug('[AlphaTabService] 收到手动刷新事件');
				// 强制重新渲染
				if (this.api?.score) {
					this.api.render();
				}
				// 重新配置滚动元素
				this.configureScrollElement();
			} catch (e) {
				console.warn('[AlphaTabService] 手动刷新失败:', e);
			}
		});
	}

	public async loadScore(fileData: Uint8Array) {
		const maybePromise = this.api.load(fileData) as unknown;
		if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
			await (maybePromise as PromiseLike<void>);
		}
	}

	public async loadAlphaTexScore(textContent: string) {
		try {
			// 使用 AlphaTab 的 tex 方法加载 AlphaTex 内容
			const extendedApi = this.api as alphaTab.AlphaTabApi & {
				tex?: (text: string) => void | Promise<void>;
			};
			if (typeof extendedApi.tex === 'function') {
				const result = extendedApi.tex(textContent);
				const maybePromise = result as unknown;
				if (
					maybePromise &&
					typeof (maybePromise as PromiseLike<void>).then === 'function'
				) {
					await (maybePromise as PromiseLike<void>);
				}
			} else {
				// 备用方案：使用 AlphaTexImporter
				type AlphaTabImporter = {
					importer?: {
						AlphaTexImporter?: new () => {
							initFromString: (text: string, settings: unknown) => void;
							readScore: () => unknown;
						};
					};
				};
				const Importer = (alphaTab as AlphaTabImporter).importer?.AlphaTexImporter;
				if (Importer) {
					const importer = new Importer();
					importer.initFromString(textContent, this.api.settings);
					const score = importer.readScore();
					this.api.renderScore(score as alphaTab.model.Score);
				} else {
					throw new Error('AlphaTexImporter not available');
				}
			}
		} catch (error) {
			console.error('[AlphaTabService] Failed to load AlphaTex content:', error);
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
		this.scrollManager.destroy();
	}

	/**
	 * 重新构造 AlphaTabApi（不重复注册命令订阅，仅重建 API 和其事件监听）
	 */
	public reconstructApi(): void {
		try {
			if (this.api) {
				try {
					this.api.destroy();
				} catch {
					// Ignore API destroy errors
				}
			}
			if (this.scrollManager) {
				try {
					this.scrollManager.destroy();
				} catch (e) {
					console.warn('[AlphaTabService] scrollManager destroy failed', e);
				}
			}
			const style = window.getComputedStyle(this.element);
			this.api = new alphaTab.AlphaTabApi(this.element, {
				core: {
					scriptFile: this.resources.alphaTabWorkerUri,
					smuflFontSources: this.resources.bravuraUri
						? new Map<number, string>([
								[
									(
										alphaTab as {
											rendering?: {
												glyphs?: { FontFileFormat?: { Woff2?: number } };
											};
										}
									).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0,
									this.resources.bravuraUri,
								],
							])
						: new Map<number, string>(),
					fontDirectory: '',
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
						mainGlyphColor: style.getPropertyValue('--color-base-100'),
						secondaryGlyphColor: style.getPropertyValue('--color-base-60'),
						staffLineColor: style.getPropertyValue('--color-base-40'),
						barSeparatorColor: style.getPropertyValue('--color-base-40'),
						barNumberColor:
							'#' +
							convert.hsl.hex([
								parseFloat(style.getPropertyValue('--accent-h')),
								parseFloat(style.getPropertyValue('--accent-s')),
								parseFloat(style.getPropertyValue('--accent-l')),
							]),
						scoreInfoColor: style.getPropertyValue('--color-base-100'),
					},
				},
			});
			this.scrollManager = new ScrollEventManager(this.api);
			this.registerApiListeners();
			// 将新 API 上报给外界：某些组件直接持有 _api 引用
			this.eventBus.publish('状态:API已重建', this.api);
		} catch (e) {
			console.warn('[AlphaTabService] 重建 AlphaTabApi 失败:', e);
		}
	}

	/**
	 * 配置滚动元素
	 */
	public configureScrollElement(scrollElement?: HTMLElement | string): void {
		if (this.api.settings.player) {
			this.api.settings.player.scrollElement = scrollElement || 'html,body';
			this.api.updateSettings();
			// console.debug('[AlphaTabService] 滚动元素已配置:', scrollElement);
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
			let chunk: unknown;
			while ((chunk = await exporter.render(500))) {
				interface AudioChunk {
					samples?: Float32Array;
				}
				chunks.push((chunk as AudioChunk).samples || new Float32Array());
			}
		} finally {
			exporter.destroy();
		}
		return convertSamplesToWavBlobUrl(chunks, exportOptions.sampleRate);
	}

	// WAV conversion implemented in src/utils/audioUtils.ts
}
