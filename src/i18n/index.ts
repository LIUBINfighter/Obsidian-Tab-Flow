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
let appInstance: App | null = null;
const languageChangeListeners: Array<(language: SupportedLanguage) => void> = [];

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
 * 检查Obsidian 1.8+的getLanguage API是否可用
 * @returns 是否支持新API
 */
function isGetLanguageAPISupported(): boolean {
  return typeof (window as unknown as { getLanguage?: () => string }).getLanguage === 'function';
}

/**
 * 使用Obsidian 1.8+的新getLanguage API获取语言
 * @returns 语言代码或null（如果API不可用或出错）
 */
function getLanguageFromNewAPI(): string | null {
  try {
    if (isGetLanguageAPISupported()) {
      const language = (window as unknown as { getLanguage: () => string }).getLanguage();
      console.log(`[TabFlow i18n] Detected language via getLanguage API: ${language}`);
      return language;
    }
  } catch (error) {
    console.warn('[TabFlow i18n] Failed to get language from getLanguage API:', error);
  }
  return null;
}

/**
 * 使用moment.js获取语言（fallback方法）
 * @returns 语言代码或null
 */
function getLanguageFromMoment(): string | null {
  try {
    const momentWindow = window as unknown as { moment?: { locale: () => string } };
    if (momentWindow.moment) {
      const locale = momentWindow.moment.locale();
      console.log(`[TabFlow i18n] Detected language via moment.locale(): ${locale}`);
      return locale;
    }
  } catch (error) {
    console.warn('[TabFlow i18n] Failed to get language from moment.locale():', error);
  }
  return null;
}

/**
 * 设置语言变化监听器
 * @param app Obsidian App实例
 */
function setupLanguageChangeListener(app: App): void {
  try {
    // 监听Obsidian的语言变化事件
    // Obsidian会在语言变化时触发layout-change事件
    const listener = () => {
      const newLanguage = getCurrentLanguage(app);
      if (newLanguage !== currentLanguage) {
        console.log(`[TabFlow i18n] Language changed from ${currentLanguage} to ${newLanguage}`);
        currentLanguage = newLanguage;

        // 通知所有监听器
        languageChangeListeners.forEach(listener => {
          try {
            listener(newLanguage);
          } catch (error) {
            console.error('[TabFlow i18n] Error in language change listener:', error);
          }
        });
      }
    };

    // 注册监听器
    app.workspace.on('layout-change', listener);

    console.log('[TabFlow i18n] Language change listener registered');
  } catch (error) {
    console.warn('[TabFlow i18n] Failed to setup language change listener:', error);
  }
}

/**
 * 获取当前Obsidian语言设置
 * @param app Obsidian App实例
 * @returns 支持的语言代码
 */
function getCurrentLanguage(app: App): SupportedLanguage {
  try {
    // 优先使用Obsidian 1.8+的新getLanguage API
    const newAPILanguage = getLanguageFromNewAPI();
    console.log(`[TabFlow i18n] New API result: ${newAPILanguage}`);

    if (newAPILanguage) {
      console.log(`[TabFlow i18n] Using getLanguage API language: ${newAPILanguage}`);
      if (newAPILanguage.startsWith('zh') || newAPILanguage === 'zh-cn') {
        console.log(`[TabFlow i18n] Detected Chinese language: ${newAPILanguage}`);
        return 'zh';
      }
      // 对于其他语言，默认使用英文
      console.log(`[TabFlow i18n] Detected non-Chinese language: ${newAPILanguage}, using English`);
      return 'en';
    }

    // 降级到moment.js方法
    const momentLanguage = getLanguageFromMoment();
    console.log(`[TabFlow i18n] Moment API result: ${momentLanguage}`);

    if (momentLanguage) {
      console.log(`[TabFlow i18n] Using moment.locale language: ${momentLanguage}`);
      if (momentLanguage.startsWith('zh') || momentLanguage === 'zh-cn') {
        console.log(`[TabFlow i18n] Detected Chinese language from moment: ${momentLanguage}`);
        return 'zh';
      }
      // 对于其他语言，默认使用英文
      console.log(`[TabFlow i18n] Detected non-Chinese language from moment: ${momentLanguage}, using English`);
      return 'en';
    }

    // 如果都获取不到，使用传统方法作为最后的fallback
    console.log('[TabFlow i18n] Both new API and moment.locale() not available, falling back to legacy detection');

    // 检查HTML文档的lang属性（Obsidian会设置这个）
    const htmlLang = document.documentElement.lang;
    console.log(`[TabFlow i18n] HTML lang attribute: ${htmlLang}`);
    if (htmlLang && htmlLang.startsWith('zh')) {
      console.log(`[TabFlow i18n] Detected Chinese from HTML lang: ${htmlLang}`);
      return 'zh';
    }

    // 检查浏览器语言
    const browserLang = navigator.language;
    console.log(`[TabFlow i18n] Browser language: ${browserLang}`);
    if (browserLang && browserLang.startsWith('zh')) {
      console.log(`[TabFlow i18n] Detected Chinese from browser language: ${browserLang}`);
      return 'zh';
    }

    // 默认返回英文
    console.log('[TabFlow i18n] No Chinese detected, defaulting to English');
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
    appInstance = app;
    currentLanguage = getCurrentLanguage(app);
    isInitialized = true;

    console.log(`[TabFlow i18n] Loaded translations for language: ${currentLanguage}`);

    // 设置语言变化监听器
    setupLanguageChangeListener(app);
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
 * @param params 参数对象，用于替换模板字符串中的占位符
 * @param fallback 自定义fallback文本（可选）
 * @returns 翻译后的文本
 */
export function t(key: string, params?: Record<string, unknown>, fallback?: string): string {
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

    // 如果有参数，进行模板替换
    if (params && typeof translation === 'string') {
      translation = translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : match;
      });
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

/**
 * 添加语言变化监听器
 * @param listener 监听器函数
 * @returns 取消监听的函数
 */
export function addLanguageChangeListener(listener: (language: SupportedLanguage) => void): () => void {
  languageChangeListeners.push(listener);

  // 返回取消监听的函数
  return () => {
    const index = languageChangeListeners.indexOf(listener);
    if (index > -1) {
      languageChangeListeners.splice(index, 1);
    }
  };
}

/**
 * 手动重新加载翻译（用于测试或特殊情况）
 * @param app Obsidian App实例
 */
export function reloadTranslations(app: App): void {
  try {
    const newLanguage = getCurrentLanguage(app);
    if (newLanguage !== currentLanguage) {
      console.log(`[TabFlow i18n] Manually reloading translations: ${currentLanguage} -> ${newLanguage}`);
      currentLanguage = newLanguage;

      // 通知所有监听器
      languageChangeListeners.forEach(listener => {
        try {
          listener(newLanguage);
        } catch (error) {
          console.error('[TabFlow i18n] Error in language change listener during reload:', error);
        }
      });
    }
  } catch (error) {
    console.error('[TabFlow i18n] Failed to reload translations:', error);
  }
}

/**
 * 获取当前App实例（用于高级用法）
 * @returns App实例或null
 */
export function getAppInstance(): App | null {
  return appInstance;
}

// 导出翻译数据（用于调试或扩展）
export { translations };
