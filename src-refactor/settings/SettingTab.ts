import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "../main";

export interface TabFlowSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: "default",
};

export class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// 顶部标签页样式
		const tabs = containerEl.createDiv({ cls: "itabs-settings-tabs" });
		const tabContents = containerEl.createDiv({ cls: "itabs-settings-contents" });

		const tabList = [
			{ id: "general", name: "常规" },
			{ id: "about", name: "关于" }
		];

		let activeTab = "general";

		const renderTab = (tabId: string) => {
			tabContents.empty();
			if (tabId === "general") {
				new Setting(tabContents)
					.setName("示例设置")
					.setDesc("这是一个示例设置项。")
					.addText(text =>
						text
							.setPlaceholder("输入内容")
							.setValue(this.plugin.settings.mySetting)
							.onChange(async (value) => {
								this.plugin.settings.mySetting = value;
								await this.plugin.saveSettings();
							})
					);
			} else if (tabId === "about") {
				tabContents.createEl("h3", { text: "关于" });
				tabContents.createEl("p", { text: "AlphaTab 插件 by YourName." });
			}
		};

		tabList.forEach(tab => {
			const tabEl = tabs.createEl("button", {
				text: tab.name,
				cls: ["itabs-settings-tab", tab.id === activeTab ? "active" : ""]
			});
			tabEl.onclick = () => {
				tabs.querySelectorAll("button").forEach(btn => btn.removeClass("active"));
				tabEl.addClass("active");
				activeTab = tab.id;
				renderTab(tab.id);
			};
		});

		renderTab(activeTab);
	}
}

// 可选：简单的样式，可放到你的样式文件中
/*
.itabs-settings-tabs {
	display: flex;
	border-bottom: 1px solid var(--background-modifier-border);
	margin-bottom: 1em;
}
.itabs-settings-tab {
	background: none;
	border: none;
	padding: 0.5em 1.5em;
	cursor: pointer;
	font-size: 1em;
}
.itabs-settings-tab.active {
	border-bottom: 2px solid var(--interactive-accent);
	font-weight: bold;
}
.itabs-settings-contents {
	padding: 1em 0;
}
*/
