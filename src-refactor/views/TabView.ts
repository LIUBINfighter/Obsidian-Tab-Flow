import { FileView, TFile, WorkspaceLeaf, Plugin } from "obsidian";

export const VIEW_TYPE_TAB = "tab-view";

import * as alphaTab from "@coderline/alphatab";
// @ts-ignore - color-convert 没有类型定义
import convert from "color-convert";

export type AlphaTabResources = {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontData: Uint8Array;
};

export class TabView extends FileView {
	private static instanceId = 0;
	private _api!: alphaTab.AlphaTabApi;
	private _styles: HTMLStyleElement;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: Plugin,
		private resources: AlphaTabResources
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_TAB;
	}

	getDisplayText(): string {
		return "alphaTab";
	}

	async onload(): Promise<void> {
		if (!this.containerEl) {
			console.error("Container element not available");
			return;
		}

		if (!this.isResourcesValid()) {
			console.error(
				"Plugin resources not properly loaded, TabView may not function correctly"
			);
			// 继续初始化，但用户会收到警告
		}

		try {
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

			const toolbar = this.contentEl.createDiv();
			const playPause = toolbar.createEl("button");
			playPause.innerText = "Play/Pause";
			playPause.onclick = () => {
				if (this._api) {
					this._api.playPause();
				}
			};

			const element = this.contentEl.createDiv({ cls: cls });
			const style = window.getComputedStyle(element);

			// 手动注入字体到 DOM 中，确保 AlphaTab 可以访问
			console.log('Starting font injection for AlphaTab...');
			await this.injectFontToDom();
			console.log('Font injection completed, initializing AlphaTab...');

			// 等待一帧确保字体样式已应用
			await new Promise(resolve => requestAnimationFrame(resolve));

			const api = new alphaTab.AlphaTabApi(element, {
				core: {
					// we can use the plugin file as worker entry point as we import alphaTab into this file here
					// this will initialize whatever is needed.
					scriptFile: this.resources.alphaTabWorkerUri,
					fontDirectory: undefined, // 明确设置为 undefined，使用注入的字体
				},
				player: {
					playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				},
				display: {
					resources: {
						// set theme colors
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
			
			console.log('AlphaTab API initialized successfully');
			this._api = api;
		} catch (error) {
			console.error("Failed to initialize TabView:", error);
		}
	}

	onunload(): void {
		// 清理 AlphaTab API
		if (this._api) {
			this._api.destroy();
		}

		// 清理注入的样式
		if (this._styles && this._styles.parentNode) {
			this._styles.parentNode.removeChild(this._styles);
		}

		// 清理注入的字体（可选，因为其他实例可能还在使用）
		// const fontElement = document.getElementById('alphatab-bravura-font');
		// if (fontElement) {
		//     fontElement.remove();
		// }
	}

	private isResourcesValid(): boolean {
		return !!(
			this.resources &&
			this.resources.alphaTabWorkerUri &&
			this.resources.bravuraUri &&
			this.resources.soundFontData
		);
	}

	/**
	 * 等待字体变为可用状态
	 * @param fontFamily 字体族名称
	 * @param timeout 超时时间（毫秒）
	 */
	private async waitForFontAvailable(fontFamily: string, timeout = 3000): Promise<void> {
		return new Promise((resolve) => {
			const startTime = Date.now();
			
			const checkFont = () => {
				// 创建一个测试元素来检查字体是否已加载
				const testElement = document.createElement('div');
				testElement.style.fontFamily = `"${fontFamily}", monospace`;
				testElement.style.fontSize = '12px';
				testElement.style.position = 'absolute';
				testElement.style.left = '-9999px';
				testElement.textContent = 'Test';
				document.body.appendChild(testElement);
				
				const computedStyle = window.getComputedStyle(testElement);
				const actualFontFamily = computedStyle.fontFamily;
				
				document.body.removeChild(testElement);
				
				// 检查是否使用了期望的字体
				if (actualFontFamily.includes(fontFamily)) {
					console.log(`Font "${fontFamily}" is available`);
					resolve();
					return;
				}
				
				// 超时检查
				if (Date.now() - startTime > timeout) {
					console.warn(`Font "${fontFamily}" not available after ${timeout}ms, proceeding anyway`);
					resolve();
					return;
				}
				
				// 继续等待
				setTimeout(checkFont, 50);
			};
			
			checkFont();
		});
	}

	private async injectFontToDom(): Promise<void> {
		// 手动注入 Bravura 字体到 DOM 中，确保 AlphaTab 可以访问
		console.log('Injecting Bravura font as "alphaTab" family...');
		
		if (!this.resources.bravuraUri) {
			console.warn('Bravura font URI not available');
			return;
		}

		console.log('Font URI:', this.resources.bravuraUri);
		
		// 验证 Blob URI 是否有效
		try {
			const response = await fetch(this.resources.bravuraUri);
			if (!response.ok) {
				throw new Error(`Font fetch failed: ${response.status}`);
			}
			console.log('Font blob URI is valid and accessible');
		} catch (error) {
			console.error('Font blob URI validation failed:', error);
			return;
		}

		const fontId = 'alphatab-bravura-font';
		// 检查是否已经注入过
		if (document.getElementById(fontId)) {
			console.log('Font already injected, reusing existing font');
			return;
		}

		const style = document.createElement('style');
		style.id = fontId;
		style.textContent = `
			@font-face {
				font-family: "alphaTab";
				src: url("${this.resources.bravuraUri}") format("woff2");
				font-display: swap;
				font-weight: normal;
				font-style: normal;
			}
		`;
		document.head.appendChild(style);
		
		// 使用更可靠的字体加载检测
		try {
			console.log('Loading font using Font Loading API...');
			const font = new FontFace('alphaTab', `url(${this.resources.bravuraUri})`);
			await font.load();
			console.log('Bravura font loaded successfully');
			
			// 等待字体变为可用状态
			await this.waitForFontAvailable('alphaTab');
			console.log('Font validation completed successfully');
		} catch (error) {
			console.warn('Font Loading API failed, using fallback method:', error);
			// 如果 Font Loading API 失败，使用较长的等待时间作为后备方案
			await new Promise(resolve => setTimeout(resolve, 1000));
			console.log('Fallback font loading completed');
		}
	}

	async onLoadFile(file: TFile): Promise<void> {
		// 等待 API 初始化完成
		let retries = 0;
		const maxRetries = 10;
		while (!this._api && retries < maxRetries) {
			console.log(`Waiting for AlphaTab API initialization... (${retries + 1}/${maxRetries})`);
			await new Promise(resolve => setTimeout(resolve, 100));
			retries++;
		}

		if (!this._api) {
			console.error("AlphaTab API not initialized after waiting");
			return;
		}

		if (!this.isResourcesValid()) {
			console.error("Plugin resources not properly loaded");
			return;
		}

		try {
			console.log("Loading soundfont and file...");
			this._api.loadSoundFont(
				new Uint8Array(this.resources.soundFontData)
			);

			const inputFile = await this.app.vault.readBinary(file);
			this._api.load(new Uint8Array(inputFile));
			console.log("File loaded successfully");
		} catch (error) {
			console.error("Failed to load file:", error);
		}
	}
}
