# 代码清理检查清单

> **创建日期**: 2025-10-16  
> **相关 PR**: [#93 Player Refine by React & zustand](https://github.com/LIUBINfighter/Obsidian-Tab-Flow/pull/93)

在解决 AlphaTab 多实例渲染问题后，需要清理调试过程中添加的冗余代码和日志。

---

## 🎯 清理原则

### 保留的内容
- ✅ 错误日志（`console.error`）- 用于问题追踪
- ✅ 警告日志（`console.warn`）- 提示潜在问题
- ✅ 关键生命周期日志（init, destroy, API rebuild）- 便于调试时序问题
- ✅ 必要的注释说明（如为什么使用 SVG 引擎）

### 删除的内容
- ❌ 过度详细的调试日志（如 "Container stored"）
- ❌ 中间步骤的成功确认（如 "API rebuilt successfully"）
- ❌ 不再使用的属性（如 `intersectionObserver`）
- ❌ 实验性代码的注释（如字体等待逻辑）

---

## 📝 待清理项目

### 1. PlayerController.ts

#### 1.1 删除冗余日志

**当前状态**（44 处日志）：
```typescript
console.log(`[PlayerController #${this.instanceId}] Init called`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Container stored, initializing API`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] API initialization completed successfully`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Destroying controller...`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] IntersectionObserver cleaned up`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Rebuilding API...`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Creating AlphaTabApi instance...`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] API rebuilt successfully`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Using provided scrollViewport`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Found scrollable parent:`...);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Using workspace-leaf-content`);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] AlphaTab settings configured:`...);  // ❌ 删除（详细配置）
console.log(`[PlayerController #${this.instanceId}] Font configured:`...);  // ❌ 删除
console.log(`[PlayerController #${this.instanceId}] Color resources configured:`...);  // ❌ 删除（详细配置）
console.log('[PlayerController] Scroll mode applied:'...);  // ❌ 删除
console.log('[PlayerController] Player ready - can now play music');  // ❌ 删除
```

**保留的日志**（约 15 处）：
```typescript
// 构造函数
console.log(`[PlayerController #${this.instanceId}] Initialized with stores:`, {...});  // ✅ 保留

// 错误处理
console.error(`[PlayerController #${this.instanceId}] API initialization failed:`, error);  // ✅ 保留
console.error(`[PlayerController #${this.instanceId}] Failed to rebuild API:`, error);  // ✅ 保留
console.error('[PlayerController] alphaTab error:', error);  // ✅ 保留
console.error('[PlayerController] Failed to load score:', error);  // ✅ 保留

// 警告
console.warn(`[PlayerController #${this.instanceId}] No container, skipping rebuild`);  // ✅ 保留
console.warn(`[PlayerController #${this.instanceId}] Invalid HSL values:`, {...});  // ✅ 保留
console.warn('[PlayerController] Cannot configure scroll: API or container not ready');  // ✅ 保留
console.warn(`[PlayerController] Failed to unbind event ${eventName}:`, error);  // ✅ 保留
console.warn('[PlayerController] play() called but API not ready');  // ✅ 保留

// 关键生命周期
console.log(`[PlayerController #${this.instanceId}] Controller destroyed`);  // ✅ 保留
console.log(`[PlayerController #${this.instanceId}] Global config changed, rebuilding API`);  // ✅ 保留
```

**操作**：
```typescript
// src/player/PlayerController.ts

// init() 方法
public async init(container: HTMLElement, viewport?: HTMLElement): Promise<void> {
    // ❌ 删除: console.log(`Init called`);
    
    if (!container) {
        console.error(...);  // ✅ 保留错误
        return;
    }
    
    this.container = container;
    // ❌ 删除: console.log(`Container stored, initializing API`);
    
    try {
        this.rebuildApi();
        // ❌ 删除: console.log(`API initialization completed successfully`);
    } catch (error) {
        console.error(...);  // ✅ 保留错误
        throw error;
    }
}

// rebuildApi() 方法
private async rebuildApi(): Promise<void> {
    // ❌ 删除: console.log(`Rebuilding API...`);
    // ❌ 删除: console.log(`Creating AlphaTabApi instance...`);
    // ❌ 删除: console.log(`API rebuilt successfully`);
    
    // ✅ 保留错误日志
    console.error(`Failed to rebuild API:`, error);
}
```

#### 1.2 删除未使用的属性

**intersectionObserver 相关**：
```typescript
// 属性声明（第 35 行）
private intersectionObserver: IntersectionObserver | null = null;  // ❌ 删除

// destroy() 方法中的清理代码
if (this.intersectionObserver) {  // ❌ 删除整个 if 块
    this.intersectionObserver.disconnect();
    this.intersectionObserver = null;
    console.log(`IntersectionObserver cleaned up`);
}
```

#### 1.3 添加关键注释

**在 createAlphaTabSettings() 方法开头添加**：
```typescript
private createAlphaTabSettings(): any {
    /**
     * 重要：使用 SVG 渲染引擎而非 Canvas
     * 
     * 原因：AlphaTab 1.6.0 的 Canvas 引擎在多实例场景下存在 Bug
     * （会导致 toCssString 错误），SVG 引擎更稳定且支持多实例。
     * 
     * 参考：docs/dev/multi-instance-canvas-bug.md
     */
    const globalConfig = this.stores.globalConfig.getState();
    
    // ... 其余代码
}
```

**在 core.engine 配置处添加**：
```typescript
core: {
    file: null,
    // SVG 引擎：支持多实例，质量更好（矢量渲染）
    engine: globalConfig.alphaTabSettings.core.engine || 'svg',  
    // ...
}
```

---

### 2. ReactView.ts

#### 2.1 优化字体注入逻辑

**当前代码**（第 57-76 行）：
```typescript
// 2. 全局只注入一次 CSS @font-face（作为 AlphaTab 的备用方案）
// AlphaTab 主要通过 smuflFontSources 加载字体,但 CSS 可提供后备
if (!fontStyleInjected && this.resources.bravuraUri) {
    const fontFaceRule = `
        @font-face {
            font-family: 'alphaTab';
            src: url(${this.resources.bravuraUri});
            font-weight: normal;
            font-style: normal;
        }
    `;
    globalFontStyle = this.containerEl.ownerDocument.createElement('style');
    globalFontStyle.id = 'alphatab-font-style-global';
    globalFontStyle.appendChild(document.createTextNode(fontFaceRule));
    this.containerEl.ownerDocument.head.appendChild(globalFontStyle);
    fontStyleInjected = true;
    console.log('[ReactView] Global @font-face injected');
}
```

**优化后**：
```typescript
// 2. 全局字体注入（SVG 引擎下的后备方案）
if (!fontStyleInjected && this.resources.bravuraUri) {
    /**
     * 注入全局 @font-face 作为后备字体
     * 
     * 说明：AlphaTab 主要通过 smuflFontSources 加载字体，
     * 但全局 CSS 可以：
     * 1. 加速后续实例的字体加载（浏览器缓存）
     * 2. 提供兜底方案（如果 smuflFontSources 失败）
     * 
     * 注意：仅注入一次，所有实例共享
     */
    const fontFaceRule = `
        @font-face {
            font-family: 'alphaTab';
            src: url(${this.resources.bravuraUri});
        }
    `;
    globalFontStyle = document.createElement('style');
    globalFontStyle.id = 'alphatab-font-style-global';
    globalFontStyle.textContent = fontFaceRule;
    document.head.appendChild(globalFontStyle);
    fontStyleInjected = true;
}
```

#### 2.2 简化日志

**删除**：
```typescript
console.log('[ReactView] Global @font-face injected');  // ❌ 删除
```

---

### 3. TablatureView.tsx

#### 3.1 检查是否有遗留的延迟逻辑

**确保 useEffect 是简洁的**：
```typescript
useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return;
    
    // 直接初始化，无需延迟
    controller.init(containerRef.current, viewportRef.current);
    
    return () => {
        controller.destroy();
    };
}, [controller]);
```

---

### 4. global-config-schema.ts

#### 4.1 添加引擎选择说明

**在 GlobalAlphaTabSettings 接口上方添加**：
```typescript
/**
 * AlphaTab 全局配置
 * 
 * 注意：
 * - engine: 推荐使用 'svg'（支持多实例，质量更好）
 * - 'html5' (Canvas) 在多实例场景下可能崩溃（AlphaTab 1.6.0 已知 Bug）
 */
export interface GlobalAlphaTabSettings {
    core: {
        engine: string;  // 'svg' | 'html5'
        // ...
    };
    // ...
}
```

**在默认配置添加注释**：
```typescript
export function getDefaultGlobalConfig(): GlobalConfig {
    return {
        alphaTabSettings: {
            core: {
                engine: 'svg',  // 默认 SVG：稳定且支持多实例
                // ...
            },
            // ...
        },
        // ...
    };
}
```

---

## 🔍 验证清单

完成清理后，执行以下验证：

### 编译检查
```bash
npm run build
```

### 功能测试
- [ ] 打开单个 GP 文件 - 正常渲染
- [ ] 打开第二个 GP 文件 - 正常渲染
- [ ] 同时打开 3+ 个文件 - 全部正常
- [ ] 快速切换标签页 - 无崩溃
- [ ] 查看控制台日志 - 无冗余信息，错误清晰

### 代码质量
```bash
npm run lint
```

### 日志质量检查
打开控制台，应该看到：
- ✅ 实例创建时的初始化日志（带 stores 信息）
- ✅ 配置变更时的重建日志
- ✅ 错误和警告清晰可读
- ❌ 无"Container stored"、"API rebuilt"等冗余信息

---

## 📊 预期效果

### 代码行数减少
- **PlayerController.ts**: ~950 行 → ~900 行（-50 行）
- **ReactView.ts**: ~175 行 → ~170 行（-5 行）
- **总计**: -55 行冗余代码

### 日志数量减少
- **Before**: 44 处日志
- **After**: ~15 处日志（减少 66%）
- **保留**: 关键错误、警告、生命周期事件

### 可维护性提升
- ✅ 代码更简洁，易于阅读
- ✅ 日志更聚焦，便于问题定位
- ✅ 注释清晰，说明关键决策（如 SVG 引擎）
- ✅ 无冗余属性，减少维护负担

---

## 🛠️ 执行步骤

### 1. 备份当前代码
```bash
git stash
git checkout -b code-cleanup
git stash pop
```

### 2. 逐文件清理
按照上述检查清单，逐个文件修改：
1. PlayerController.ts（主要清理对象）
2. ReactView.ts
3. TablatureView.tsx
4. global-config-schema.ts

### 3. 提交变更
```bash
git add .
git commit -m "chore: clean up debugging logs and unused code

- Remove verbose debugging logs (44 → 15 logs)
- Delete unused intersectionObserver property
- Add comments explaining SVG engine choice
- Simplify font injection logic in ReactView
- Update ~50 lines of code

Ref: docs/dev/multi-instance-canvas-bug.md"
```

### 4. 合并到主分支
```bash
git checkout player
git merge code-cleanup
git branch -d code-cleanup
```

---

## 📚 相关文档

- [多实例渲染问题调试日志](./multi-instance-canvas-bug.md) - 为什么使用 SVG 引擎
- [架构设计文档](./01-architecture-overview.md) - 多实例状态管理设计
- [PlayerController 文档](./02-core-engine.md) - 核心引擎集成

---

**维护者**: AI Assistant  
**最后更新**: 2025-10-16  
**状态**: ⏳ 待执行

---

> 💡 **提示**：清理代码不仅是删除冗余，更是对架构和决策的再次确认。
> 
> 通过注释和文档，确保未来的维护者（包括 3 个月后的你）能够理解每一个关键决策的原因。
