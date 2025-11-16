# CodeQL Security Fixes - MediaSync Component

## 修复日期
2025年10月23日

## 问题概述
CodeQL 扫描发现 `src/player/components/MediaSync.tsx` 中存在 3 个安全问题，所有问题都与 "DOM text reinterpreted as HTML" 相关，可能导致 XSS (跨站脚本) 攻击。

## 发现的安全问题

### 1. Audio 元素的 src 属性 (Line ~483)
```tsx
<audio
  ref={audioRef}
  src={mediaState.url}  // ⚠️ 用户输入未经验证直接用作 HTML 属性
  controls
/>
```

### 2. Video 元素的 src 属性 (Line ~495)
```tsx
<video
  ref={videoRef}
  src={mediaState.url}  // ⚠️ 用户输入未经验证直接用作 HTML 属性
  controls
/>
```

### 3. iframe 元素的 src 属性 (Line ~507)
```tsx
<iframe
  src={mediaState.url}  // ⚠️ 用户输入未经验证直接用作 HTML 属性
  allow="..."
  allowFullScreen
/>
```

## 修复方案

### 1. 添加 URL 清理和验证函数

#### `sanitizeMediaUrl(url: string): string | null`
- **目的**: 验证和清理媒体 URL，防止注入攻击
- **允许的协议**: 
  - `http:` 和 `https:` - 用于网络资源
  - `file:` - 用于本地文件
  - `blob:` - 用于从 Vault 加载的文件 (通过 `URL.createObjectURL` 创建)
- **拒绝的内容**:
  - 不安全的协议 (如 `javascript:`, `data:`, `vbscript:` 等)
  - 包含控制字符的 URL (`\u0000-\u001F`, `\u007F`)
  - 包含尖括号的 URL (`<`, `>`)
  - 无效的 URL 格式
- **实现**:
  ```typescript
  function sanitizeMediaUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      const trimmed = url.trim();
      const parsed = new URL(trimmed);
      
      // 只允许安全的协议
      const allowedProtocols = ['http:', 'https:', 'file:', 'blob:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        console.warn('[MediaSync] Blocked unsafe protocol:', parsed.protocol);
        return null;
      }
      
      // 拒绝包含可疑字符的 URL
      if (/[\u0000-\u001F\u007F<>]/.test(parsed.href)) {
        console.warn('[MediaSync] Blocked URL with suspicious characters');
        return null;
      }
      
      return parsed.href;
    } catch (error) {
      console.warn('[MediaSync] Invalid URL:', error);
      return null;
    }
  }
  ```

#### `sanitizeYouTubeEmbedUrl(videoId: string): string | null`
- **目的**: 验证 YouTube 视频 ID 并构建安全的嵌入 URL
- **验证规则**: 
  - 视频 ID 必须是 11 位字符
  - 只允许字母、数字、下划线和短横线 (`[a-zA-Z0-9_-]{11}`)
- **实现**:
  ```typescript
  function sanitizeYouTubeEmbedUrl(videoId: string): string | null {
    if (!videoId) return null;
    
    // 验证视频 ID 格式
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      console.warn('[MediaSync] Invalid YouTube video ID format');
      return null;
    }
    
    // 构建安全的嵌入 URL
    return `https://www.youtube.com/embed/${videoId}`;
  }
  ```

### 2. 更新输入处理逻辑

#### Audio URL 输入
```typescript
// 之前：直接设置用户输入
onChange={(e) => {
  const val = e.target.value;
  if (isValidAudioUrl(val)) setAudioUrl(val);
}}

// 之后：清理并验证
onChange={(e) => {
  const val = e.target.value;
  const sanitized = sanitizeMediaUrl(val);
  if (sanitized) setAudioUrl(sanitized);
}}
```

#### Video URL 输入
```typescript
// 之前：直接设置用户输入
onChange={(e) => setVideoUrl(e.target.value)}

// 之后：清理并验证
onChange={(e) => {
  const val = e.target.value;
  const sanitized = sanitizeMediaUrl(val);
  if (sanitized) setVideoUrl(sanitized);
}}
```

### 3. 更新媒体加载函数

#### `switchToAudio()`
```typescript
const switchToAudio = () => {
  if (!audioUrl) return;
  
  const sanitized = sanitizeMediaUrl(audioUrl);
  if (!sanitized) {
    console.error('[MediaSync] Invalid audio URL');
    return;
  }
  
  setMediaState({ type: MediaType.Audio, url: sanitized });
};
```

#### `switchToVideo()`
```typescript
const switchToVideo = () => {
  if (!videoUrl) return;
  
  const sanitized = sanitizeMediaUrl(videoUrl);
  if (!sanitized) {
    console.error('[MediaSync] Invalid video URL');
    return;
  }
  
  setMediaState({ type: MediaType.Video, url: sanitized });
};
```

#### `switchToYouTube()`
```typescript
const switchToYouTube = () => {
  const videoId = extractYouTubeVideoId(youtubeInput);
  if (!videoId) return;
  
  const url = sanitizeYouTubeEmbedUrl(videoId);
  if (!url) return;
  
  setMediaState({ type: MediaType.YouTube, videoId, url });
};
```

### 4. 更新从 Vault 加载文件的逻辑

#### `openFileSelectModal()`
```typescript
const openFileSelectModal = () => {
  new MediaFileSuggestModal(app, async (file: TFile) => {
    try {
      const arrayBuffer = await app.vault.readBinary(file);
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      
      // 验证生成的 blob URL
      const sanitized = sanitizeMediaUrl(url);
      if (!sanitized) {
        console.error('[MediaSync] Failed to create valid URL for file:', file.path);
        return;
      }
      
      // ... 使用 sanitized URL
    } catch (error) {
      console.error('[MediaSync] Failed to load file:', error);
    }
  }).open();
};
```

## 安全改进总结

### 防护措施
1. **协议白名单**: 只允许 `http:`, `https:`, `file:`, `blob:` 协议
2. **字符验证**: 拒绝包含控制字符和尖括号的 URL
3. **结构验证**: 使用 `URL` 构造器验证 URL 的有效性
4. **YouTube ID 验证**: 严格验证视频 ID 格式，防止注入攻击
5. **错误日志**: 记录所有被阻止的不安全 URL 以便调试

### 攻击场景防护
- ✅ 防止 `javascript:` 协议注入
- ✅ 防止 `data:` URI 攻击
- ✅ 防止 HTML 标签注入
- ✅ 防止控制字符注入
- ✅ 防止恶意 YouTube embed URL

### 兼容性
- ✅ 支持用户输入的 HTTP(S) URL
- ✅ 支持本地文件 (`file://`)
- ✅ 支持从 Vault 加载的文件 (`blob:`)
- ✅ 支持 YouTube 视频 (严格验证)

## 测试建议

### 正常场景测试
1. 加载合法的 HTTP(S) 音频/视频 URL
2. 从 Vault 选择并加载媒体文件
3. 输入 YouTube 视频 URL 或 ID

### 安全场景测试
1. 尝试输入 `javascript:alert(1)` - 应被拒绝
2. 尝试输入包含 `<script>` 的 URL - 应被拒绝
3. 尝试输入 `data:text/html,<script>alert(1)</script>` - 应被拒绝
4. 尝试输入无效的 YouTube ID - 应被拒绝
5. 检查控制台日志，确认可疑 URL 被正确拦截

## 相关文件
- `src/player/components/MediaSync.tsx` - 主要修复文件

## 参考资料
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CodeQL: DOM-based XSS](https://codeql.github.com/codeql-query-help/javascript/js-xss-through-dom/)
