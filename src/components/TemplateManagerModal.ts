import { Modal, App, Notice, ButtonComponent } from "obsidian";
import AlphaTabPlugin from "../main";

export interface TemplateItem {
    id: string;
    name: string;
    content: string;
}

export class TemplateManagerModal extends Modal {
    plugin: AlphaTabPlugin;
    onInsert: (content: string) => void;
    templates: TemplateItem[] = [];
    selectedIndex: number = -1;

    constructor(app: App, plugin: AlphaTabPlugin, onInsert: (content: string) => void) {
        super(app);
        this.plugin = plugin;
        this.onInsert = onInsert;
    }

    async onOpen() {
        this.templates = (await this.plugin.loadData())?.templates || [];
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "模板管理" });

        // 新建模板按钮
        const addBtn = contentEl.createEl("button", { text: "新建模板", cls: "mod-cta" });
        addBtn.onclick = () => this.openAddTemplateForm();

        if (this.templates.length === 0) {
            contentEl.createEl("div", { text: "暂无模板。" });
            return;
        }

        const list = contentEl.createEl("div", { cls: "template-list" });
        this.templates.forEach((tpl, idx) => {
            const item = list.createEl("div", { cls: "template-item" });
            item.createEl("span", { text: tpl.name, cls: "template-name" });
            const previewBtn = new ButtonComponent(item)
                .setButtonText("预览")
                .onClick(() => this.previewTemplate(idx));
            const insertBtn = new ButtonComponent(item)
                .setButtonText("插入")
                .onClick(() => this.insertTemplate(idx));
            if (this.selectedIndex === idx) {
                item.addClass("is-selected");
            }
            item.addEventListener("click", () => {
                this.selectedIndex = idx;
                this.display();
            });
        });

        // 预览区
        if (this.selectedIndex >= 0) {
            const preview = contentEl.createEl("pre", { cls: "template-preview" });
            preview.setText(this.templates[this.selectedIndex].content);
        }
    }

    openAddTemplateForm() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "新建模板" });
        const form = contentEl.createEl("form");
        form.addClass("template-form");
        form.onsubmit = (e) => { e.preventDefault(); };

        form.createEl("label", { text: "模板名称" });
        const nameInput = form.createEl("input", { type: "text", attr: { required: "true" } });
        nameInput.addClass("template-name-input");

        form.createEl("label", { text: "模板内容" });
        const contentInput = form.createEl("textarea");
        contentInput.addClass("template-content-input");
        contentInput.rows = 6;

        const btnRow = form.createDiv({ cls: "template-form-btns" });
        const saveBtn = btnRow.createEl("button", { text: "保存", type: "submit", cls: "mod-cta" });
        const cancelBtn = btnRow.createEl("button", { text: "取消", type: "button" });
        cancelBtn.onclick = () => this.display();

        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const content = contentInput.value;
            if (!name) {
                new Notice("模板名称不能为空");
                return;
            }
            if (this.templates.find(t => t.name === name)) {
                new Notice("模板名称已存在");
                return;
            }
            const id = Date.now().toString();
            this.templates.push({ id, name, content });
            await this.plugin.saveData({ templates: this.templates });
            new Notice("模板已保存");
            this.selectedIndex = this.templates.length - 1;
            this.display();
        };
    }

    previewTemplate(idx: number) {
        this.selectedIndex = idx;
        this.display();
    }

    insertTemplate(idx: number) {
        const tpl = this.templates[idx];
        if (tpl) {
            this.onInsert(tpl.content);
            this.close();
            new Notice(`已插入模板：${tpl.name}`);
        }
    }
}
