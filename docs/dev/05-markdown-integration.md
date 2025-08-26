# Markdown 集成系统

## 相关代码文件
- `src/markdown/AlphaTexBlock.ts` - AlphaTex 代码块处理器
- `src/utils/alphatexParser.ts` - AlphaTex 解析工具
- `src/utils/index.ts` - 工具函数导出

## AlphaTex 代码块处理器

### 核心功能

`mountAlphaTexBlock` 函数负责在 Markdown 中渲染 AlphaTex 代码块：

#### 主要特性
- **语法解析**: 解析 AlphaTex 代码和初始化选项
- **主题适配**: 动态适配 Obsidian 主题颜色
- **错误处理**: 完善的错误报告和用户反馈
- **性能优化**: 懒加载和资源管理

### 代码块结构解析

```typescript
export function mountAlphaTexBlock(
  rootEl: HTMLElement,
  source: string,
  resources: AlphaTabResources,
  defaults?: AlphaTexInitOptions
): AlphaTexMountHandle {
  const { opts, body } = parseInlineInit(source);
  const merged: AlphaTexInitOptions = { ...(defaults || {}), ...(opts || {}) };
  
  // UI 覆盖配置提取
  const uiOverride = (opts as any)?.ui;
}
```

### 初始化选项接口

```typescript
export interface AlphaTexInitOptions {
  // 显示配置
  scale?: number;           // 0.5 - 2.0
  layoutMode?: number | string; // 布局模式
  
  // 播放配置
  speed?: number;           // 0.5 - 2.0
  metronome?: boolean;      // 节拍器开关
  scrollMode?: number | string; // 滚动模式
  player?: "enable" | "disable"; // 播放器开关
  
  // 轨道配置
  tracks?: number[];        // 要渲染的轨道
  
  // 回调函数
  onUpdateInit?: (partial: Partial<AlphaTexInitOptions>) => void;
  setUiOverride?: (override: { components?: Record<string, boolean>; order?: string[] | string } | null) => void;
  clearUiOverride?: () => void;
}
```

### DOM 结构创建

```typescript
// 容器结构
const wrapper = document.createElement("div");
wrapper.className = "alphatex-block";

const messagesEl = document.createElement("div");
messagesEl.className = "alphatex-messages";

const scoreEl = document.createElement("div");
scoreEl.className = "alphatex-score";

const controlsEl = document.createElement("div");
controlsEl.className = "alphatex-controls nav-buttons-container";

wrapper.appendChild(messagesEl);
wrapper.appendChild(scoreEl);
rootEl.appendChild(wrapper);
```

### 错误处理系统

#### 错误率限制
```typescript
const MAX_ERRORS_TOTAL = 50;
const RATE_WINDOW_MS = 1000;
const RATE_LIMIT_PER_WINDOW = 30;
let rateWindowStart = Date.now();
let rateWindowCount = 0;
let suppressedCount = 0;
```

#### 错误消息管理
```typescript
const appendError = (text: string) => {
  // 速率限制检查
  const now = Date.now();
  if (now - rateWindowStart > RATE_WINDOW_MS) {
    rateWindowStart = now;
    rateWindowCount = 0;
    suppressedCount = 0;
  }
  
  rateWindowCount++;
  if (rateWindowCount > RATE_LIMIT_PER_WINDOW) {
    suppressedCount++;
    return;
  }
  
  // 错误去重和计数
  const existing = errorIndex.get(text);
  if (existing) {
    existing.count++;
    existing.el.textContent = `${text} (x${existing.count})`;
    return;
  }
  
  // 创建新的错误元素
  const errEl = document.createElement("div");
  errEl.className = "alphatex-error";
  errEl.textContent = text;
  messagesEl.appendChild(errEl);
  errorIndex.set(text, { el: errEl, count: 1 });
};
```

### 复制功能集成

```typescript
const ensureCopyButton = () => {
  if (copyBtnAdded) return;
  copyBtnAdded = true;
  
  const btn = document.createElement("button");
  btn.className = "clickable-icon";
  setIcon(icon, "copy");
  btn.setAttribute("aria-label", "复制错误与原文");
  
  btn.addEventListener("click", async () => {
    const mergedText = [
      "---- AlphaTex Source ----",
      source,
      "",
      "---- Errors ----",
      ...errorMessages.map(e => `- ${e}`),
      "",
    ].join("\n");
    
    await navigator.clipboard.writeText(mergedText);
  });
  
  messagesEl.appendChild(btn);
};
```

### 主题适配机制

```typescript
// 从 CSS 变量获取主题颜色
const style = window.getComputedStyle(rootEl);
const mainGlyphColor = style.getPropertyValue("--color-base-100") || "#e0e0e0";
const secondaryGlyphColor = style.getPropertyValue("--color-base-60") || "#a0a0a0";
const base40 = style.getPropertyValue("--color-base-40") || "#707070";
const scoreInfoColor = mainGlyphColor;

// 光标和高亮样式
const accent = `hsl(var(--accent-h),var(--accent-s),var(--accent-l))`;
const runtimeStyle = document.createElement("style");
runtimeStyle.innerHTML = `
  .alphatex-block .at-cursor-bar { background: ${accent}; opacity: 0.2; }
  .alphatex-block .at-selection div { background: ${accent}; opacity: 0.4; }
  .alphatex-block .at-cursor-beat { background: ${accent}; width: 3px; }
  .alphatex-block .at-highlight * { fill: ${accent}; stroke: ${accent}; }
`;
```

### AlphaTab API 初始化

```typescript
api = new alphaTab.AlphaTabApi(scoreEl, {
  core: {
    scriptFile: resources.alphaTabWorkerUri || "",
    smuflFontSources: resources.bravuraUri ? 
      new Map([[fontFormat, resources.bravuraUri]]) : new Map(),
    fontDirectory: "",
  },
  player: {
    enablePlayer: playerEnabled,
    playerMode: playerEnabled ? 
      alphaTab.PlayerMode.EnabledAutomatic : alphaTab.PlayerMode.Disabled,
    soundFont: playerEnabled ? resources.soundFontUri : undefined,
  },
  display: {
    resources: {
      mainGlyphColor,
      secondaryGlyphColor,
      staffLineColor: base40,
      barSeparatorColor: base40,
      barNumberColor: mainGlyphColor,
      scoreInfoColor,
    },
    scale: merged.scale ?? 1.0,
  },
});
```

### 乐谱渲染逻辑

```typescript
const renderFromTex = () => {
  // 重置错误计数
  rateWindowStart = Date.now();
  rateWindowCount = 0;
  errorMessages = [];
  errorIndex.clear();
  
  try {
    // 优先使用 tex 方法
    if (typeof (api as any).tex === "function") {
      (api as any).tex(body);
      return;
    }
    
    // 备用方案使用 AlphaTexImporter
    const Importer: any = (alphaTab as any).importer?.AlphaTexImporter;
    if (Importer) {
      const imp = new Importer();
      imp.logErrors = true;
      imp.initFromString(body, api!.settings);
      const score = imp.readScore();
      api!.renderScore(score);
    }
  } catch (e) {
    appendError(`AlphaTex render error: ${formatError(e)}`);
  }
};
```

### 控制界面生成

#### 控制按钮渲染器
```typescript
const renderers: Record<string, () => void> = {
  playPause: () => {
    const btn = createButton("play", "播放/暂停", () => api!.playPause());
    controlsEl.appendChild(btn);
  },
  stop: () => {
    const btn = createButton("square", "停止", () => api!.stop());
    controlsEl.appendChild(btn);
  },
  metronome: () => {
    const btn = createButton("lucide-music-2", "节拍器", () => {
      const enabled = (api!.metronomeVolume || 0) > 0 ? false : true;
      api!.metronomeVolume = enabled ? 1 : 0;
    });
    controlsEl.appendChild(btn);
  },
  // ... 更多控制按钮
};
```

#### 控制项可见性管理
```typescript
const shouldShow = (key: string, def = true) => {
  const c = uiOverride?.components;
  return typeof c?.[key] === "boolean" ? !!c?.[key] : def;
};

const parseOrder = (): string[] => {
  const ord = uiOverride?.order as unknown;
  if (!ord) return ["playPause", "stop", "metronome"];
  if (Array.isArray(ord)) return ord.filter(k => supportedKeys.includes(k));
  // ... 其他格式解析
};
```

### 性能优化特性

1. **懒加载**: 使用 `scheduleInit` 推迟重型初始化
2. **错误限制**: 防止错误消息泛滥
3. **资源管理**: 正确的清理和销毁
4. **内存优化**: 避免内存泄漏

这个 Markdown 集成系统提供了强大的 AlphaTex 代码块渲染功能，确保了在 Obsidian 笔记中的无缝集成和优秀的用户体验。
