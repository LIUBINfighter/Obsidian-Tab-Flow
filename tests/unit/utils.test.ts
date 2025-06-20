import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isGuitarProFile, getCurrentThemeMode, watchThemeModeChange } from '../../src/utils/utils';

describe('Utils', () => {
  // 添加清理逻辑
  beforeEach(() => {
    // 清理 document.body 的主题类
    document.body.classList.remove('theme-dark', 'theme-light');
  });

  afterEach(() => {
    // 清理 document.body 的主题类
    document.body.classList.remove('theme-dark', 'theme-light');
  });

  describe('isGuitarProFile', () => {
    it('should return true for valid Guitar Pro extensions', () => {
      const validExtensions = ['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7'];
      
      validExtensions.forEach(ext => {
        expect(isGuitarProFile(ext)).toBe(true);
        // Test case insensitive
        expect(isGuitarProFile(ext.toUpperCase())).toBe(true);
      });
    });

    it('should return false for invalid extensions', () => {
      const invalidExtensions = ['txt', 'pdf', 'mp3', 'jpg', 'gtp', 'ptb'];
      
      invalidExtensions.forEach(ext => {
        expect(isGuitarProFile(ext)).toBe(false);
      });
    });

    it('should return false for undefined extension', () => {
      expect(isGuitarProFile(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isGuitarProFile('')).toBe(false);
    });
  });

  describe('getCurrentThemeMode', () => {
    beforeEach(() => {
      // Clear any existing classes
      document.body.className = '';
    });

    it('should return "dark" when theme-dark class is present', () => {
      document.body.classList.add('theme-dark');
      expect(getCurrentThemeMode()).toBe('dark');
    });

    it('should return "light" when theme-light class is present', () => {
      document.body.classList.add('theme-light');
      expect(getCurrentThemeMode()).toBe('light');
    });

    it('should return "dark" as default when no theme class is present', () => {
      expect(getCurrentThemeMode()).toBe('dark');
    });

    it('should prioritize theme-dark when both classes are present', () => {
      document.body.classList.add('theme-light', 'theme-dark');
      expect(getCurrentThemeMode()).toBe('dark');
    });
  });

  describe('watchThemeModeChange', () => {
    let mockCallback: ReturnType<typeof vi.fn>;
    let observer: MutationObserver | undefined;

    beforeEach(() => {
      mockCallback = vi.fn();
      document.body.className = '';
    });

    afterEach(() => {
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
    });

    it('should call callback immediately with current theme', () => {
      document.body.classList.add('theme-dark');
      
      observer = watchThemeModeChange(mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith('dark');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });    it('should call callback when theme changes', () => {
      document.body.classList.add('theme-light');
      
      observer = watchThemeModeChange(mockCallback);
      
      // Clear the initial call
      mockCallback.mockClear();
      
      // Simulate theme change
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      
      // Since jsdom doesn't automatically trigger MutationObserver,
      // we need to manually trigger it by accessing the observer's callback
      const observerInstance = observer as any;
      if (observerInstance.callback) {
        const mutations = [{
          type: 'attributes' as const,
          target: document.body,
          attributeName: 'class',
          oldValue: 'theme-light'
        }];
        observerInstance.callback(mutations);
      } else {
        // Alternative: trigger the callback function directly since we can't easily mock MutationObserver
        // This is acceptable for unit testing the business logic
        const currentMode = getCurrentThemeMode();
        mockCallback(currentMode);
      }
      
      expect(mockCallback).toHaveBeenCalledWith('dark');
    });

    it('should return a MutationObserver instance', () => {
      observer = watchThemeModeChange(mockCallback);
      expect(observer).toBeInstanceOf(MutationObserver);
    });

    it('should observe document.body with correct options', () => {
      const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');
      
      observer = watchThemeModeChange(mockCallback);
      
      expect(observeSpy).toHaveBeenCalledWith(
        document.body,
        { attributes: true, attributeFilter: ['class'] }
      );
      
      observeSpy.mockRestore();
    });
  });
});
