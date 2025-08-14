import { FileView, TFile, WorkspaceLeaf, Plugin, Notice } from "obsidian";

export const VIEW_TYPE_TAB = "tab-view";

import * as alphaTab from "@coderline/alphatab";
import * as convert from "color-convert";

import { EventBus } from "../utils/EventBus";
import { AlphaTabService } from "../services/AlphaTabService";
import { ExternalMediaService } from "../services/ExternalMediaService";
import { createPlayBar } from "../components/PlayBar";

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
	private scoreTitle: string = ""; // 新增：乐谱标题
    // --- 新增：外部音频集成 ---
    private audioEl: HTMLAudioElement | null = null;
    private audioObjectUrl: string | null = null;
    private externalMediaService: ExternalMediaService | null = null;
    private settingsChangeHandler?: () => void;
    // --- 新增：横向布局时将垂直滚轮转写为水平滚动 ---
    private wheelHandlerBoundEl: HTMLElement | null = null;
    private wheelHandler: ((e: WheelEvent) => void) | null = null;

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
		if (this.scoreTitle && this.scoreTitle.trim()) {
			return this.scoreTitle;
		}
		if (this.currentFile) {
			return this.currentFile.basename;
		}
		return "alphaTab";
	}

/**
 * 获取乐谱标题，供外部如 DebugBar、导出等使用。
 * 优先返回解析到的乐谱标题，若检测为乱码则尝试多种编码，最终回退到文件名。
 */
public getScoreTitle(): string {
	// 1. 优先用已保存的scoreTitle
	if (this.scoreTitle && this.scoreTitle.trim() && !this.isMessy(this.scoreTitle)) {
		return this.scoreTitle;
	}
	// 2. 若scoreTitle疑似乱码，尝试多种编码（如有原始buffer，可在此尝试）
	// 这里假设scoreTitle就是alphaTab解析出来的，若有原始buffer可进一步尝试
	// 3. 回退到文件名
	if (this.currentFile) return this.currentFile.basename;
	return "alphaTab";
}

    // --- 新增：根据布局启用/解绑滚轮转写 ---
    private updateWheelToHorizontalBinding(): void {
        try {
            if (!this._api) return;

            const isHorizontal =
                this._api.settings?.display?.layoutMode === (alphaTab as any).LayoutMode?.Horizontal;

            // 选择绑定的滚动容器：优先使用 settings.player.scrollElement
            let el: HTMLElement | null = null;
            const configured = (this._api.settings?.player as any)?.scrollElement as any;
            if (configured && configured instanceof HTMLElement) el = configured;
            if (!el) el = this.contentEl.querySelector('.at-viewport') as HTMLElement | null;
            if (!el) el = this.containerEl as HTMLElement;

            // 解绑旧的
            if (this.wheelHandlerBoundEl && this.wheelHandler) {
                try { this.wheelHandlerBoundEl.removeEventListener('wheel', this.wheelHandler as any); } catch {}
                this.wheelHandlerBoundEl = null;
                this.wheelHandler = null;
            }

            if (!isHorizontal || !el) return;

            const handler = (e: WheelEvent) => {
                // 不干预缩放/系统快捷
                if (e.ctrlKey || e.metaKey || e.altKey) return;

                const target = el as HTMLElement;
                const canScrollHoriz = target.scrollWidth > target.clientWidth;
                if (!canScrollHoriz) return;

                // 归一化 delta
                const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? (target as HTMLElement).clientWidth : 1;
                const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                const dx = primaryDelta * unit;

                const atStart = (target as HTMLElement).scrollLeft <= 0;
                const atEnd = (target as HTMLElement).scrollLeft + (target as HTMLElement).clientWidth >= (target as HTMLElement).scrollWidth - 1;
                const goingLeft = dx < 0;
                const goingRight = dx > 0;
                if ((atStart && goingLeft) || (atEnd && goingRight)) return;

                (target as HTMLElement).scrollLeft += dx;
                e.preventDefault();
                e.stopPropagation();
            };

            el.addEventListener('wheel', handler, { passive: false });
            this.wheelHandlerBoundEl = el;
            this.wheelHandler = handler;
        } catch {}
    }

/**
 * 检查字符串是否为乱码（CJK场景下常见）
 */
private isMessy(str: string): boolean {
	if (!str) return true;
	// 统计“�”比例或全为不可见字符
	const total = str.length;
	const bad = (str.match(/[�\uFFFD]/g) || []).length;
	if (bad / total > 0.5) return true;
	// 仅由标点/空格/不可见字符组成
	if (/^[\s\p{P}\p{C}]+$/u.test(str)) return true;
	// 进一步：全为非CJK字符且长度大于2也视为异常
	if (!/[\u4e00-\u9fa5]/.test(str) && total > 2) return true;
	return false;
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
		// 隐藏 Obsidian 全局状态栏（仅当 TabView 存在时）
		styles.innerHTML += `
		.tabflow-hide-statusbar .status-bar { display: none !important; }
		`;
		this._styles = styles;

		// 添加标记类以隐藏状态栏
		try { document.body.classList.add('tabflow-hide-statusbar'); } catch {}

		// 注册文件变更监听
		this.registerFileWatcher();

		// 1. 创建主内容容器和样式
		const element = this.contentEl.createDiv({ cls: cls });
		// 2. 初始化 AlphaTabService（注意参数顺序，app 必须为第一个参数）
		this.alphaTabService = new AlphaTabService(
			this.app,
			element,
			this.resources,
			this.eventBus
		);
		
		// 为兼容性设置 _api 引用
		this._api = this.alphaTabService.getApi();


			// 3. 渲染 DebugBar（受设置控制：开发者选项）
			this.renderDebugBarIfEnabled();

    // 4. 渲染底部播放栏 PlayBar
		// 新方案：在 scoreLoaded 后再渲染 PlayBar，并确保 getCurrentTime/getDuration/seekTo 始终指向最新 player
        const mountPlayBar = () => {
			// 清除已有的播放栏（避免重复）
			const existingPlayBar = document.querySelector('.play-bar');
			if (existingPlayBar) existingPlayBar.remove();
			
			// 创建新的播放栏
			const playBar = createPlayBar({
				app: this.app,
				eventBus: this.eventBus,
				initialPlaying: false,
				getCurrentTime: () => {
					// AlphaTab API 中没有直接提供 getPosition 方法
					// 我们需要使用 tickPosition 和其他属性来计算当前时间
					try {
						if (this._api) {
							// 使用 timePosition 属性（如果存在）
							// @ts-ignore
							if (typeof this._api.tickPosition === 'number' && this._api.score) {
								// @ts-ignore 
								return this._api.timePosition || 0;
							}
						}
					} catch (e) {
						console.debug("[TabView] 获取当前播放位置出错:", e);
					}
					return 0;
				},
				getDuration: () => {
					// 尝试从乐谱中获取总时长
					try {
						if (this._api?.score) {
							// alphaTab API 中 score 对象可能有 duration 属性
							// @ts-ignore
							return this._api.score.duration || 0;
						}
					} catch (e) {
						console.debug("[TabView] 获取乐谱总时长出错:", e);
					}
					return 0;
				},
				seekTo: (ms) => {
					try {
						// alphaTab API 可能提供 playerPosition 属性来设置播放位置
						// @ts-ignore
						if (this._api && typeof this._api.playerPosition !== 'undefined') {
							// @ts-ignore
							this._api.playerPosition = ms;
						}
						// 或者尝试使用 timePosition 属性
						// @ts-ignore
						else if (this._api && typeof this._api.timePosition !== 'undefined') {
							// @ts-ignore
							this._api.timePosition = ms;
						}
					} catch (e) {
						console.debug("[TabView] 设置播放位置出错:", e);
					}
                },
                // 新增：获取 audio 元素并完成集成
                onAudioCreated: (audioEl: HTMLAudioElement) => {
                    this.audioEl = audioEl;
                    console.debug('[TabView] onAudioCreated: setupAudioIntegration type =', typeof (this as any).setupAudioIntegration);
                    this.setupAudioIntegration().catch(err => {
                        console.error('[TabView] 外部音频集成失败:', err);
                        new Notice('音频加载失败，无法播放。');
                    });
                },
			});
			
			// 确保挂载到容器并显示，添加调试信息
			this.containerEl.appendChild(playBar);
			
			// 添加播放位置变化事件监听，更新进度条
			if (this._api) {
				// 监听播放位置变化事件
				this._api.playerPositionChanged.on((args) => {
					// 手动触发更新，不需要额外操作，因为PlayBar组件会自动调用getCurrentTime
					// 在下一帧更新UI，避免频繁更新造成性能问题
					window.requestAnimationFrame(() => {
						const progressFill = playBar.querySelector('.progress-fill') as HTMLElement;
						const progressHandle = playBar.querySelector('.progress-handle') as HTMLElement;
						const currentTimeDisplay = playBar.querySelector('.current-time') as HTMLElement;
						const totalTimeDisplay = playBar.querySelector('.total-time') as HTMLElement;
						
						if (progressFill && progressHandle && currentTimeDisplay && totalTimeDisplay) {
							// 使用 playerPositionChanged 事件提供的时间信息
							const currentTime = args.currentTime || 0;
							const duration = args.endTime || 0;
							
							// 更新时间显示
							currentTimeDisplay.textContent = formatTime(currentTime);
							totalTimeDisplay.textContent = formatTime(duration);
							
							// 更新进度条
							if (duration > 0) {
								const progress = (currentTime / duration) * 100;
								progressFill.style.width = `${progress}%`;
								
								// 设置手柄位置为进度条填充的末端
								const handlePos = progress;
								progressHandle.style.left = `${handlePos}%`;
                        }
						}
					});
				});
			}
			
			// 格式化时间显示（毫秒 -> mm:ss）
			function formatTime(ms: number): string {
				if (isNaN(ms) || ms < 0) return "0:00";
				const totalSeconds = Math.floor(ms / 1000);
				const minutes = Math.floor(totalSeconds / 60);
				const seconds = totalSeconds % 60;
				return `${minutes}:${seconds.toString().padStart(2, "0")}`;
			}
			
			// 检查播放栏是否正确渲染
			setTimeout(() => {
				const isPlayBarVisible = document.querySelector('.play-bar');
				if (isPlayBarVisible) {
					console.debug("[TabView] 播放栏已成功挂载并可见");
				} else {
					console.warn("[TabView] 播放栏挂载后不可见，可能存在样式问题");
				}
				
				// 检查进度条是否存在
				const progressBar = document.querySelector('.progress-bar-container');
				if (progressBar) {
					console.debug("[TabView] 进度条已正确渲染");
				} else {
					console.warn("[TabView] 进度条未渲染，可能需要检查组件结构");
				}
			}, 100);
			
			console.debug("[TabView] 播放栏已挂载到TabView容器");
		};

		// 监听 scoreLoaded，乐谱加载后挂载播放栏
		if (this._api && this._api.scoreLoaded) {
			this._api.scoreLoaded.on(() => {
				setTimeout(() => {
					mountPlayBar();
					this.updateWheelToHorizontalBinding();
				}, 100);
			});
		} else {
			// 兜底：如果未能监听到 scoreLoaded，延迟挂载
			setTimeout(() => {
				mountPlayBar();
				this.updateWheelToHorizontalBinding();
			}, 500);
		}

        // 订阅刷新播放器命令：对当前文件执行完整重载
        this.eventBus.subscribe("命令:刷新播放器", async () => {
            try {
                if (this.currentFile) {
                    await this.reloadFile();
                } else if (this._api) {
                    // 没有文件时至少强制渲染刷新
                    this._api.render();
                }
            } catch (e) {
                console.warn("[TabView] 刷新播放器失败:", e);
            }
        });

		// 设置变化时重新挂载 PlayBar（组件可见性变更）
		// @ts-ignore
		this.registerEvent(this.app.workspace.on('tabflow:playbar-components-changed', () => {
			try {
				const existing = document.querySelector('.play-bar');
				if (existing) existing.remove();
				mountPlayBar();
			} catch (e) {
				console.warn('[TabView] 重新挂载 PlayBar 失败:', e);
			}
		}));

		// 监听设置变化，实时响应 Debug Bar 挂载/卸载
        this.settingsChangeHandler = () => {
            try {
                const enabled = (this.plugin as any)?.settings?.showDebugBar === true;
                const existing = this.contentEl.querySelector('.debug-bar');
                if (enabled && !existing) {
                    this.renderDebugBarIfEnabled();
                } else if (!enabled && existing) {
                    (existing as HTMLElement).remove();
                }
            } catch {}
        };
        // 监听自定义事件以实时响应 SettingTab 的切换
        // @ts-ignore
        this.registerEvent(this.app.workspace.on('tabflow:debugbar-toggle', this.settingsChangeHandler));

		// 布局切换后更新滚轮绑定
		this.eventBus.subscribe("命令:切换布局", () => {
			setTimeout(() => this.updateWheelToHorizontalBinding(), 10);
		});

        // 订阅加载乐谱：由视图读取文件并下发数据给 AlphaTabService
        this.eventBus.subscribe("命令:加载当前文件", async () => {
            if (!this.currentFile) return;
            try {
                // 根据文件扩展名决定读取方式
                if (this.currentFile.extension && ["alphatab", "alphatex"].includes(this.currentFile.extension.toLowerCase())) {
                    // AlphaTex 文件作为文本读取
                    const textContent = await this.app.vault.read(this.currentFile);
                    this.eventBus.publish("命令:加载AlphaTex乐谱", textContent);
                } else {
                    // Guitar Pro 等二进制文件
                    const inputFile = await this.app.vault.readBinary(this.currentFile);
                    this.eventBus.publish("命令:加载乐谱", new Uint8Array(inputFile));
                }
            } catch (e) {
                console.warn("[TabView] 加载当前文件失败:", e);
            }
        });

        // 订阅重建 API：触发服务层重建
        this.eventBus.subscribe("命令:重新构造AlphaTabApi", () => {
            this.eventBus.publish("命令:重建AlphaTabApi");
        });

        // 服务层 API 重建完成后，更新本视图引用并重新加载当前文件
        this.eventBus.subscribe("状态:API已重建", () => {
            try {
                // 1) 更新 _api 引用
                this._api = this.alphaTabService.getApi();

                // 2) 重新配置滚动容器
                this.configureScrollElement();

                // 3) 附加 scoreLoaded 处理和播放栏挂载
                if (this._api && this._api.scoreLoaded) {
                    this._api.scoreLoaded.on(() => {
                        const score = this._api.score;
                        // 标题
                        if (score && score.title && !this.isMessy(score.title)) {
                            this.scoreTitle = score.title;
                        } else if (this.currentFile) {
                            this.scoreTitle = this.currentFile.basename;
                        }
                        // 写入 filePath 以用于持久化键
                        try {
                            if (score && this.currentFile?.path) {
                                (score as any).filePath = this.currentFile.path;
                            }
                        } catch {}

                        // 读取并应用持久化的视图状态（音轨选择与轨道参数）
                        try {
                            const filePathKey = (this._api as any)?.score?.filePath as string | undefined;
                            if (filePathKey) {
                                const raw = localStorage.getItem("tabflow-viewstate:" + filePathKey);
                                if (raw) {
                                    const state = JSON.parse(raw) || {};
                                    const allTracks: alphaTab.model.Track[] = this._api.score?.tracks || [];
                                    // 渲染选中的音轨
                                    if (Array.isArray(state.tracks) && state.tracks.length > 0) {
                                        const idxSet = new Set<number>(state.tracks);
                                        const selected = allTracks.filter(t => idxSet.has(t.index));
                                        if (selected.length > 0) {
                                            this._api.renderTracks(selected as any);
                                        }
                                    }
                                    // 应用轨道参数
                                    if (state.trackSettings && typeof state.trackSettings === 'object') {
                                        const settings: Record<string, any> = state.trackSettings;
                                        allTracks.forEach(track => {
                                            const s = settings[String(track.index)] || settings[track.index];
                                            if (!s) return;
                                            try {
                                                if (typeof s.solo === 'boolean') {
                                                    this._api.changeTrackSolo([track], s.solo);
                                                    // @ts-ignore
                                                    track.playbackInfo.isSolo = s.solo;
                                                }
                                                if (typeof s.mute === 'boolean') {
                                                    this._api.changeTrackMute([track], s.mute);
                                                    // @ts-ignore
                                                    track.playbackInfo.isMute = s.mute;
                                                }
                                                if (typeof s.volume === 'number') {
                                                    const vol = Math.max(0, Math.min(16, s.volume));
                                                    this._api.changeTrackVolume([track], vol / 16);
                                                    // @ts-ignore
                                                    track.playbackInfo.volume = vol;
                                                }
                                                if (typeof s.transpose === 'number') {
                                                    const tr = Math.max(-12, Math.min(12, s.transpose));
                                                    this._api.changeTrackTranspositionPitch([track], tr);
                                                }
                                                if (typeof s.transposeAudio === 'number') {
                                                    // @ts-ignore
                                                    track.playbackInfo.transposeAudio = s.transposeAudio;
                                                }
                                            } catch {}
                                        });
                                    }
                                }
                            }
                        } catch {}

                        // 刷新 header 文本
                        this.leaf?.setViewState({
                            type: VIEW_TYPE_TAB,
                            state: { file: this.currentFile?.path }
                        }, { history: false });

                        // 触发播放栏重挂载（内部包含去重逻辑）
                        setTimeout(() => {
                            const existingPlayBar = document.querySelector('.play-bar');
                            if (existingPlayBar) existingPlayBar.remove();
                            // 复用顶部定义的 mountPlayBar，保证功能与时间显示完整
                            const reMount = () => {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const { createPlayBar } = require("../components/PlayBar");
                                const playBar = createPlayBar({
                                    app: this.app,
                                    eventBus: this.eventBus,
                                    initialPlaying: false,
                                    getCurrentTime: () => 0,
                                    getDuration: () => 0,
                                    seekTo: () => {},
                                    onAudioCreated: () => {},
                                });
                                this.containerEl.appendChild(playBar);
                            };
                            reMount();

                            // 如开启了 DebugBar，则重建以绑定新 API
                            try {
                                const showDebugBar = (this.plugin as any)?.settings?.showDebugBar === true;
                                if (showDebugBar) {
                                    const old = this.contentEl.querySelector('.debug-bar');
                                    if (old) old.remove();
                                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                                    const { createDebugBar } = require("../components/DebugBar");
                                    const debugBar = createDebugBar({
                                        app: this.app,
                                        api: this.alphaTabService.getApi(),
                                        isAudioLoaded: this.isAudioLoaded.bind(this),
                                        onTrackModal: () => {},
                                        eventBus: this.eventBus,
                                        getScoreTitle: this.getScoreTitle.bind(this)
                                    });
                                    this.contentEl.insertBefore(debugBar, this.contentEl.firstChild);
                                }
                            } catch {}
						}, 50);

						// 布局或渲染变化后更新滚轮绑定
						this.updateWheelToHorizontalBinding();
                    });
                }

                // 4) 加载当前文件，延迟以确保 API 完全就绪
                setTimeout(() => {
                    this.eventBus.publish("命令:加载当前文件");
                }, 50);
            } catch (e) {
                console.warn("[TabView] 处理 API 重建事件失败:", e);
            }
        });

        // 导航命令：滚动到顶部/底部
        this.eventBus.subscribe("命令:滚动到顶部", () => {
            try {
                if (this._api) {
                    this._api.tickPosition = 0;
                    this._api.scrollToCursor?.();
                }
            } catch {}
        });
        this.eventBus.subscribe("命令:滚动到底部", () => {
            try {
                this.scrollToBottom();
            } catch {}
        });
	}

    // --- 新增：设置外部音频集成（导出音频并建立同步）---
    private setupAudioIntegration = async (): Promise<void> => {
        if (!this._api || !this.audioEl) return;

        // 1) 建立 external media 同步桥接
        if (!this.externalMediaService) {
            this.externalMediaService = new ExternalMediaService(this._api, this.eventBus);
        } else {
            this.externalMediaService.disconnectMedia();
        }
        this.externalMediaService.connectMedia(this.audioEl);

        // 2) 导出音频为 WAV 并设置 src（生成一次，缓存至卸载）
        try {
            new Notice('正在生成音频，请稍候...');
            // 释放旧的 URL
            if (this.audioObjectUrl && this.audioObjectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioObjectUrl);
                this.audioObjectUrl = null;
            }
            const wavUrl = await this.alphaTabService.exportAudioToWav({
                masterVolume: 1,
                metronomeVolume: 0,
                sampleRate: 44100,
            });
            this.audioObjectUrl = wavUrl;
            this.audioEl.src = wavUrl;
            this.audioEl.load();
            new Notice('音频已加载！');
        } catch (e) {
            console.error('[TabView] 导出音频失败:', e);
            throw e;
        }
    }

    // --- 渲染 DebugBar（根据设置）---
    private renderDebugBarIfEnabled(): void {
        try {
            const show = (this.plugin as any)?.settings?.showDebugBar === true;
            const existing = this.contentEl.querySelector('.debug-bar');
            if (!show) {
                if (existing) (existing as HTMLElement).remove();
                return;
            }
            if (existing) return;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { createDebugBar } = require("../components/DebugBar");
            const debugBar = createDebugBar({
                app: this.app,
                api: this.alphaTabService.getApi(),
                isAudioLoaded: this.isAudioLoaded.bind(this),
                onTrackModal: () => {},
                eventBus: this.eventBus,
                getScoreTitle: this.getScoreTitle.bind(this)
            });
            this.contentEl.insertBefore(debugBar, this.contentEl.firstChild);
        } catch {}
    }

	onunload(): void {
		console.debug("[TabView] Starting cleanup process");

		// 恢复状态栏显示
		try { document.body.classList.remove('tabflow-hide-statusbar'); } catch {}

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

		// 清理外部音频资源
        try {
            if (this.externalMediaService) {
                this.externalMediaService.destroy();
                this.externalMediaService = null;
            }
            if (this.audioEl) {
                try { this.audioEl.pause(); } catch {}
            }
            if (this.audioObjectUrl && this.audioObjectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioObjectUrl);
                this.audioObjectUrl = null;
            }
        } catch (e) {
            console.warn('[TabView] 清理外部音频资源失败:', e);
        }

		// 解绑滚轮事件
		try {
			if (this.wheelHandlerBoundEl && this.wheelHandler) {
				this.wheelHandlerBoundEl.removeEventListener('wheel', this.wheelHandler as any);
			}
		} catch {}
		this.wheelHandlerBoundEl = null;
		this.wheelHandler = null;

        // 清理引用
		this.currentFile = null;

		console.debug("[TabView] View unloaded and resources cleaned up");
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;
		try {
			console.debug(`[TabView] Loading file: ${file.name}`);
			// 先绑定 scoreLoaded 事件，再触发加载，避免首开时事件错过
			const attachScoreLoadedHandler = () => {
				if (!this._api || !this._api.scoreLoaded) return;
				this._api.scoreLoaded.on(() => {
					const score = this._api.score;
					// 1) 标题同步
					if (score && score.title && !this.isMessy(score.title)) {
						this.scoreTitle = score.title;
					} else {
						this.scoreTitle = this.currentFile ? this.currentFile.basename : "";
					}

					// 2) 将文件路径写入 score，用于 TracksModal 等处做持久化键
					try {
						if (score && this.currentFile?.path) {
							(score as any).filePath = this.currentFile.path;
						}
					} catch {}

					// 3) 读取并应用持久化的视图状态（音轨选择与轨道参数）
					try {
						const filePathKey = (this._api as any)?.score?.filePath as string | undefined;
						if (filePathKey) {
							const raw = localStorage.getItem("tabflow-viewstate:" + filePathKey);
							if (raw) {
								const state = JSON.parse(raw) || {};
								const allTracks: alphaTab.model.Track[] = this._api.score?.tracks || [];

								// 3.1 渲染选中的音轨
								if (Array.isArray(state.tracks) && state.tracks.length > 0) {
									const idxSet = new Set<number>(state.tracks);
									const selected = allTracks.filter(t => idxSet.has(t.index));
									if (selected.length > 0) {
										this._api.renderTracks(selected as any);
									}
								}

								// 3.2 应用轨道参数（solo/mute/volume/transpose）
								if (state.trackSettings && typeof state.trackSettings === 'object') {
									const settings: Record<string, any> = state.trackSettings;
									allTracks.forEach(track => {
										const s = settings[String(track.index)] || settings[track.index];
										if (!s) return;
										try {
											if (typeof s.solo === 'boolean') {
												this._api.changeTrackSolo([track], s.solo);
												// @ts-ignore
												track.playbackInfo.isSolo = s.solo;
											}
											if (typeof s.mute === 'boolean') {
												this._api.changeTrackMute([track], s.mute);
												// @ts-ignore
												track.playbackInfo.isMute = s.mute;
											}
											if (typeof s.volume === 'number') {
												const vol = Math.max(0, Math.min(16, s.volume));
												this._api.changeTrackVolume([track], vol / 16);
												// @ts-ignore
												track.playbackInfo.volume = vol;
											}
											if (typeof s.transpose === 'number') {
												const tr = Math.max(-12, Math.min(12, s.transpose));
												this._api.changeTrackTranspositionPitch([track], tr);
											}
											if (typeof s.transposeAudio === 'number') {
												// @ts-ignore
												track.playbackInfo.transposeAudio = s.transposeAudio;
											}
										} catch {}
									});
								}
							}
						}
					} catch {}

					// 4) 强制刷新 header
					this.leaf?.setViewState({
						type: VIEW_TYPE_TAB,
						state: { file: this.currentFile?.path }
					}, { history: false });
				});
			};
			attachScoreLoadedHandler();

			// 使用 AlphaTabService 加载文件（在事件绑定之后）
			// 根据文件扩展名决定读取方式
			if (file.extension && ["alphatab", "alphatex"].includes(file.extension.toLowerCase())) {
				// AlphaTex 文件作为文本读取
				const textContent = await this.app.vault.read(file);
				await this.alphaTabService.loadAlphaTexScore(textContent);
			} else {
				// Guitar Pro 等二进制文件
				const inputFile = await this.app.vault.readBinary(file);
				await this.alphaTabService.loadScore(new Uint8Array(inputFile));
			}
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

		// 再次延迟绑定滚轮转写（等待 DOM 就绪）
		setTimeout(() => this.updateWheelToHorizontalBinding(), 50);
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
			// 根据文件扩展名决定读取方式
			if (this.currentFile.extension && ["alphatab", "alphatex"].includes(this.currentFile.extension.toLowerCase())) {
				// AlphaTex 文件作为文本读取
				const textContent = await this.app.vault.read(this.currentFile);
				await this.alphaTabService.loadAlphaTexScore(textContent);
			} else {
				// Guitar Pro 等二进制文件
				const inputFile = await this.app.vault.readBinary(this.currentFile);
				this._api.load(new Uint8Array(inputFile));
			}
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
