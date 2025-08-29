import { App } from 'obsidian';
import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';

// 翻译数据类型定义
export interface TranslationData {
  [key: string]: string | TranslationData;
}

// 支持的语言类型
export type SupportedLanguage = 'en' | 'zh';

// 翻译映射
const translations: Record<SupportedLanguage, TranslationData> = {
  en: enTranslations,
  zh: zhTranslations,
};

// 当前语言状态
let currentLanguage: SupportedLanguage = 'en';
let isInitialized = false;

/**
 * 获取嵌套对象中的值
 * @param obj 对象
 * @param path 路径，如 'common.apply'
 * @returns 找到的值或undefined
 */
function getNestedValue(obj: TranslationData, path: string): string | undefined {
  const keys = path.split('.');
  let current: TranslationData | string = obj;

  for (const key of keys) {
    if (typeof current === 'string') {
      return undefined;
    }
    current = current[key];
    if (current === undefined) {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * 获取当前Obsidian语言设置
 * @param app Obsidian App实例
 * @returns 支持的语言代码
 */
function getCurrentLanguage(app: App): SupportedLanguage {
  try {
    // 检查HTML文档的lang属性（Obsidian会设置这个）
    const htmlLang = document.documentElement.lang;
    if (htmlLang && htmlLang.startsWith('zh')) {
      return 'zh';
    }

    // 检查是否有中文的CSS类名或其他标识
    const bodyClasses = document.body.className;
    if (bodyClasses.includes('zh') || bodyClasses.includes('chinese')) {
      return 'zh';
    }

    // 检查浏览器语言
    const browserLang = navigator.language;
    if (browserLang && browserLang.startsWith('zh')) {
      return 'zh';
    }

    // 检查所有语言偏好设置
    const languages = navigator.languages || [];
    for (const lang of languages) {
      if (lang.startsWith('zh')) {
        return 'zh';
      }
    }

    // 默认返回英文
    return 'en';
  } catch (error) {
    console.warn('[TabFlow i18n] Failed to get current language:', error);
    return 'en';
  }
}

/**
 * 加载翻译数据
 * @param app Obsidian App实例
 */
export function loadTranslations(app: App): void {
  try {
    currentLanguage = getCurrentLanguage(app);
    isInitialized = true;

    console.log(`[TabFlow i18n] Loaded translations for language: ${currentLanguage}`);
  } catch (error) {
    console.error('[TabFlow i18n] Failed to load translations:', error);
    // 出错时使用英文作为fallback
    currentLanguage = 'en';
    isInitialized = true;
  }
}

/**
 * 翻译函数
 * @param key 翻译键，如 'common.apply' 或 'playback.play'
 * @param fallback 自定义fallback文本（可选）
 * @returns 翻译后的文本
 */
export function t(key: string, fallback?: string): string {
  // 如果未初始化，使用英文作为默认语言
  if (!isInitialized) {
    console.warn('[TabFlow i18n] Translations not loaded, using English as fallback');
    currentLanguage = 'en';
  }

  try {
    // 首先尝试当前语言
    let translation = getNestedValue(translations[currentLanguage], key);

    // 如果当前语言没有找到，尝试英文fallback
    if (translation === undefined && currentLanguage !== 'en') {
      translation = getNestedValue(translations.en, key);
    }

    // 如果还是没找到，返回自定义fallback或原始key
    if (translation === undefined) {
      const finalFallback = fallback || key;
      console.warn(`[TabFlow i18n] Translation not found for key: ${key}, using fallback: ${finalFallback}`);
      return finalFallback;
    }

    return translation;
  } catch (error) {
    console.error(`[TabFlow i18n] Error translating key "${key}":`, error);
    return fallback || key;
  }
}

/**
 * 获取当前语言
 * @returns 当前语言代码
 */
export function getCurrentLanguageCode(): SupportedLanguage {
  return currentLanguage;
}

/**
 * 检查是否支持指定的语言
 * @param language 语言代码
 * @returns 是否支持
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return language === 'en' || language === 'zh';
}

/**
 * 获取所有支持的语言列表
 * @returns 支持的语言数组
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['en', 'zh'];
}

/**
 * 获取语言显示名称
 * @param language 语言代码
 * @returns 语言显示名称
 */
export function getLanguageDisplayName(language: SupportedLanguage): string {
  const displayNames: Record<SupportedLanguage, string> = {
    en: 'English',
    zh: '中文',
  };
  return displayNames[language];
}

// 导出翻译数据（用于调试或扩展）
export { translations };
