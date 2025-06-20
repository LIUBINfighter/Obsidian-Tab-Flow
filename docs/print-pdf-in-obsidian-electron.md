# Obsidian/Electron 环境下 AlphaTab 打印 PDF 问题总结

## 问题现象
- 在 Obsidian 插件/Electron 环境下，调用 AlphaTab 的 `api.print()` 方法会报错：
  - `TypeError: Cannot read properties of null (reading 'document')`
  - 以及 window.parent.document、window.top.document 相关只读属性报错。
- 这些错误源于 AlphaTab 依赖真实浏览器的 window/document/弹窗/打印能力，而 Electron/Obsidian 并不具备这些能力。

## 已尝试的 hack 方案
- 伪造 `window.document`、`window.parent`、`window.top` 等对象。
- 试图为 `window.parent.document`、`window.top.document` 赋值，但这些属性为只读且为 null，无法 hack。
- 结果：依然报错，无法突破 Electron/Obsidian 的安全限制。

## 结论
- 目前无法通过 hack 让 AlphaTab 的 print 在 Obsidian/Electron 下正常工作。
- 继续 hack 只会遇到只读属性和 null 报错，无法突破。

## 推荐做法
1. 检测环境，如果不是浏览器，直接弹出友好提示：“当前环境不支持直接打印为 PDF，请在浏览器中打开后再打印。”
2. 提供导出图片或 PDF 的替代方案，如用 html2canvas + jsPDF 实现截图导出 PDF。

## 参考方案
- [html2canvas](https://github.com/niklasvh/html2canvas)
- [jsPDF](https://github.com/parallax/jsPDF)
- [dom-to-image](https://github.com/tsayen/dom-to-image)

---
如需后续集成替代方案，可随时回顾本文档。
