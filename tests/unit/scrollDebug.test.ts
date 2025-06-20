import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScrollDebugger } from '../../src/utils/scrollDebug';

describe('ScrollDebugger', () => {
  let mockApi: any;
  let consoleGroupSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleGroupEndSpy: any;

  beforeEach(() => {
    // Setup console spies
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    // Create mock AlphaTab API
    mockApi = {
      playerState: 'paused',
      isReadyForPlayback: true,
      settings: {
        player: {
          enablePlayer: true,
          enableCursor: true,
          enableAnimatedBeatCursor: true,
          scrollMode: 'continuous',
          scrollElement: null,
          scrollOffsetY: 0,
          scrollSpeed: 300,
          nativeBrowserSmoothScroll: true
        }
      },
      container: {
        element: {
          clientWidth: 800,
          clientHeight: 600,
          scrollTop: 0,
          scrollLeft: 0
        }
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debugScrollSettings', () => {
    it('should be callable without errors', () => {
      expect(() => {
        ScrollDebugger.debugScrollSettings(mockApi);
      }).not.toThrow();
    });

    it('should be callable with null API without errors', () => {
      expect(() => {
        ScrollDebugger.debugScrollSettings(null);
      }).not.toThrow();
    });

    it('should be callable with custom prefix without errors', () => {
      expect(() => {
        ScrollDebugger.debugScrollSettings(mockApi, '[CustomPrefix]');
      }).not.toThrow();
    });

    it('should be callable with undefined API without errors', () => {
      expect(() => {
        ScrollDebugger.debugScrollSettings(undefined as any);
      }).not.toThrow();
    });

    it('should handle API with missing settings', () => {
      const apiWithoutSettings = { ...mockApi };
      delete apiWithoutSettings.settings;

      expect(() => {
        ScrollDebugger.debugScrollSettings(apiWithoutSettings);
      }).not.toThrow();
    });

    it('should handle API with missing container', () => {
      const apiWithoutContainer = { ...mockApi };
      delete apiWithoutContainer.container;

      expect(() => {
        ScrollDebugger.debugScrollSettings(apiWithoutContainer);
      }).not.toThrow();
    });

    it('should handle partial settings object', () => {
      const apiWithPartialSettings = {
        ...mockApi,
        settings: {
          player: {
            enablePlayer: true
            // Missing other properties
          }
        }
      };

      expect(() => {
        ScrollDebugger.debugScrollSettings(apiWithPartialSettings);
      }).not.toThrow();
    });
  });

  describe('Static class behavior', () => {
    it('should have debugScrollSettings as a static method', () => {
      expect(typeof ScrollDebugger.debugScrollSettings).toBe('function');
    });

    it('should be a utility class with static methods', () => {
      // ScrollDebugger should be a utility class, but JavaScript/TypeScript doesn't prevent instantiation
      // We just verify it has the expected static method
      expect(ScrollDebugger.debugScrollSettings).toBeDefined();
      expect(typeof ScrollDebugger.debugScrollSettings).toBe('function');
      
      // It should work fine even if instantiated (though not recommended)
      expect(() => new (ScrollDebugger as any)()).not.toThrow();
    });
  });

  describe('Method signatures', () => {
    it('should accept AlphaTabApi as first parameter', () => {
      // This test ensures the method signature is correct
      const result = ScrollDebugger.debugScrollSettings(mockApi);
      expect(result).toBeUndefined(); // The method doesn't return anything
    });

    it('should accept prefix as optional second parameter', () => {
      const result = ScrollDebugger.debugScrollSettings(mockApi, '[TEST]');
      expect(result).toBeUndefined();
    });

    it('should work with default prefix when not provided', () => {
      const result = ScrollDebugger.debugScrollSettings(mockApi);
      expect(result).toBeUndefined();
    });
  });
});
