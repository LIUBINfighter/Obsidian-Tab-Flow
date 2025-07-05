# 单元测试修复和完善指南

## 立即可以开始的任务

基于当前成功的测试结果（utils.test.ts），我建议从以下几个方面开始实现单元测试全覆盖：

### 1. 立即修复的优先级（今天）

#### ✅ 已验证可工作的测试
- `utils.test.ts` - 工具函数测试（11/12通过）

#### 🔧 立即修复项
1. **修复setup.ts中的Mock问题**
   - 已添加AlphaTab.renderTracks方法
   - 需要增强DOM元素的addClasses方法

2. **完成简单的纯函数测试**
   - 完善工具函数测试覆盖
   - 添加类型相关的测试

### 2. 今天可以完成的新测试文件

#### 简单控件组件测试
- `SelectControl.test.ts` ✅ 已创建
- `playPauseButton.test.ts` 🚧 需要修复导入路径
- `StopButton.test.ts` 
- `TimePositionDisplay.test.ts`
- `ToggleButton.test.ts`

#### 工具函数补充测试
- `midiExportHelper.test.ts` ✅ 已创建基础测试
- `scrollDebug.test.ts` ✅ 已创建基础测试

### 3. 本周完成的测试（按优先级）

#### 高优先级：核心业务逻辑
1. **FontManager测试修复**
   - 主要问题：DOM操作Mock不完善
   - 需要修复document.getElementById等方法

2. **事件处理器测试修复**
   - 主要问题：AlphaTab API Mock缺少方法
   - 已修复renderTracks，可能还需要其他方法

3. **AlphaTab集成组件**
   - AlphaTabEventBinder
   - AlphaTabSettingsHelper  
   - initializeAndLoadScore

#### 中优先级：UI组件
1. **管理器类**
   - ITabManager
   - ITabUIManager（需要修复DOM appendChild问题）
   - CursorScrollManager

2. **视图类**
   - TabView（需要修复containerEl.addClasses问题）
   - TexEditorView

#### 低优先级：集成测试
1. **插件主类**
   - 修复integration/plugin.test.ts
   - 主要问题：app.vault未正确Mock

2. **模态框组件**
   - TemplateManagerModal
   - TracksModal
   - TracksSidebar

## 建议的实施顺序

### 今天（第1天）
1. 修复DOM Mock中的addClasses方法
2. 完成所有控件组件测试
3. 运行并验证工具函数测试100%通过

### 明天（第2天）  
1. 修复FontManager测试
2. 修复事件处理器测试
3. 创建AlphaTab集成组件测试

### 第3天
1. 修复UI管理器测试
2. 修复视图类测试
3. 达到70%代码覆盖率

### 第4-5天
1. 修复插件主类集成测试
2. 完成模态框组件测试
3. 达到90%代码覆盖率

## 技术要点

### Mock策略
- **DOM操作**：使用createMockElement函数统一创建
- **Obsidian API**：重点Mock app.vault和workspace
- **AlphaTab API**：确保所有使用的方法都有Mock实现

### 测试编写原则
- **从简单开始**：纯函数 > 简单类 > 复杂组件 > 集成
- **逐步验证**：每完成一个文件就运行测试验证
- **覆盖完整**：正常路径 + 边缘情况 + 错误处理

### 质量保证
- 每个测试文件至少90%通过率再继续下一个
- 定期运行完整测试套件检查回归
- 保持测试代码的可读性和可维护性
