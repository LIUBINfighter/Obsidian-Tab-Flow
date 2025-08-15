import { App, Notice, Setting } from "obsidian";
import TabFlowPlugin from "../../main";

export async function renderAboutTab(
  tabContents: HTMLElement,
  plugin: TabFlowPlugin,
  app: App
): Promise<void> {
  tabContents.createEl("h3", { text: "关于" });
  tabContents.createEl("p", {
    text: "Tab Flow by Jay Bridge",
  });

  // 快速打开 AlphaTex 文档视图按钮
  new Setting(tabContents)
    .setName("AlphaTex 文档")
    .setDesc("打开 AlphaTex 快速文档视图，包含语法速查与示例。")
    .addButton((btn) => {
      btn.setButtonText("打开文档").onClick(async () => {
        try {
          new Notice("尝试打开 AlphaTex 文档视图...");
          // 优先通过已注册的命令触发
          try {
            const execFn = (app as any).commands && (app as any).commands.executeCommandById;
            if (typeof execFn === "function") {
              const res = execFn.call((app as any).commands, "open-tabflow-doc-view");
              if (!res) {
                const leaf = app.workspace.getLeaf(true);
                await leaf.setViewState({ type: "tabflow-doc-view", active: true });
                app.workspace.revealLeaf(leaf);
              }
            } else {
              const leaf = app.workspace.getLeaf(true);
              await leaf.setViewState({ type: "tabflow-doc-view", active: true });
              app.workspace.revealLeaf(leaf);
            }
          } catch (innerErr) {
            console.error("[SettingTab.about] executeCommandById error", innerErr);
            const leaf = app.workspace.getLeaf(true);
            await leaf.setViewState({ type: "tabflow-doc-view", active: true });
            app.workspace.revealLeaf(leaf);
          }

          // 尝试关闭设置面板以便文档视图可见
          try {
            if ((app as any).setting && typeof (app as any).setting.close === "function") {
              (app as any).setting.close();
            } else if ((app as any).workspace && typeof (app as any).workspace.detachLeavesOfType === "function") {
              (app as any).workspace.detachLeavesOfType("settings");
            }
          } catch (closeErr) {
            console.warn("[SettingTab.about] failed to close settings view", closeErr);
          }
        } catch (e) {
          console.error("[SettingTab] Open AlphaTex doc failed", e);
          new Notice("打开文档失败，请查看控制台日志");
        }
      });
    });
}
