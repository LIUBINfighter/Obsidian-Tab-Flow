// 文档面板：Stylesheet（样式表相关）
import type TabFlowPlugin from "../../../main";
import { createAlphaTexPlayground } from "../../../components/AlphaTexPlayground";

const SAMPLE_SHOW_HIDE_DYNAMICS = `\\showDynamics
.
C4 D4 E4 F4`;

const SAMPLE_HIDE_DYNAMICS = `\\hideDynamics
.
C4 D4 E4 F4`;

const SAMPLE_SYSTEM_SIGN = `\\useSystemSignSeparator
\\defaultSystemsLayout 2
.
\\track "T1"
:1 C4 | C4 | C4
\\track "T2"
:1 C4 | C4 | C4`;

const SAMPLE_SHOW_TUNING = `\\track \\staff \\tuning E4 B3 G3 D3 A2 E2
    3.3.1
\\track \\staff \\tuning D4 A3 F3 C3 G2 D2 
    3.3.1`;

const SAMPLE_HIDE_TUNING = `\\track \\staff \\tuning E4 B3 G3 D3 A2 E2 hide
    3.3.1
\\track \\staff \\tuning D4 A3 F3 C3 G2 D2 
    3.3.1`;

const SAMPLE_TRACK_NAMES = `\\singletracktracknamepolicy AllSystems
\\firstsystemtracknamemode fullname
\\othersystemstracknamemode shortname
\\firstsystemtracknameorientation horizontal
\\othersystemstracknameorientation vertical
.
\\track "Piano 1" "pno1" { defaultsystemslayout 3 }
    \\staff {score}
    C4 D4 E4 F4 | C4 D4 E4 F4 | C4 D4 E4 F4 | C4 D4 E4 F4 | C4 D4 E4 F4 |`;

export default {
	id: "stylesheet",
	title: "Stylesheet 样式表",
	render(container: HTMLElement, plugin?: TabFlowPlugin) {
		container.empty();
		container.createEl("h3", { text: "Stylesheet（样式表）" });
		container.createEl("p", {
			text: "以下示例演示显示/隐藏力度标记、系统分隔符与调弦显示控制、轨名策略等。",
		});

		container.createEl("h4", { text: "显示/隐藏力度（Dynamics）" });
		if (plugin) {
			const host1 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host1, SAMPLE_SHOW_HIDE_DYNAMICS, {
				layout: "horizontal",
			});
			const host2 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host2, SAMPLE_HIDE_DYNAMICS, {
				layout: "horizontal",
			});
		}

		container.createEl("h4", {
			text: "系统分隔符（System Sign Separator）",
		});
		if (plugin) {
			const host3 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host3, SAMPLE_SYSTEM_SIGN, {
				layout: "horizontal",
			});
		}

		container.createEl("h4", {
			text: "每轨显示调弦（Show Tuning per Track）",
		});
		if (plugin) {
			const host4 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host4, SAMPLE_SHOW_TUNING, {
				layout: "horizontal",
			});
			const host5 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host5, SAMPLE_HIDE_TUNING, {
				layout: "horizontal",
			});
		}

		container.createEl("h4", { text: "轨名显示策略（Track Names）" });
		if (plugin) {
			const host6 = container.createDiv({ cls: "doc-playground-host" });
			createAlphaTexPlayground(plugin, host6, SAMPLE_TRACK_NAMES, {
				layout: "horizontal",
			});
		}

		if (!plugin) {
			container.createEl("div", {
				text: "缺少 plugin 上下文，无法渲染示例。",
			});
		}
	},
};
