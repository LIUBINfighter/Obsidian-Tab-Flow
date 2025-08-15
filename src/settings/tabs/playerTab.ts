import { App, Notice, Setting } from "obsidian";
import TabFlowPlugin from "../../main";
import { DEFAULT_SETTINGS, PlayBarComponentVisibility } from "../defaults";

export async function renderPlayerTab(
  tabContents: HTMLElement,
  plugin: TabFlowPlugin,
  app: App
): Promise<void> {
  tabContents.createEl("h4", { text: "可视化编辑（拖拽排序 + 开关）" });

  new Setting(tabContents)
    .setName("恢复默认")
    .setDesc("重置播放栏组件的显示开关与顺序为默认配置")
    .addButton((btn) => {
      btn.setButtonText("恢复默认").onClick(async () => {
        try {
          plugin.settings.playBar = {
            components: JSON.parse(
              JSON.stringify(DEFAULT_SETTINGS.playBar?.components || {})
            ),
            order: (DEFAULT_SETTINGS.playBar?.order || []).slice(),
          };
          await plugin.saveSettings();
          try {
            /* @ts-ignore */ app.workspace.trigger("tabflow:playbar-components-changed");
          } catch {}
          new Notice("已恢复默认设置");
        } catch (e) {
          new Notice("恢复默认失败: " + e);
        }
      });
    });

  const cardsWrap = tabContents.createDiv({
    attr: { style: "display:flex; flex-direction:column; gap:8px;" },
  });
  const meta: Array<{
    key: keyof PlayBarComponentVisibility | "audioPlayer";
    label: string;
    icon: string;
    desc?: string;
    disabled?: boolean;
  }> = [
    { key: "playPause", label: "播放/暂停", icon: "play" },
    { key: "stop", label: "停止", icon: "square" },
    { key: "metronome", label: "节拍器", icon: "lucide-music-2" },
    { key: "countIn", label: "预备拍", icon: "lucide-timer" },
    { key: "tracks", label: "选择音轨", icon: "lucide-layers" },
    { key: "refresh", label: "刷新/重建播放器", icon: "lucide-refresh-ccw" },
    { key: "locateCursor", label: "滚动到光标", icon: "lucide-crosshair" },
    { key: "layoutToggle", label: "布局切换", icon: "lucide-layout" },
    { key: "exportMenu", label: "导出菜单", icon: "lucide-download" },
    { key: "toTop", label: "回到顶部", icon: "lucide-chevrons-up" },
    { key: "toBottom", label: "回到底部", icon: "lucide-chevrons-down" },
    { key: "openSettings", label: "打开设置", icon: "settings" },
    { key: "progressBar", label: "进度条", icon: "lucide-line-chart" },
    { key: "speed", label: "速度选择", icon: "lucide-gauge" },
    { key: "staveProfile", label: "谱表选择", icon: "lucide-list-music" },
    { key: "zoom", label: "缩放选择", icon: "lucide-zoom-in" },
    {
      key: "audioPlayer",
      label: "原生音频播放器（实验性）",
      icon: "audio-file",
      disabled: true,
      desc: "暂不可用，存在与 AlphaTab 播放器冲突风险",
    },
  ];

  const getOrder = (): string[] => {
    const def = [
      "playPause",
      "stop",
      "metronome",
      "countIn",
      "tracks",
      "refresh",
      "locateCursor",
      "layoutToggle",
      "exportMenu",
      "toTop",
      "toBottom",
      "openSettings",
      "progressBar",
      "speed",
      "staveProfile",
      "zoom",
      "audioPlayer",
    ];
    const saved = plugin.settings.playBar?.order;
    return Array.isArray(saved) && saved.length ? saved.slice() : def.slice();
  };

  let draggingKey: string | null = null;
  const clearDndHighlights = () => {
    const cards = cardsWrap.querySelectorAll(".tabflow-card");
    cards.forEach((el) => {
      el.classList.remove("insert-before", "insert-after", "swap-target");
      (el as HTMLElement).style.background = "";
    });
  };

  const renderCards = () => {
    cardsWrap.empty();
    const order = getOrder().filter((k) => meta.some((m) => m.key === (k as any)));
    const comp = plugin.settings.playBar?.components || ({} as any);
    order.forEach((key) => {
      const m = meta.find((x) => x.key === (key as any));
      if (!m) return;
      const card = cardsWrap.createDiv({
        cls: "tabflow-card",
        attr: {
          draggable: "true",
          style: "display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid var(--background-modifier-border); border-radius:6px;",
        },
      });
      card.dataset.key = String(key);
      const left = card.createDiv({ attr: { style: "display:flex; align-items:center; gap:8px;" } });
      left.createSpan({ text: "⠿", attr: { style: "cursor:grab; user-select:none;" } });
      const iconEl = left.createSpan();
      // @ts-ignore Obsidian setIcon
      (require("obsidian") as any).setIcon(iconEl, m.icon);
      left.createEl("strong", { text: m.label });
      if (m.desc)
        left.createSpan({ text: ` - ${m.desc}`, attr: { style: "color:var(--text-muted);font-size:0.9em;" } });

      const right = card.createDiv({ attr: { style: "display:flex; align-items:center; gap:6px;" } });
      const upIcon = right.createSpan({ cls: "icon-clickable", attr: { "aria-label": "上移", role: "button", tabindex: "0" } });
      (require("obsidian") as any).setIcon(upIcon, "lucide-arrow-up");
      const downIcon = right.createSpan({ cls: "icon-clickable", attr: { "aria-label": "下移", role: "button", tabindex: "0" } });
      (require("obsidian") as any).setIcon(downIcon, "lucide-arrow-down");

      new Setting(right).addToggle((t) => {
        const current = !!(comp as any)[key];
        t.setValue(m.disabled ? false : current).onChange(async (v) => {
          plugin.settings.playBar = plugin.settings.playBar || { components: {} as any };
          (plugin.settings.playBar as any).components = plugin.settings.playBar?.components || {};
          (plugin.settings.playBar as any).components[key] = m.disabled ? false : v;
          await plugin.saveSettings();
          try {
            /* @ts-ignore */ app.workspace.trigger("tabflow:playbar-components-changed");
          } catch {}
        });
        if (m.disabled) (t as any).toggleEl.querySelector("input")?.setAttribute("disabled", "true");
      });

      const getScrollContainer = (el: HTMLElement): HTMLElement | Window => {
        let node: HTMLElement | null = el.parentElement;
        while (node) {
          const hasScrollableSpace = node.scrollHeight > node.clientHeight + 1;
          const style = getComputedStyle(node);
          const overflowY = style.overflowY;
          if (hasScrollableSpace && (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")) {
            return node;
          }
          node = node.parentElement;
        }
        return window;
      };

      const keepPointerOverRow = async (rowKey: string, update: () => Promise<void> | void) => {
        const oldRect = card.getBoundingClientRect();
        const scrollContainer = getScrollContainer(card);
        await Promise.resolve(update());
        const newCard = cardsWrap.querySelector(`.tabflow-card[data-key="${rowKey}"]`) as HTMLElement | null;
        if (!newCard) return;
        const newRect = newCard.getBoundingClientRect();
        const delta = newRect.top - oldRect.top;
        if (delta !== 0) {
          if (scrollContainer === window) {
            window.scrollBy(0, delta);
          } else {
            (scrollContainer as HTMLElement).scrollTop += delta;
          }
        }
      };

      const moveUp = async () => {
        const cur = getOrder();
        const i = cur.indexOf(String(key));
        if (i > 0) {
          await keepPointerOverRow(String(key), async () => {
            [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]];
            plugin.settings.playBar = plugin.settings.playBar || { components: {} as any };
            (plugin.settings.playBar as any).order = cur;
            await plugin.saveSettings();
            renderCards();
          });
          try {
            /* @ts-ignore */ app.workspace.trigger("tabflow:playbar-components-changed");
          } catch {}
        }
      };

      const moveDown = async () => {
        const cur = getOrder();
        const i = cur.indexOf(String(key));
        if (i >= 0 && i < cur.length - 1) {
          await keepPointerOverRow(String(key), async () => {
            [cur[i + 1], cur[i]] = [cur[i], cur[i + 1]];
            plugin.settings.playBar = plugin.settings.playBar || { components: {} as any };
            (plugin.settings.playBar as any).order = cur;
            await plugin.saveSettings();
            renderCards();
          });
          try {
            /* @ts-ignore */ app.workspace.trigger("tabflow:playbar-components-changed");
          } catch {}
        }
      };

      upIcon.addEventListener("click", () => moveUp());
      upIcon.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          moveUp();
        }
      });
      downIcon.addEventListener("click", () => moveDown());
      downIcon.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          moveDown();
        }
      });

      card.addEventListener("dragstart", (e) => {
        draggingKey = String(key);
        (e.dataTransfer as DataTransfer).effectAllowed = "move";
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        (e.dataTransfer as DataTransfer).dropEffect = "move";
        clearDndHighlights();
        const rect = card.getBoundingClientRect();
        const offsetY = (e as DragEvent).clientY - rect.top;
        const ratio = offsetY / rect.height;
        if (ratio < 0.33) {
          card.classList.add("insert-before");
        } else if (ratio > 0.66) {
          card.classList.add("insert-after");
        } else {
          card.classList.add("swap-target");
        }
      });
      card.addEventListener("dragleave", () => clearDndHighlights());
      card.addEventListener("dragend", () => clearDndHighlights());
      card.addEventListener("drop", async () => {
        const isInsertBefore = card.classList.contains("insert-before");
        const isInsertAfter = card.classList.contains("insert-after");
        const isSwap = card.classList.contains("swap-target");
        clearDndHighlights();
        if (!draggingKey || draggingKey === key) return;
        const list = getOrder();
        const from = list.indexOf(String(draggingKey));
        const to = list.indexOf(String(key));
        if (from < 0 || to < 0) return;
        const cur = list.slice();
        if (isSwap) {
          [cur[from], cur[to]] = [cur[to], cur[from]];
        } else {
          let insertIndex = to + (isInsertAfter ? 1 : 0);
          const [moved] = cur.splice(from, 1);
          if (from < insertIndex) insertIndex -= 1;
          cur.splice(insertIndex, 0, moved);
        }
        plugin.settings.playBar = plugin.settings.playBar || { components: {} as any };
        (plugin.settings.playBar as any).order = cur;
        await plugin.saveSettings();
        renderCards();
        try {
          /* @ts-ignore */ app.workspace.trigger("tabflow:playbar-components-changed");
        } catch {}
        draggingKey = null;
      });
    });
  };
  renderCards();

  // Debug Bar section
  tabContents.createEl("h3", { text: "Debug Bar" });
  tabContents.createEl("div", {
    text: "以下为开发者选项，用于显示/隐藏 Debug Bar（实验与诊断用途）",
    cls: "setting-item-description",
  });

  new Setting(tabContents)
    .setName("显示 Debug Bar（开发者选项）")
    .setDesc("启用后在视图顶部显示调试栏，用于实验功能和问题诊断。")
    .addToggle((toggle) => {
      toggle
        .setValue(plugin.settings.showDebugBar ?? false)
        .onChange(async (value) => {
          plugin.settings.showDebugBar = value;
          await plugin.saveSettings();
          try {
            // @ts-ignore
            app.workspace.trigger("tabflow:debugbar-toggle", value);
          } catch {}
          new Notice(value ? "已启用 Debug Bar" : "已隐藏 Debug Bar");
        });
    });
}
