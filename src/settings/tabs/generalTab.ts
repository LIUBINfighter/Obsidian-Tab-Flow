import { App, Notice, Setting } from "obsidian";
import TabFlowPlugin from "../../main";
import { ASSET_FILES } from "../../services/ResourceLoaderService";
import { vaultPath } from "../../utils";
import { AssetStatus } from "../../types/assets";
import { t } from "../../i18n";

async function collectAssetStatuses(app: App, plugin: TabFlowPlugin): Promise<AssetStatus[]> {
  const pluginId = plugin.manifest.id;
  const assetsDir = vaultPath(".obsidian", "plugins", pluginId, "assets");
  const files = [ASSET_FILES.ALPHA_TAB, ASSET_FILES.BRAVURA, ASSET_FILES.SOUNDFONT];
  const dirExists = await app.vault.adapter.exists(assetsDir);
  if (!dirExists) {
    return files.map((f) => ({ file: f, exists: false, path: vaultPath(assetsDir, f) } as AssetStatus));
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
      } catch {}
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
  tabContents.createEl("h3", { text: t("assetManagement.assetFileManagement") });

  const assetsStatusContainer = tabContents.createDiv({
    cls: "setting-item-description",
    attr: { style: "margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);" },
  });
  assetsStatusContainer.createEl("strong", { text: t("status.assetsCheckInProgress") });

  const statuses = await collectAssetStatuses(app, plugin);
  const descriptions: Record<string, string> = {
    [ASSET_FILES.ALPHA_TAB]: t("status.alphaTabMainScript"),
    [ASSET_FILES.BRAVURA]: t("status.musicFontFile"),
    [ASSET_FILES.SOUNDFONT]: t("status.soundFontFile"),
  };

  assetsStatusContainer.empty();
  const allOk = statuses.every((s) => s.exists);
  assetsStatusContainer.createEl("div", {
    text: allOk ? `✅ ${t("status.allAssetsInstalled")}` : `❌ ${t("status.assetsIncomplete")}`,
    attr: { style: `font-weight: bold; color: ${allOk ? "var(--text-success)" : "var(--text-error)"}; margin-bottom: 10px;` },
  });

    const list = assetsStatusContainer.createEl("ul", { attr: { style: "margin:0;padding-left:20px;" } });
    tabContents.createEl("div", {
      text: t("status.expectedFileStructure"),
      cls: "setting-item-description",
      attr: { style: "margin-top:20px;font-weight:bold;" },
    });
    const pre = tabContents.createEl("pre", {
      cls: "setting-item-description",
    });
    pre.createEl("code", {
      text: `.obsidian/tab-flow/\n├── main.js\n├── data.json(optional)\n├── manifest.json\n├── styles.css\n└── assets/\n    ├── ${ASSET_FILES.ALPHA_TAB}\n    ├── ${ASSET_FILES.BRAVURA}\n    └── ${ASSET_FILES.SOUNDFONT}`,
    });
  statuses.forEach((s) => {
    const li = list.createEl("li");
    const color = s.exists ? "var(--text-success)" : "var(--text-error)";
    const icon = s.exists ? "✅" : "❌";
    const sizeText = s.size != null ? ` - ${(s.size / 1024).toFixed(1)} KB` : "";
    li.innerHTML = `<span style="color:${color}">${icon} ${s.file}</span> - ${descriptions[s.file] || t("assetManagement.assetFileManagement")} <span style="color:${color};font-style:italic;">(${s.exists ? t("status.installed") : t("status.notInstalled")})</span>${sizeText}`;
  });

  const actionSetting = new Setting(tabContents)
    .setName(allOk ? t("assetManagement.redownloadAssets") : t("assetManagement.downloadMissingAssets"))
    .setDesc(allOk ? t("assetManagement.ifSuspectCorruption") : t("assetManagement.restartRequired"));
  const buttons = actionSetting.controlEl.createDiv({ attr: { style: "display:flex;gap:8px;" } });

  const downloadBtn = buttons.createEl("button", { text: allOk ? t("assetManagement.redownload") : t("assetManagement.downloadMissingAssets"), cls: "mod-cta" });
  const restartBtn = buttons.createEl("button", { text: t("assetManagement.restartObsidian"), cls: "mod-warning", attr: { style: plugin.settings.assetsDownloaded ? "" : "display:none;" } });

  downloadBtn.onclick = async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = t("assetManagement.downloading");
    const ok = await plugin.downloadAssets?.();
    if (ok) {
      new Notice(t("assetManagement.assetsDownloaded"));
      restartBtn.style.display = "inline-block";
      await renderTab("general");
    } else {
      downloadBtn.disabled = false;
      downloadBtn.textContent = allOk ? t("assetManagement.redownload") : t("assetManagement.retryDownload");
    }
  };

  const openDirBtn = buttons.createEl("button", { text: t("assetManagement.openPluginRootDir"), cls: "mod-info" });
  openDirBtn.onclick = () => {
    try {
      const basePath = (app.vault.adapter as any).getBasePath?.();
      if (!basePath) {
        new Notice(t("assetManagement.desktopOnly"));
        return;
      }
      const pluginDir = require("path").join(basePath, ".obsidian", "plugins", plugin.manifest.id);
      const mainJsPath = require("path").join(pluginDir, "main.js");
      // @ts-ignore
      const { shell } = require("electron");
      shell.showItemInFolder(mainJsPath);
    } catch (e) {
      new Notice(t("assetManagement.openDirFailed") + e);
    }
  };

  restartBtn.onclick = () => {
    if (confirm(t("assetManagement.confirmRestart"))) {
      // @ts-ignore
      app.commands.executeCommandById("app:reload");
    }
  };
}
