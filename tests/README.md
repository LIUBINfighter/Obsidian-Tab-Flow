# 测试指南

这个文档描述了如何运行和维护 Interactive Tabs 插件的测试套件。

## 🏗️ 测试架构

### 测试类型
- **单元测试** (`tests/unit/`): 测试单个模块和函数
- **集成测试** (`tests/integration/`): 测试模块间交互
- **Mock测试** (`tests/setup.ts`): 模拟Obsidian和AlphaTab环境

### 测试框架
- **Vitest**: 现代JavaScript测试框架
- **JSDOM**: 模拟浏览器环境
- **Testing Library**: 提供测试工具

## 📦 安装依赖

```bash
npm install
```

## 🚀 运行测试

### 运行所有测试
```bash
npm test
```

### 监视模式
```bash
npm run test:watch
```

### 查看覆盖率
```bash
npm run test:coverage
```

### 可视化界面
```bash
npm run test:ui
```

## 📊 测试覆盖率目标

### 当前覆盖率目标
- **函数覆盖率**: 90%+
- **语句覆盖率**: 85%+
- **分支覆盖率**: 80%+
- **行覆盖率**: 85%+

### 优先级模块
1. `ITabManager` - 核心业务逻辑
2. `ITabUIManager` - UI管理
3. `TabView` - 主视图
4. `TexEditorView` - 编辑器视图
5. 事件处理器
6. 工具函数

## 🧪 测试分类

### 高优先级（必须100%覆盖）
- `src/ITabManager.ts`
- `src/ITabUIManager.ts`
- `src/events/`目录下的所有文件
- `src/utils/utils.ts`

### 中优先级（目标90%+覆盖）
- `src/views/TabView.ts`
- `src/views/TexEditorView.ts`
- `src/alphatab/`目录下的核心文件
- `src/components/`目录

### 低优先级（目标80%+覆盖）
- UI组件
- 样式相关代码
- 配置文件

## 📝 编写测试指南

### 单元测试结构
```typescript
describe('ModuleName', () => {
  let instance: ModuleName;
  
  beforeEach(() => {
    // 设置测试环境
    instance = new ModuleName();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // 测试正常情况
    });

    it('should handle edge case', () => {
      // 测试边界情况
    });

    it('should handle error case', () => {
      // 测试错误情况
    });
  });
});
```

### Mock最佳实践
```typescript
// Mock外部依赖
vi.mock('@coderline/alphatab', () => ({
  // Mock实现
}));

// Mock DOM元素
const mockElement = document.createElement('div');
mockElement.style.width = '800px';
```

### 断言最佳实践
```typescript
// 明确的断言
expect(result).toBe(expectedValue);
expect(function).toHaveBeenCalledWith(expectedArgs);
expect(element).toBeInTheDocument();

// 异步断言
await expect(promise).resolves.toBe(expectedValue);
await expect(promise).rejects.toThrow(expectedError);
```

## 🐛 常见问题

### 1. Mock不工作
```typescript
// 确保在describe块外部mock
vi.mock('module-name');

describe('Test', () => {
  // 测试代码
});
```

### 2. DOM测试问题
```typescript
// 确保在beforeEach中清理DOM
beforeEach(() => {
  document.body.innerHTML = '';
});
```

### 3. 异步测试
```typescript
// 使用async/await
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

## 📈 持续改进

### 定期任务
1. **每周**: 检查测试覆盖率报告
2. **每月**: 更新测试依赖
3. **每次PR**: 确保新代码有对应测试
4. **重构时**: 同步更新测试

### 测试质量指标
- 测试是否真实反映业务逻辑
- Mock是否适度（不过度mock）
- 测试是否易于维护
- 测试运行速度是否合理

## 🔧 CI/CD集成

### 推荐的CI流程
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## 📚 参考资料

- [Vitest文档](https://vitest.dev/)
- [Testing Library文档](https://testing-library.com/)
- [Jest Mocking指南](https://jestjs.io/docs/mock-functions)
- [测试最佳实践](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
