import * as alphaTab from "@coderline/alphatab";
import * as alphaTab from "@coderline/alphatab";

export interface CursorScrollOptions {
	enabled: boolean;
	smoothScroll: boolean;
	offsetY: number;
	offsetX: number; // 水平滚动偏移
	scrollSpeed: number;
	autoScrollOnPlay: boolean;
	alwaysScrollToBottom: boolean;
	scrollMode: 'continuous' | 'offscreen' | 'off'; // 新增：滚动模式选项
}

/**
 * 光标滚动管理器
 * 提供更精细的光标跟随滚动控制和自动滚动功能
 */
export class CursorScrollManager {
	private api: alphaTab.AlphaTabApi | null = null;
	private options: CursorScrollOptions;
	private lastScrollTime = 0;
	private scrollThrottle = 100; // 滚动节流时间（毫秒）

	constructor(options: Partial<CursorScrollOptions> = {}) {
		this.options = {
			enabled: true,
			smoothScroll: true,
			offsetY: -25, // 负值在顶部预留空间
			offsetX: 25,
			scrollSpeed: 500,
			autoScrollOnPlay: true,
			alwaysScrollToBottom: false,
			scrollMode: 'continuous', // 默认使用连续滚动模式
			...options
		};
	}

	public setApi(api: alphaTab.AlphaTabApi | null) {
		this.api = api;
		this.updateAlphaTabSettings();
	}

	public updateOptions(options: Partial<CursorScrollOptions>) {
		this.options = { ...this.options, ...options };
		this.updateAlphaTabSettings();
	}

	/**
	 * 更新AlphaTab的滚动设置
	 */
	private updateAlphaTabSettings() {
		if (!this.api || !this.api.settings) {
			console.debug("[CursorScrollManager] API或设置未就绪，跳过更新");
			return;
		}

		console.debug("[CursorScrollManager] 更新AlphaTab滚动设置:", this.options);

		// 同步设置到AlphaTab - 根据官方文档的最佳实践
		this.api.settings.player.enableCursor = this.options.enabled;
		this.api.settings.player.scrollSpeed = this.options.scrollSpeed;
		this.api.settings.player.scrollOffsetY = this.options.offsetY;
		this.api.settings.player.scrollOffsetX = this.options.offsetX;
		this.api.settings.player.nativeBrowserSmoothScroll = this.options.smoothScroll;
		
		// 根据配置选择合适的滚动模式
		if (!this.options.enabled || this.options.scrollMode === 'off') {
			this.api.settings.player.scrollMode = alphaTab.ScrollMode.Off;
		} else if (this.options.scrollMode === 'offscreen') {
			// OffScreen 模式：只有当光标超出显示范围时才滚动
			this.api.settings.player.scrollMode = alphaTab.ScrollMode.OffScreen;
		} else {
			// Continuous 模式：提供最流畅的体验（默认）
			this.api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
		}
		
		// 设置滚动容器 - 在 Obsidian 环境中，需要找到正确的滚动容器
		this.setupScrollElement();
		
		// 应用设置更改
		try {
			this.api.updateSettings();
			console.debug("[CursorScrollManager] ✅ AlphaTab设置更新成功", {
				scrollMode: this.api.settings.player.scrollMode,
				enabled: this.api.settings.player.enableCursor,
				scrollElement: this.api.settings.player.scrollElement
			});
		} catch (error) {
			console.warn("[CursorScrollManager] ❌ 更新设置失败:", error);
		}
	}

	/**
	 * 设置正确的滚动容器
	 */
	private setupScrollElement(): void {
		// 在 Obsidian 环境中，需要找到正确的滚动容器
		// 通常是包含 AlphaTab 内容的父容器
		
		// 尝试找到合适的滚动容器
		let scrollElement: HTMLElement | null = null;
		
		// 优先级1: 查找 .workspace-leaf-content（Obsidian 的内容容器）
		scrollElement = document.querySelector('.workspace-leaf-content.mod-active') as HTMLElement;
		
		// 优先级2: 查找 .view-content（视图内容容器）
		if (!scrollElement) {
			scrollElement = document.querySelector('.view-content') as HTMLElement;
		}
		
		// 优先级3: 使用默认的 html,body
		if (!scrollElement) {
			this.api!.settings.player.scrollElement = "html,body";
			console.debug("[CursorScrollManager] 使用默认滚动元素: html,body");
			return;
		}
		
		// 设置找到的滚动元素
		this.api!.settings.player.scrollElement = scrollElement;
		console.debug("[CursorScrollManager] 设置滚动元素:", scrollElement.className);
	}

	public setEnabled(enabled: boolean) {
		this.options.enabled = enabled;
	}

	public isEnabled(): boolean {
		return this.options.enabled;
	}

	/**
	 * 处理播放器位置变化事件
	 * 注意：根据AlphaTab文档，当正确配置滚动设置后，AlphaTab会自动处理滚动
	 * 这里主要处理特殊情况，如"始终滚动到底部"
	 */
	public handlePlayerPositionChanged(args: { 
		currentTime: number; 
		endTime: number; 
		currentTick: number; 
		endTick: number 
	}): void {
		if (!this.options.enabled || !this.api) {
			console.debug("[CursorScrollManager] 滚动已禁用或API未初始化");
			return;
		}

		const now = Date.now();
		if (now - this.lastScrollTime < this.scrollThrottle) {
			return; // 节流控制
		}
		this.lastScrollTime = now;

		// 检查是否应该滚动
		const isPlaying = this.api.playerState === 1; // PlayerState.Playing = 1
		const shouldAutoScroll = this.options.autoScrollOnPlay && isPlaying;

		console.debug("[CursorScrollManager] 位置变化:", {
			enabled: this.options.enabled,
			autoScrollOnPlay: this.options.autoScrollOnPlay,
			isPlaying,
			shouldAutoScroll,
			playerState: this.api.playerState,
			alwaysScrollToBottom: this.options.alwaysScrollToBottom
		});

		// 只有在特殊情况下才手动介入滚动
		if (shouldAutoScroll && this.options.alwaysScrollToBottom) {
			console.debug("[CursorScrollManager] 执行特殊滚动：滚动到底部");
			this.scrollToBottom();
		} else if (shouldAutoScroll) {
			console.debug("[CursorScrollManager] 依赖 AlphaTab 内置自动滚动");
			// AlphaTab 已经配置了正确的滚动设置，应该会自动处理滚动
			// 不需要手动调用 scrollToCursor()
		} else {
			console.debug("[CursorScrollManager] 跳过滚动 - 条件不满足");
		}
	}

	/**
	 * 滚动到光标位置
	 */
	private scrollToCursor(): void {
		if (!this.api) {
			console.warn("[CursorScrollManager] API未初始化");
			return;
		}

		// 根据官方文档，应该主要依赖 AlphaTab 内置的滚动机制
		// 因为 AlphaTab 已经在 playerPositionChanged 事件中自动处理滚动
		// 这里只是作为额外的触发方式
		try {
			// 检查当前滚动模式是否正确设置
			if (this.api.settings.player.scrollMode === alphaTab.ScrollMode.Off) {
				console.debug("[CursorScrollManager] 滚动模式为 Off，跳过滚动");
				return;
			}

			this.api.scrollToCursor();
			console.debug("[CursorScrollManager] ✅ 滚动到光标位置成功");
		} catch (error) {
			console.warn("[CursorScrollManager] ❌ AlphaTab 滚动失败:", error);
			
			// 如果API滚动失败，尝试手动DOM滚动作为备用方案
			this.fallbackScrollToCursor();
		}
	}

	/**
	 * 备用滚动方法 - 当API滚动失败时使用
	 */
	private fallbackScrollToCursor(): void {
		console.debug("[CursorScrollManager] 尝试备用滚动方法");
		
		// 查找光标元素
		const cursor = document.querySelector('.at-cursor-beat, .at-cursor-bar') as HTMLElement;
		const viewport = this.findScrollElement();
		
		if (cursor && viewport) {
			// 计算光标相对于视口的位置
			const cursorRect = cursor.getBoundingClientRect();
			const viewportRect = viewport.getBoundingClientRect();
			
			// 计算需要滚动的距离
			const targetScrollTop = viewport.scrollTop + cursorRect.top - viewportRect.top + this.options.offsetY;
			
			// 执行滚动
			if (this.options.smoothScroll) {
				viewport.scrollTo({
					top: targetScrollTop,
					behavior: 'smooth'
				});
			} else {
				viewport.scrollTop = targetScrollTop;
			}
			
			console.debug("[CursorScrollManager] ✅ 备用滚动完成");
		} else {
			console.warn("[CursorScrollManager] ❌ 未找到光标或视口元素");
		}
	}

	/**
	 * 滚动到乐谱底部 - 参考Vue版本实现
	 */
	public scrollToBottom(): void {
		if (!this.api) {
			console.warn("[CursorScrollManager] API未初始化，无法滚动到底部");
			return;
		}

		setTimeout(() => {
			this.performScrollToBottom();
		}, 10);
	}

	/**
	 * 执行滚动到底部的操作
	 */
	private performScrollToBottom(): void {
		if (!this.api || !this.api.score) {
			console.warn("[CursorScrollManager] 乐谱未加载，无法滚动");
			return;
		}

		try {
			const score = this.api.score;
			const masterBars = score.masterBars;

			// 如果没有小节，则退出
			if (!masterBars || masterBars.length === 0) {
				console.warn("[CursorScrollManager] 无法滚动：没有小节");
				return;
			}

			// 策略1：直接使用DOM滚动（简单可靠的方法）
			const viewport = this.findScrollElement();
			if (viewport) {
				setTimeout(() => {
					viewport.scrollTop = viewport.scrollHeight;
					console.debug("[CursorScrollManager] DOM滚动到底部完成");
				}, 10);
			}

			// 策略2：尝试设置位置并延迟滚动（API方法）
			this.scrollToEndWithApi(masterBars);

		} catch (e) {
			console.error("[CursorScrollManager] 滚动到乐谱末尾时出错:", e);
			
			// 最终回退：尝试找到任何可滚动的容器
			const scrollElement = this.findScrollElement();
			if (scrollElement) {
				scrollElement.scrollTop = scrollElement.scrollHeight;
			}
		}
	}

	/**
	 * 使用API滚动到末尾
	 */
	private scrollToEndWithApi(masterBars: alphaTab.model.MasterBar[]): void {
		setTimeout(() => {
			try {
				// 找到最后一个有效的小节
				let lastValidBarIndex = -1;
				for (let i = masterBars.length - 1; i >= 0; i--) {
					if (masterBars[i] && masterBars[i].calculateDuration() > 0) {
						lastValidBarIndex = i;
						break;
					}
				}

				if (lastValidBarIndex >= 0 && this.api) {
					const targetBar = masterBars[lastValidBarIndex];
					const endTick = targetBar.start + targetBar.calculateDuration();

					// 设置位置
					this.api.tickPosition = endTick;

					// 延迟滚动
					setTimeout(() => {
						try {
							if (this.api) {
								this.api.scrollToCursor();
								console.debug("[CursorScrollManager] API滚动到末尾完成");
							}
						} catch (err) {
							console.warn("[CursorScrollManager] API滚动失败:", err);
						}
					}, 150);
				}
			} catch (e) {
				console.warn("[CursorScrollManager] 设置tickPosition失败:", e);
			}
		}, 50);
	}

	/**
	 * 查找可滚动的元素
	 */
	private findScrollElement(): HTMLElement | null {
		// 按优先级查找滚动元素
		const selectors = [
			'.at-viewport',
			'.at-main',
			'.at-content'
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector) as HTMLElement;
			if (element && element.scrollHeight > element.clientHeight) {
				return element;
			}
		}

		return null;
	}

	/**
	 * 手动滚动到指定位置
	 */
	public scrollToPosition(tick: number): void {
		if (!this.api) {
			return;
		}

		try {
			// 如果有tick缓存，可以使用更精确的滚动
			if (this.api.tickCache) {
				const lookupResult = this.api.tickCache.findBeat(new Set([0]), tick);
				if (lookupResult) {
					console.debug("[CursorScrollManager] 找到对应的节拍位置:", lookupResult);
				}
			}

			// 设置位置并滚动
			this.api.tickPosition = tick;
			this.api.scrollToCursor();
		} catch (error) {
			console.warn("[CursorScrollManager] 手动滚动失败:", error);
		}
	}

	/**
	 * 启用/禁用始终滚动到底部
	 */
	public setAlwaysScrollToBottom(enabled: boolean): void {
		this.options.alwaysScrollToBottom = enabled;
		
		// 如果启用且当前正在播放，立即滚动
		if (enabled && this.api && this.api.playerState === 1) {
			this.scrollToBottom();
		}
	}

	/**
	 * 设置滚动模式
	 */
	public setScrollMode(mode: 'continuous' | 'offscreen' | 'off'): void {
		this.options.scrollMode = mode;
		this.updateAlphaTabSettings();
		console.debug(`[CursorScrollManager] 滚动模式已设置为: ${mode}`);
	}

	/**
	 * 获取当前滚动模式
	 */
	public getScrollMode(): 'continuous' | 'offscreen' | 'off' {
		return this.options.scrollMode;
	}

	/**
	 * 获取当前设置
	 */
	public getOptions(): CursorScrollOptions {
		return { ...this.options };
	}

	/**
	 * 是否启用始终滚动到底部
	 */
	public isAlwaysScrollToBottom(): boolean {
		return this.options.alwaysScrollToBottom;
	}
}
