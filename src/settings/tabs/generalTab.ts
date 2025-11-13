import { App, Notice, Setting } from 'obsidian';
import TabFlowPlugin from '../../main';
import { ASSET_FILES } from '../../services/ResourceLoaderService';
import { vaultPath } from '../../utils';
import { AssetStatus } from '../../types/assets';
import { t } from '../../i18n';
import path from 'path';
// @ts-ignore
import { shell } from 'electron';

async function collectAssetStatuses(app: App, plugin: TabFlowPlugin): Promise<AssetStatus[]> {
	const pluginId = plugin.manifest.id;
	const assetsDir = vaultPath(app.vault.configDir, 'plugins', pluginId, 'assets');
	const files = [ASSET_FILES.ALPHA_TAB, ASSET_FILES.BRAVURA, ASSET_FILES.SOUNDFONT];
	const dirExists = await app.vault.adapter.exists(assetsDir);
	if (!dirExists) {
		return files.map(
			(f) => ({ file: f, exists: false, path: vaultPath(assetsDir, f) }) as AssetStatus
		);
	}
	const statuses: AssetStatus[] = [];
	for (const f of files) {
		const p = vaultPath(assetsDir, f);
		const exists = await app.vault.adapter.exists(p);
		let size: number | undefined = undefined;
		if (exists) {
			try {
				const data = await app.vault.adapter.readBinary(p);
				size = data.byteLength;
			} catch {
				// Ignore file read errors
			}
		}
		statuses.push({ file: f, exists, path: p, size });
	}
	return statuses;
}

export async function renderGeneralTab(
	tabContents: HTMLElement,
	plugin: TabFlowPlugin,
	app: App,
	renderTab: (id: string) => Promise<void>
): Promise<void> {
	tabContents.createEl('h3', { text: t('assetManagement.assetFileManagement') });

	const assetsStatusContainer = tabContents.createDiv({
		cls: 'tabflow-setting-description',
		attr: {
			style: 'margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);',
		},
	});
	assetsStatusContainer.createEl('strong', { text: t('status.assetsCheckInProgress') });

	const statuses = await collectAssetStatuses(app, plugin);
	const descriptions: Record<string, string> = {
		[ASSET_FILES.ALPHA_TAB]: t('status.alphaTabMainScript'),
		[ASSET_FILES.BRAVURA]: t('status.musicFontFile'),
		[ASSET_FILES.SOUNDFONT]: t('status.soundFontFile'),
	};

	assetsStatusContainer.empty();
	const allOk = statuses.every((s) => s.exists);
	assetsStatusContainer.createEl('div', {
		text: allOk ? `✅ ${t('status.allAssetsInstalled')}` : `❌ ${t('status.assetsIncomplete')}`,
		attr: {
			style: `font-weight: bold; color: ${allOk ? 'var(--text-success)' : 'var(--text-error)'}; margin-bottom: 10px;`,
		},
	});

	const list = assetsStatusContainer.createEl('ul', {
		attr: { style: 'margin:0;padding-left:20px;' },
	});
	tabContents.createEl('div', {
		text: t('status.expectedFileStructure'),
		cls: 'tabflow-setting-description',
		attr: { style: 'margin-top:20px;font-weight:bold;' },
	});
	const pre = tabContents.createEl('pre', {
		cls: 'tabflow-setting-description',
	});
	pre.createEl('code', {
		text: `${app.vault.configDir}/tab-flow/\n├── main.js\n├── data.json(optional)\n├── manifest.json\n├── styles.css\n└── assets/\n    ├── ${ASSET_FILES.ALPHA_TAB}\n    ├── ${ASSET_FILES.BRAVURA}\n    └── ${ASSET_FILES.SOUNDFONT}`,
	});
	statuses.forEach((s) => {
		const li = list.createEl('li');
		const color = s.exists ? 'var(--text-success)' : 'var(--text-error)';
		const icon = s.exists ? '✅' : '❌';
		const sizeText = s.size != null ? ` - ${(s.size / 1024).toFixed(1)} KB` : '';

		// 创建第一个span元素（文件名和图标）
		const fileSpan = document.createElement('span');
		fileSpan.style.color = color;
		fileSpan.textContent = `${icon} ${s.file}`;
		li.appendChild(fileSpan);

		// 添加分隔符
		li.appendChild(
			document.createTextNode(
				` - ${descriptions[s.file] || t('assetManagement.assetFileManagement')} `
			)
		);

		// 创建第二个span元素（状态）
		const statusSpan = document.createElement('span');
		statusSpan.style.color = color;
		statusSpan.style.fontStyle = 'italic';
		statusSpan.textContent = `(${s.exists ? t('status.installed') : t('status.notInstalled')})`;
		li.appendChild(statusSpan);

		// 添加文件大小信息
		if (sizeText) {
			li.appendChild(document.createTextNode(sizeText));
		}
	});

	const actionSetting = new Setting(tabContents)
		.setName(
			allOk
				? t('assetManagement.redownloadAssets')
				: t('assetManagement.downloadMissingAssets')
		)
		.setDesc(
			allOk ? t('assetManagement.ifSuspectCorruption') : t('assetManagement.restartRequired')
		);
	const buttons = actionSetting.controlEl.createDiv({ attr: { style: 'display:flex;gap:8px;' } });

	const downloadBtn = buttons.createEl('button', {
		text: allOk ? t('assetManagement.redownload') : t('assetManagement.downloadMissingAssets'),
		cls: 'mod-cta',
	});
	const restartBtn = buttons.createEl('button', {
		text: t('assetManagement.restartObsidian'),
		cls: 'mod-warning',
		attr: { style: plugin.settings.assetsDownloaded ? '' : 'display:none;' },
	});

	downloadBtn.onclick = async () => {
		downloadBtn.disabled = true;
		downloadBtn.textContent = t('assetManagement.downloading');
		const ok = await plugin.downloadAssets?.();
		if (ok) {
			new Notice(t('assetManagement.assetsDownloaded'));
			restartBtn.style.display = 'inline-block';
			await renderTab('general');
		} else {
			downloadBtn.disabled = false;
			downloadBtn.textContent = allOk
				? t('assetManagement.redownload')
				: t('assetManagement.retryDownload');
		}
	};

	const openDirBtn = buttons.createEl('button', {
		text: t('assetManagement.openPluginRootDir'),
		cls: 'mod-info',
	});
	openDirBtn.onclick = () => {
		try {
			interface VaultAdapterWithBasePath {
				getBasePath?: () => string;
			}
			const basePath = (app.vault.adapter as unknown as VaultAdapterWithBasePath).getBasePath?.();
			if (!basePath) {
				new Notice(t('assetManagement.desktopOnly'));
				return;
			}
			// TO FIX: Obsidian的配置目录不是固定的，应该使用 Vault#configDir
			// 原因: 用户可以配置配置目录的位置，不能假设是 .obsidian
			const pluginDir = path.join(
				basePath,
				app.vault.configDir,
				'plugins',
				plugin.manifest.id
			);
			const mainJsPath = path.join(pluginDir, 'main.js');
			// @ts-ignore
			shell.showItemInFolder(mainJsPath);
		} catch (e) {
			new Notice(t('assetManagement.openDirFailed') + e);
		}
	};

	restartBtn.onclick = () => {
		if (confirm(t('assetManagement.confirmRestart'))) {
			// @ts-ignore
			app.commands.executeCommandById('app:reload');
		}
	};
}
