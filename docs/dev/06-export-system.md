# 导出功能系统

## 相关代码文件
- `src/events/exportEvents.ts` - 导出事件处理器
- `src/utils/audioUtils.ts` - 音频工具函数
- `src/components/AudioExportModal.ts` - 音频导出模态框
- `src/components/ExportChooserModal.ts` - 导出选择器模态框

## 导出系统架构

### 导出事件处理器 (ExportEventHandlers)

`registerExportEventHandlers` 函数提供了统一的导出功能接口：

#### 配置选项
```typescript
export interface ExportEventHandlersOptions {
  api: alphaTab.AlphaTabApi;
  getFileName?: () => string;      // 自定义文件名生成器
  onExportStart?: (type: string) => void;      // 导出开始回调
  onExportFinish?: (type: string, success: boolean, message?: string) => void; // 导出完成回调
  app?: any;                       // Obsidian App 实例
}
```

### 音频导出功能

#### WAV 音频导出
```typescript
async function exportAudio() {
  try {
    onExportStart?.("audio");
    
    const options = new alphaTab.synth.AudioExportOptions();
    options.masterVolume = 1;
    options.metronomeVolume = 0;
    options.sampleRate = 44100;
    
    const exporter = await api.exportAudio(options);
    const chunks: Float32Array[] = [];
    
    try {
      while (true) {
        const chunk = await exporter.render(500);
        if (!chunk) break;
        chunks.push(chunk.samples);
      }
    } finally {
      exporter.destroy();
    }
    
    const blobUrl = convertSamplesToWavBlobUrl(chunks, options.sampleRate);
    onExportFinish?.("audio", true, blobUrl);
  } catch (e: any) {
    onExportFinish?.("audio", false, e?.message || String(e));
  }
}
```

### MIDI 导出功能

#### MIDI 文件导出
```typescript
function exportMidi() {
  try {
    onExportStart?.("midi");
    const fileName = (getFileName?.() || "Untitled") + ".mid";
    
    // 优先使用 exportMidi 方法
    if (api && typeof (api as any).exportMidi === "function") {
      const midiData = (api as any).exportMidi();
      const a = document.createElement('a');
      a.download = fileName;
      a.href = URL.createObjectURL(new Blob([midiData], { type: "audio/midi" }));
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } 
    // 回退到内置下载方法
    else if (api && typeof api.downloadMidi === "function") {
      try {
        (api as any).downloadMidi(fileName);
      } catch {
        api.downloadMidi();
      }
    }
    
    onExportFinish?.("midi", true);
  } catch (e: any) {
    onExportFinish?.("midi", false, e?.message || String(e));
  }
}
```

### Guitar Pro 导出功能

#### GP7 格式导出
```typescript
function exportGp() {
  try {
    onExportStart?.("gp");
    
    if (!api.score) throw new Error("乐谱未加载");
    
    const exporter = new (alphaTab as any).exporter.Gp7Exporter();
    const data = exporter.export(api.score, api.settings);
    
    const fileName = (getFileName?.() || api.score.title || "Untitled") + ".gp";
    const a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(new Blob([data]));
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    onExportFinish?.("gp", true);
  } catch (e: any) {
    onExportFinish?.("gp", false, e?.message || String(e));
  }
}
```

### PDF 导出功能

#### 浏览器打印导出
```typescript
function exportPdf() {
  try {
    onExportStart?.("pdf");
    
    // 获取乐谱渲染区域
    const el = (api as any).renderTarget || api.container;
    if (!el) throw new Error("找不到乐谱渲染区域");
    
    // 创建打印窗口
    const win = window.open('', '_blank');
    if (!win) throw new Error("无法打开打印窗口");
    
    // 构建打印文档
    win.document.write('<html><head><title>乐谱打印</title>');
    
    // 复制样式
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach(style => {
      win.document.write(style.outerHTML);
    });
    
    win.document.write('</head><body>');
    win.document.write(el.outerHTML);
    win.document.write('</body></html>');
    win.document.close();
    
    win.focus();
    win.print();
    
    onExportFinish?.("pdf", true);
  } catch (e: any) {
    onExportFinish?.("pdf", false, e?.message || String(e));
  }
}
```

## 音频工具函数

### WAV 格式转换
```typescript
export function convertSamplesToWavBlobUrl(
  chunks: Float32Array[], 
  sampleRate: number
): string {
  // 计算总样本数
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  
  // 创建 WAV 文件头
  const wavHeader = createWavHeader(totalSamples, sampleRate);
  
  // 合并所有音频数据
  const audioData = mergeAudioChunks(chunks);
  
  // 创建完整的 WAV 文件
  const wavData = new Uint8Array(wavHeader.length + audioData.length);
  wavData.set(wavHeader, 0);
  wavData.set(audioData, wavHeader.length);
  
  // 创建 Blob URL
  const blob = new Blob([wavData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}
```

## 导出模态框组件

### AudioExportModal

音频导出模态框提供高级导出选项：

```typescript
export class AudioExportModal extends Modal {
  private api: alphaTab.AlphaTabApi;
  private options: AudioExportOptions;
  
  constructor(app: App, api: alphaTab.AlphaTabApi) {
    super(app);
    this.api = api;
    this.options = {
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      includeMetronome: false,
      normalize: true
    };
  }
  
  private createExportForm(): void {
    // 采样率选择
    this.createSelectField(
      "采样率",
      ["44100 Hz", "48000 Hz", "96000 Hz"],
      (value) => this.options.sampleRate = parseInt(value)
    );
    
    // 位深度选择
    this.createSelectField(
      "位深度", 
      ["16 bit", "24 bit", "32 bit"],
      (value) => this.options.bitDepth = parseInt(value)
    );
    
    // 其他导出选项...
  }
}
```

### ExportChooserModal

导出格式选择器模态框：

```typescript
export class ExportChooserModal extends Modal {
  private api: alphaTab.AlphaTabApi;
  private exportHandlers: ReturnType<typeof registerExportEventHandlers>;
  
  constructor(app: App, api: alphaTab.AlphaTabApi) {
    super(app);
    this.api = api;
    this.exportHandlers = registerExportEventHandlers({
      api,
      getFileName: () => this.getDefaultFileName(),
      onExportStart: (type) => this.showExportProgress(type),
      onExportFinish: (type, success) => this.hideExportProgress(type, success)
    });
  }
  
  private createFormatButtons(): void {
    const formats = [
      { label: "WAV 音频", icon: "lucide-volume-2", action: () => this.exportHandlers.exportAudio() },
      { label: "MIDI 文件", icon: "lucide-music", action: () => this.exportHandlers.exportMidi() },
      { label: "Guitar Pro", icon: "lucide-file-text", action: () => this.exportHandlers.exportGp() },
      { label: "PDF 打印", icon: "lucide-printer", action: () => this.exportHandlers.exportPdf() }
    ];
    
    formats.forEach(format => {
      const button = this.createFormatButton(format.label, format.icon);
      button.addEventListener('click', format.action);
      this.contentEl.appendChild(button);
    });
  }
}
```

## 性能优化特性

### 分块处理
音频导出使用分块处理避免内存溢出：
```typescript
while (true) {
  const chunk = await exporter.render(500); // 每次处理500毫秒
  if (!chunk) break;
  chunks.push(chunk.samples);
}
```

### 内存管理
正确的资源清理：
```typescript
finally {
  exporter.destroy(); // 确保资源释放
}
```

### 错误处理
完善的错误处理和用户反馈：
```typescript
catch (e: any) {
  onExportFinish?.("audio", false, e?.message || String(e));
}
```

## 用户体验优化

### 进度反馈
导出过程中提供视觉反馈：
```typescript
onExportStart?: (type: string) => void;
onExportFinish?: (type: string, success: boolean, message?: string) => void;
```

### 文件名生成
智能文件名生成：
```typescript
getFileName?: () => string; // 支持自定义文件名逻辑
```

这个导出系统提供了完整的音频、MIDI、Guitar Pro 和 PDF 导出功能，确保了用户能够方便地将乐谱导出为各种格式。
