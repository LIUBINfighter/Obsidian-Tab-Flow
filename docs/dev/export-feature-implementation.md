# 导出功能实现文档

## 概述

在 ReactView 重构版本中成功集成了完整的导出功能，支持 4 种格式：WAV、MP3、MIDI、Guitar Pro 7。

## 架构设计

### 组件结构

```
PlayBar.tsx
  └─ ExportModal.tsx (新增)
      ├─ 格式选择器
      ├─ 音频配置（WAV/MP3）
      ├─ 进度条
      └─ 导出逻辑
```

### 导出流程

```
用户点击下载图标 → 打开 ExportModal → 选择格式 → 配置参数 → 开始导出 → 下载文件
```

## 新增文件

### ExportModal.tsx

**位置**: `src/player/components/ExportModal.tsx`

**功能**:
- 支持 4 种导出格式：WAV、MP3、MIDI、GP7
- 实时进度显示（尤其是 WAV 音频导出）
- 可配置音频参数（采样率、主音量、节拍器音量）
- 错误处理和状态反馈

**关键方法**:

#### 1. WAV 导出 (`exportWAV`)
```typescript
const exportWAV = async () => {
  // 1. 创建导出选项
  const options = new alphaTab.synth.AudioExportOptions();
  options.sampleRate = 44100;
  options.masterVolume = 0.8;
  
  // 2. 获取导出器
  const exporter = await api.exportAudio(options);
  
  // 3. 分块渲染（每次 500ms）
  const chunks: Float32Array[] = [];
  while (true) {
    const chunk = await exporter.render(500);
    if (!chunk) break;
    chunks.push(chunk.samples);
  }
  
  // 4. 转换为 WAV Blob
  const wav = convertSamplesToWavBlob(chunks, sampleRate);
  
  // 5. 下载文件
  downloadBlob(wav, fileName);
};
```

**技术要点**:
- 使用 `api.exportAudio()` 获取 AudioExporter 实例
- 分块渲染避免内存溢出和 UI 冻结
- 手动构建 WAV 文件头（RIFF/WAVE/fmt/data chunks）
- 使用 Float32Array 存储 IEEE float 格式音频
- 进度计算：`currentTime / totalTime * 100`

#### 2. MIDI 导出 (`exportMIDI`)
```typescript
const exportMIDI = async () => {
  // AlphaTab 提供的一行导出方法
  api.downloadMidi();
};
```

**技术要点**:
- AlphaTab 内置 MIDI 导出功能
- 生成标准 SMF 1.0 格式文件
- 自动处理下载和文件命名

#### 3. Guitar Pro 导出 (`exportGP`)
```typescript
const exportGP = async () => {
  // 1. 创建 GP7 导出器
  const exporter = new alphaTab.exporter.Gp7Exporter();
  
  // 2. 导出为 Uint8Array
  const data = exporter.export(api.score, api.settings);
  
  // 3. 转换为 Blob 并下载
  const buffer = new Uint8Array(data).buffer;
  const blob = new Blob([buffer]);
  downloadBlob(blob, fileName);
};
```

**技术要点**:
- 使用 `Gp7Exporter` 类导出 Guitar Pro 7 格式
- 需要处理 Uint8Array 到 ArrayBuffer 的转换
- 生成 .gp 文件可被 Guitar Pro 软件打开

#### 4. MP3 导出 (`exportMP3`)
```typescript
const exportMP3 = async () => {
  // 先导出 WAV
  await exportWAV();
  
  // 提示用户使用在线转换工具
  alert('WAV 文件已导出。建议使用在线工具转换为 MP3...');
};
```

**技术限制**:
- AlphaTab 不直接支持 MP3 编码
- 浏览器没有原生 MP3 编码器
- 可选方案：
  - 集成 lamejs 库（客户端编码，~100KB）
  - 使用在线转换工具（当前方案）
  - 服务端转换（需要后端支持）

### WAV 格式转换器

**核心函数**: `convertSamplesToWavBlob(chunks, sampleRate)`

**WAV 文件结构**:
```
RIFF Chunk (12 bytes)
  ├─ "RIFF" (4 bytes)
  ├─ File Size - 8 (4 bytes, LE)
  └─ "WAVE" (4 bytes)

Format Chunk (24 bytes)
  ├─ "fmt " (4 bytes)
  ├─ Format Size = 16 (4 bytes, LE)
  ├─ Audio Format = 3 (IEEE float, 2 bytes, LE)
  ├─ Channels = 2 (2 bytes, LE)
  ├─ Sample Rate (4 bytes, LE)
  ├─ Byte Rate (4 bytes, LE)
  ├─ Block Align (2 bytes, LE)
  └─ Bits Per Sample = 32 (2 bytes, LE)

Data Chunk (8 + samples * 4 bytes)
  ├─ "data" (4 bytes)
  ├─ Data Size (4 bytes, LE)
  └─ Audio Samples (Float32Array)
```

**关键代码**:
```typescript
// 1. 创建 ByteBuffer
const buffer = alphaTab.io.ByteBuffer.withCapacity(fileSize);

// 2. 写入 RIFF header
buffer.write([0x52, 0x49, 0x46, 0x46]); // "RIFF"
IOHelper.writeInt32LE(buffer, fileSize - 8);
buffer.write([0x57, 0x41, 0x56, 0x45]); // "WAVE"

// 3. 写入 format chunk
buffer.write([0x66, 0x6D, 0x74, 0x20]); // "fmt "
IOHelper.writeInt32LE(buffer, 16); // block size
IOHelper.writeInt16LE(buffer, 3); // IEEE float format

// 4. 写入 data chunk
buffer.write([0x64, 0x61, 0x74, 0x61]); // "data"
IOHelper.writeInt32LE(buffer, samples * 4);
for (const chunk of chunks) {
  buffer.write(new Uint8Array(chunk.buffer));
}

// 5. 转换为 Blob
return new Blob([buffer.toArray()], { type: 'audio/wav' });
```

## PlayBar 集成

### 修改文件

**位置**: `src/player/components/PlayBar.tsx`

### 新增内容

1. **导入 ExportModal**:
```typescript
import { ExportModal } from './ExportModal';
```

2. **状态管理**:
```typescript
const [exportModalOpen, setExportModalOpen] = useState(false);
```

3. **导出按钮**:
```tsx
<button
  className="clickable-icon"
  title="导出乐谱"
  onClick={() => setExportModalOpen(true)}
  disabled={!scoreLoaded}
>
  <svg className="svg-icon lucide-download" viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
</button>
```

4. **模态框渲染**:
```tsx
<ExportModal
  controller={controller}
  isOpen={exportModalOpen}
  onClose={() => setExportModalOpen(false)}
/>
```

### UI 设计

- **按钮位置**: PlayBar 右侧，音轨按钮和设置按钮之间
- **图标**: Lucide `download` 图标
- **禁用状态**: 当 `scoreLoaded === false` 时禁用
- **tooltip**: "导出乐谱"

## 用户界面

### 模态框布局

```
┌─────────────────────────────────────┐
│ 导出乐谱                        [×] │
├─────────────────────────────────────┤
│                                     │
│ 导出格式: [WAV 音频 - 无损高质量▼]  │
│                                     │
│ 采样率:   [44100 Hz (CD 质量)  ▼]  │
│                                     │
│ 主音量:   [────────●───] 80%       │
│                                     │
│ 节拍器音量: [●──────────] 关闭      │
│                                     │
│ 导出进度: [████████░░] 80%         │
│                                     │
├─────────────────────────────────────┤
│              [开始导出] [取消]      │
└─────────────────────────────────────┘
```

### 格式选项

| 格式 | 标签 | 描述 |
|------|------|------|
| WAV  | WAV 音频 | 无损高质量音频 |
| MP3  | MP3 音频 | 压缩音频（需转换） |
| MIDI | MIDI 文件 | 标准 MIDI 格式 |
| GP   | Guitar Pro | GP7 格式文件 |

### 音频配置（仅 WAV/MP3）

| 参数 | 类型 | 选项 | 默认值 |
|------|------|------|--------|
| 采样率 | 下拉框 | 22050 / 44100 / 48000 Hz | 44100 |
| 主音量 | 滑块 | 0% - 100% | 80% |
| 节拍器音量 | 滑块 | 关闭 / 0% - 100% | 关闭 |

### 状态反馈

- **idle**: 初始状态，显示配置选项
- **exporting**: 导出中，显示进度条，禁用所有控件
- **success**: 成功，显示 "✓ 导出成功！"
- **error**: 失败，显示错误消息（红色）

## 技术实现细节

### 类型安全

```typescript
type ExportFormat = 'wav' | 'mp3' | 'midi' | 'gp';
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

interface ExportModalProps {
  controller: PlayerController;
  isOpen: boolean;
  onClose: () => void;
}
```

### 文件命名规则

```typescript
const getFileName = (extension: string): string => {
  const title = api.score?.title || 'Untitled';
  const artist = api.score?.artist || '';
  
  let fileName = title;
  if (artist) {
    fileName += ` - ${artist}`;
  }
  
  return `${fileName}.${extension}`;
};
```

**示例**:
- 有艺术家: `Stairway to Heaven - Led Zeppelin.wav`
- 无艺术家: `Canon in D.midi`
- 无标题: `Untitled.gp`

### 下载触发

```typescript
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // 释放内存
};
```

### 错误处理

```typescript
try {
  await handleExport();
  setStatus('success');
} catch (err) {
  console.error('[ExportModal] 导出失败:', err);
  setError(err instanceof Error ? err.message : '导出失败');
  setStatus('error');
}
```

## 性能优化

### 1. 分块渲染
- WAV 导出每次渲染 500ms 避免 UI 阻塞
- 使用 `await exporter.render(500)` 保持响应性

### 2. 内存管理
- 导出完成后调用 `exporter.destroy()`
- 使用 `URL.revokeObjectURL()` 释放 Blob URL

### 3. 进度反馈
- 实时更新进度条（WAV 音频）
- 粗略估计：`currentTime / totalTime * 100`
- MIDI/GP 导出速度快，直接跳转到 100%

## 已知限制和未来改进

### 当前限制

1. **MP3 支持**: 
   - 不支持直接导出 MP3
   - 需要用户使用外部工具转换

2. **进度精度**: 
   - WAV 进度是估算值，不完全精确
   - 基于采样数而非实际渲染进度

3. **取消功能**: 
   - 导出过程不可取消
   - 需要等待完成或关闭浏览器标签

### 改进计划

1. **集成 MP3 编码器**:
   ```typescript
   import lamejs from 'lamejs';
   
   const mp3Encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
   const mp3Data = mp3Encoder.encodeBuffer(samples);
   ```

2. **支持取消导出**:
   ```typescript
   const abortController = new AbortController();
   
   <button onClick={() => abortController.abort()}>
     取消导出
   </button>
   ```

3. **批量导出**:
   - 一次导出多种格式
   - 打包为 ZIP 文件下载

4. **云存储集成**:
   - 直接保存到 OneDrive/Google Drive
   - 通过 Obsidian 插件 API

## 测试建议

### 功能测试

- [ ] WAV 导出正常，音质符合预期
- [ ] MIDI 导出可被 DAW 软件识别
- [ ] GP 导出可被 Guitar Pro 打开
- [ ] 文件名正确（包含标题和艺术家）
- [ ] 进度条正常显示
- [ ] 错误处理正常（无 score 时）

### 兼容性测试

- [ ] Chrome/Edge（Chromium 内核）
- [ ] Safari（WebKit）
- [ ] Firefox（Gecko）
- [ ] Obsidian 桌面版（Electron）

### 性能测试

- [ ] 短曲谱（< 1 分钟）导出速度
- [ ] 长曲谱（> 5 分钟）内存占用
- [ ] 多轨道复杂曲谱渲染质量

## 参考资料

### AlphaTab 官方文档
- [Audio Export](https://alphatab.net/docs/guides/audio-export)
- [MIDI Export](https://alphatab.net/docs/reference/api/downloadmidi)
- [GP7 Exporter](https://alphatab.net/docs/reference/exporter/gp7exporter)

### WAV 格式规范
- [WAVE PCM soundfile format](http://soundfile.sapp.org/doc/WaveFormat/)
- [Resource Interchange File Format](https://en.wikipedia.org/wiki/Resource_Interchange_File_Format)

### 相关文件
- `src/components/PlayBar.ts` - 旧版实现参考
- `src/components/ExportChooserModal.ts` - 旧版导出模态框
- `docs/dev/export-comparison.md` - 导出方案对比分析

---

**创建日期**: 2024
**作者**: GitHub Copilot
**版本**: 1.0.0
