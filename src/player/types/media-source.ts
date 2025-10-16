/**
 * 媒体源类型定义
 * 
 * 使用 Discriminated Union Types 确保类型安全和状态一致性
 * 借鉴官方 playground 示例的设计模式
 */

/**
 * 媒体类型枚举
 */
export enum MediaType {
    /** 合成器模式（AlphaTab 内置 MIDI 合成） */
    Synth = 'synth',
    
    /** 音频文件模式（曲谱内置的 backing track） */
    Audio = 'audio',
    
    /** YouTube 视频模式 */
    YouTube = 'youtube',
    
    /** 外部媒体元素模式（自定义 HTMLMediaElement） */
    External = 'external'
}

/**
 * 媒体源状态（Discriminated Union）
 * 
 * 每种媒体类型携带不同的必需数据：
 * - Synth: 无额外数据
 * - Audio: 音频 URL 和 Blob
 * - YouTube: 视频 URL 和偏移量
 * - External: HTMLMediaElement 引用
 */
export type MediaSource =
    | {
          type: MediaType.Synth;
      }
    | {
          type: MediaType.Audio;
          /** 音频文件 URL */
          url: string;
          /** 音频文件 Blob */
          blob?: Blob;
          /** 音频文件原始字节 */
          audioFile?: Uint8Array;
      }
    | {
          type: MediaType.YouTube;
          /** YouTube 视频 URL */
          url: string;
          /** 媒体偏移量（毫秒） */
          offset: number;
          /** 视频时长（毫秒，可选） */
          duration?: number;
      }
    | {
          type: MediaType.External;
          /** 外部媒体元素 */
          element: HTMLMediaElement;
          /** 媒体偏移量（毫秒） */
          offset?: number;
      };

/**
 * 类型守卫：判断是否为合成器模式
 */
export function isSynthMedia(source: MediaSource): source is Extract<MediaSource, { type: MediaType.Synth }> {
    return source.type === MediaType.Synth;
}

/**
 * 类型守卫：判断是否为音频文件模式
 */
export function isAudioMedia(source: MediaSource): source is Extract<MediaSource, { type: MediaType.Audio }> {
    return source.type === MediaType.Audio;
}

/**
 * 类型守卫：判断是否为 YouTube 模式
 */
export function isYouTubeMedia(source: MediaSource): source is Extract<MediaSource, { type: MediaType.YouTube }> {
    return source.type === MediaType.YouTube;
}

/**
 * 类型守卫：判断是否为外部媒体模式
 */
export function isExternalMedia(source: MediaSource): source is Extract<MediaSource, { type: MediaType.External }> {
    return source.type === MediaType.External;
}

/**
 * 判断媒体源是否需要外部同步
 * （YouTube 和 External 需要外部同步）
 */
export function needsExternalSync(source: MediaSource): boolean {
    return source.type === MediaType.YouTube || source.type === MediaType.External;
}

/**
 * 获取媒体源的显示名称
 */
export function getMediaTypeName(source: MediaSource): string {
    switch (source.type) {
        case MediaType.Synth:
            return '合成器';
        case MediaType.Audio:
            return '音频文件';
        case MediaType.YouTube:
            return 'YouTube 视频';
        case MediaType.External:
            return '外部媒体';
        default:
            return '未知';
    }
}

/**
 * 创建默认媒体源（合成器）
 */
export function createDefaultMediaSource(): MediaSource {
    return { type: MediaType.Synth };
}

/**
 * 从音频 URL 创建媒体源
 */
export function createAudioMediaSource(url: string, blob?: Blob, audioFile?: Uint8Array): MediaSource {
    return {
        type: MediaType.Audio,
        url,
        blob,
        audioFile
    };
}

/**
 * 从 YouTube URL 创建媒体源
 */
export function createYouTubeMediaSource(url: string, offset = 0, duration?: number): MediaSource {
    return {
        type: MediaType.YouTube,
        url,
        offset,
        duration
    };
}

/**
 * 从外部媒体元素创建媒体源
 */
export function createExternalMediaSource(element: HTMLMediaElement, offset = 0): MediaSource {
    return {
        type: MediaType.External,
        element,
        offset
    };
}
