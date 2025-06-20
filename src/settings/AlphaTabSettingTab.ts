import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import AlphaTabPlugin from "../main";

export class AlphaTabSettingTab extends PluginSettingTab {
    plugin: AlphaTabPlugin;

    constructor(app: App, plugin: AlphaTabPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "AlphaTab 吉他谱插件设置" });

        // 资源文件管理区域
        containerEl.createEl("h3", { text: "资源文件管理" });
        
        // 显示资源文件状态
        const assetsStatus = this.plugin.checkRequiredAssets() 
            ? "✅ 已安装" 
            : "❌ 未安装或不完整";
            
        new Setting(containerEl)
            .setName("必要资源文件")
            .setDesc(`状态: ${assetsStatus}`)
            .addButton(button => button
                .setButtonText(this.plugin.checkRequiredAssets() ? "重新下载" : "下载资源文件")
                .setCta()
                .onClick(async () => {
                    button.setButtonText("正在下载...")
                        .setDisabled(true);
                        
                    const success = await this.plugin.downloadAssets();
                    
                    if (success) {
                        this.plugin.settings.assetsDownloaded = true;
                        this.plugin.settings.lastAssetsCheck = Date.now();
                        await this.plugin.saveSettings();
                        new Notice("AlphaTab 资源文件已下载完成，请重新启动 Obsidian 以应用更改", 5000);
                    } else {
                        new Notice("AlphaTab 资源文件下载失败，请检查网络连接后重试", 5000);
                    }
                    
                    this.display(); // 重新渲染设置页面以更新状态
                })
            );
            
        // 添加资源文件说明
        containerEl.createEl("div", {
            text: "说明：AlphaTab 插件需要以下关键资产文件才能正常工作：",
            cls: "setting-item-description"
        });
        
        const assetsList = containerEl.createEl("ul", { cls: "setting-item-description" });
        [
            "alphaTab.worker.mjs - 用于提高性能的 Worker 文件",
            "alphatab.js - AlphaTab 核心库文件",
            "sonivox.sf2 - 音色库文件，用于播放吉他谱",
            "Bravura 字体文件 - 用于显示乐谱符号"
        ].forEach(item => {
            assetsList.createEl("li", { text: item });
        });
        
        containerEl.createEl("div", {
            text: "这些文件总大小约为几MB，将保存在插件目录下。",
            cls: "setting-item-description"
        });
        
        // 添加功能设置
        containerEl.createEl("h3", { text: "功能设置" });
        
        // 这里可以添加其他功能设置项...
        new Setting(containerEl)
            .setName("示例设置")
            .setDesc("这是一个示例设置项")
            .addText(text => text
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    this.plugin.settings.mySetting = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}
