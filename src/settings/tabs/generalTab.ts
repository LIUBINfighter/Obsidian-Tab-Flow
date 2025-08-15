import { App, Notice, Setting } from "obsidian";
import TabFlowPlugin from "../../main";
import { ASSET_FILES } from "../../services/ResourceLoaderService";
import { vaultPath } from "../../utils";
import { AssetStatus } from "../../types/assets";

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
  tabContents.createEl("h3", { text: "资源文件管理" });

  const assetsStatusContainer = tabContents.createDiv({
    cls: "setting-item-description",
    attr: { style: "margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);" },
  });
  assetsStatusContainer.createEl("strong", { text: "资产文件状态检查中..." });

  const statuses = await collectAssetStatuses(app, plugin);
  const descriptions: Record<string, string> = {
    [ASSET_FILES.ALPHA_TAB]: "AlphaTab 主脚本",
    [ASSET_FILES.BRAVURA]: "乐谱字体文件",
    [ASSET_FILES.SOUNDFONT]: "音色库文件",
  };

  assetsStatusContainer.empty();
  const allOk = statuses.every((s) => s.exists);
  assetsStatusContainer.createEl("div", {
    text: allOk ? "✅ 所有资产文件已安装" : "❌ 资产文件不完整",
    attr: { style: `font-weight: bold; color: ${allOk ? "var(--text-success)" : "var(--text-error)"}; margin-bottom: 10px;` },
  });

  const list = assetsStatusContainer.createEl("ul", { attr: { style: "margin:0;padding-left:20px;" } });
  statuses.forEach((s) => {
    const li = list.createEl("li");
    const color = s.exists ? "var(--text-success)" : "var(--text-error)";
    const icon = s.exists ? "✅" : "❌";
    const sizeText = s.size != null ? ` - ${(s.size / 1024).toFixed(1)} KB` : "";
    li.innerHTML = `<span style="color:${color}">${icon} ${s.file}</span> - ${descriptions[s.file] || "资源文件"} <span style="color:${color};font-style:italic;">(${s.exists ? "已安装" : "未安装"})</span>${sizeText}`;
  });

  const actionSetting = new Setting(tabContents)
    .setName(allOk ? "重新下载资产文件" : "下载缺失的资产文件")
    .setDesc(allOk ? "如怀疑文件损坏，可重新下载" : "下载后需重启 Obsidian");
  const buttons = actionSetting.controlEl.createDiv({ attr: { style: "display:flex;gap:8px;" } });

  const downloadBtn = buttons.createEl("button", { text: allOk ? "重新下载" : "下载资源文件", cls: "mod-cta" });
  const restartBtn = buttons.createEl("button", { text: "重启 Obsidian", cls: "mod-warning", attr: { style: plugin.settings.assetsDownloaded ? "" : "display:none;" } });

  downloadBtn.onclick = async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "正在下载...";
    const ok = await plugin.downloadAssets?.();
    if (ok) {
      new Notice("资源文件已下载，必要时请重启 Obsidian 应用");
      restartBtn.style.display = "inline-block";
      await renderTab("general");
    } else {
      downloadBtn.disabled = false;
      downloadBtn.textContent = allOk ? "重新下载" : "重试下载";
    }
  };

  const openDirBtn = buttons.createEl("button", { text: "打开插件根目录", cls: "mod-info" });
  openDirBtn.onclick = () => {
    try {
      const basePath = (app.vault.adapter as any).getBasePath?.();
      if (!basePath) {
        new Notice("仅支持桌面端 Obsidian");
        return;
      }
      const pluginDir = require("path").join(basePath, ".obsidian", "plugins", plugin.manifest.id);
      const mainJsPath = require("path").join(pluginDir, "main.js");
      // @ts-ignore
      const { shell } = require("electron");
      shell.showItemInFolder(mainJsPath);
    } catch (e) {
      new Notice("打开目录失败: " + e);
    }
  };

  restartBtn.onclick = () => {
    if (confirm("确定要重启 Obsidian 吗？请确认已保存全部内容。")) {
      // @ts-ignore
      app.commands.executeCommandById("app:reload");
    }
  };
}
