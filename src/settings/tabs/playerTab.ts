import { App, Notice, Setting } from "obsidian";
import TabFlowPlugin from "../../main";
import { setIcon } from "obsidian";
import { DEFAULT_SETTINGS, PlayBarComponentVisibility } from "../defaults";
import { t } from "../../i18n";

export async function renderPlayerTab(
  tabContents: HTMLElement,
  plugin: TabFlowPlugin,
  app: App
): Promise<void> {
  tabContents.createEl("h4", { text: t("settings.player.visualEditorTitle") });

  new Setting(tabContents)
    .setName(t("settings.player.resetToDefault"))
    .setDesc(t("settings.player.resetToDefaultDesc"))
    .addButton((btn) => {
      btn.setButtonText(t("settings.player.resetToDefault")).onClick(async () => {
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
          new Notice(t("settings.player.resetToDefaultSuccess"));
        } catch (e) {
          new Notice(t("settings.player.resetToDefaultFailed") + ": " + e);
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
    { key: "playPause", label: t("settings.player.components.playPause"), icon: "play" },
    { key: "stop", label: t("settings.player.components.stop"), icon: "square" },
    { key: "metronome", label: t("settings.player.components.metronome"), icon: "lucide-music-2" },
    { key: "countIn", label: t("settings.player.components.countIn"), icon: "lucide-timer" },
    { key: "tracks", label: t("settings.player.components.tracks"), icon: "lucide-layers" },
    { key: "refresh", label: t("settings.player.components.refresh"), icon: "lucide-refresh-ccw" },
    { key: "locateCursor", label: t("settings.player.components.locateCursor"), icon: "lucide-crosshair" },
    { key: "layoutToggle", label: t("settings.player.components.layoutToggle"), icon: "lucide-layout" },
    { key: "exportMenu", label: t("settings.player.components.exportMenu"), icon: "lucide-download" },
    { key: "toTop", label: t("settings.player.components.toTop"), icon: "lucide-chevrons-up" },
    { key: "toBottom", label: t("settings.player.components.toBottom"), icon: "lucide-chevrons-down" },
    { key: "openSettings", label: t("settings.player.components.openSettings"), icon: "settings" },
    { key: "progressBar", label: t("settings.player.components.progressBar"), icon: "lucide-line-chart" },
    { key: "speed", label: t("settings.player.components.speed"), icon: "lucide-gauge" },
    { key: "staveProfile", label: t("settings.player.components.staveProfile"), icon: "lucide-list-music" },
    { key: "zoom", label: t("settings.player.components.zoom"), icon: "lucide-zoom-in" },
    {
      key: "audioPlayer",
      label: t("settings.player.components.audioPlayer"),
      icon: "audio-file",
      disabled: true,
      desc: t("settings.player.components.audioPlayerDesc"),
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
      const iconEl = left.createSpan(); // Create the span element
      setIcon(iconEl, m.icon); // Use the imported setIcon function
      left.createEl("strong", { text: m.label });
      if (m.desc)
        left.createSpan({ text: ` - ${m.desc}`, attr: { style: "color:var(--text-muted);font-size:0.9em;" } });

      const right = card.createDiv({ attr: { style: "display:flex; align-items:center; gap:6px;" } });
      const upIcon = right.createSpan({ cls: "icon-clickable", attr: { "aria-label": t("settings.player.moveUp"), role: "button", tabindex: "0" } });
      setIcon(upIcon, "lucide-arrow-up");
      const downIcon = right.createSpan({ cls: "icon-clickable", attr: { "aria-label": t("settings.player.moveDown"), role: "button", tabindex: "0" } });
      setIcon(downIcon, "lucide-arrow-down");

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
  tabContents.createEl("h3", { text: t("settings.player.debugBar.title") });
  tabContents.createEl("div", {
    text: t("settings.player.debugBar.description"),
    cls: "setting-item-description",
  });

  new Setting(tabContents)
    .setName(t("settings.player.debugBar.showDebugBar"))
    .setDesc(t("settings.player.debugBar.showDebugBarDesc"))
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
          new Notice(value ? t("settings.player.debugBar.debugBarEnabled") : t("settings.player.debugBar.debugBarDisabled"));
        });
    });
}
