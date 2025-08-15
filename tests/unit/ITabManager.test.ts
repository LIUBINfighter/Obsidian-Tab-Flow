import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ITabManager } from '@/ITabManager';
import type { ITabManagerOptions } from '@/types';

// Mock AlphaTab
vi.mock('@coderline/alphatab', () => ({
  default: {
    Settings: class MockSettings {
      core = {
        engine: 'svg',
        enableLazyLoading: true,
        logLevel: 0,
        useWorkers: true,
        scriptFile: null,
        fontDirectory: null,
        smuflFontSources: null
      };
      display = {
        scale: 0.8,
        layoutMode: 'page',
        resources: {}
      };
      player = {
        enablePlayer: false
      };
    },
    AlphaTabApi: class MockAlphaTabApi {
      score: any = null;
      settings: any;
      
      constructor(element: any, settings: any) {
        this.settings = settings;
      }
      
      load = vi.fn();
      tex = vi.fn();
      render = vi.fn();
      renderTracks = vi.fn();
      playPause = vi.fn();
      stop = vi.fn();
      destroy = vi.fn();
      on = vi.fn();
    },
    model: {
      Score: class MockScore {
        title = 'Test Score';
        artist = 'Test Artist';
        tracks = [];
      },
      Track: class MockTrack {
        name = 'Test Track';
        index = 0;
      },
      Color: {
        fromJson: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0, a: 255 })
      }
    },
    LayoutMode: {
      Page: 'page'
    },
    LogLevel: {
      Debug: 0
    }
  }
}));

describe('ITabManager', () => {
  let manager: ITabManager;
  let mockOptions: ITabManagerOptions;
  let mockMainElement: HTMLElement;
  let mockViewportElement: HTMLElement;
  let mockApp: any;
  let mockPluginInstance: any;

  beforeEach(() => {
    // Setup mock DOM elements
    mockMainElement = document.createElement('div');
    mockMainElement.style.width = '800px';
    mockMainElement.style.height = '600px';
    
    mockViewportElement = document.createElement('div');
    
    // Setup mock App
    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(true),
          getResourcePath: vi.fn().mockReturnValue('mock-resource-path'),
          basePath: '/mock/path'
        },
        read: vi.fn().mockResolvedValue('mock content'),
        readBinary: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        on: vi.fn(),
        off: vi.fn()
      },
      workspace: {
        getLeaf: vi.fn(),
        setActiveLeaf: vi.fn()
      }
    };

    // Setup mock plugin instance
    mockPluginInstance = {
      manifest: {
        dir: '/mock/plugin/dir',
        id: 'obsidian-tab-flow'
      },
      actualPluginDir: '/mock/plugin/dir'
    };

    // Setup manager options
    mockOptions = {
      pluginInstance: mockPluginInstance,
      app: mockApp,
      mainElement: mockMainElement,
      viewportElement: mockViewportElement,
      onError: vi.fn(),
      onRenderStarted: vi.fn(),
      onRenderFinished: vi.fn(),
      onScoreLoaded: vi.fn(),
      onPlayerStateChanged: vi.fn(),
      onPlayerPositionChanged: vi.fn()
    };

    manager = new ITabManager(mockOptions);
  });

  describe('Constructor', () => {
    it('should initialize with provided options', () => {
      expect(manager.getPluginInstance()).toBe(mockPluginInstance);
      expect(manager.getApp()).toBe(mockApp);
      expect(manager.getMainElement()).toBe(mockMainElement);
    });

    it('should handle missing plugin manifest directory', () => {
      // Mock console.error to suppress expected error output in tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const invalidOptions = {
        ...mockOptions,
        pluginInstance: { manifest: {} }
      };
      
      const errorSpy = vi.fn();
      invalidOptions.onError = errorSpy;
      
      new ITabManager(invalidOptions);
      
      expect(errorSpy).toHaveBeenCalledWith({
        message: "插件清单信息不完整，无法构建资源路径。"
      });
      
      // Verify that the error was logged (but suppressed in test output)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[AlphaTab] CRITICAL - pluginInstance.manifest.dir is not available.');
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Getters and Setters', () => {
    it('should get and set render tracks', () => {
      const mockTracks = [{ name: 'Track 1', index: 0 }] as any;
      
      manager.setRenderTracks(mockTracks);
      expect(manager.getRenderTracks()).toEqual(mockTracks);
    });

    it('should get and set render width', () => {
      const width = 1200;
      
      manager.setRenderWidth(width);
      expect(manager.getRenderWidth()).toBe(width);
    });

    it('should get and set dark mode flag', () => {
      manager.setDarkModeFlag(true);
      expect(manager.getDarkMode()).toBe(true);
    });

    it('should get main element', () => {
      expect(manager.getMainElement()).toBe(mockMainElement);
    });

    it('should get app instance', () => {
      expect(manager.getApp()).toBe(mockApp);
    });

    it('should get plugin instance', () => {
      expect(manager.getPluginInstance()).toBe(mockPluginInstance);
    });

    it('should get event handlers', () => {
      expect(manager.getEventHandlers()).toBe(mockOptions);
    });
  });

  describe('Dark Mode', () => {
    beforeEach(() => {
      // Mock settings and API
      const mockSettings = {
        display: {
          resources: {}
        }
      };
      manager.setSettings(mockSettings as any);
      manager.api = {
        settings: mockSettings,
        render: vi.fn()
      } as any;
    });

    it('should apply dark mode colors', () => {
      manager.setDarkMode(true);
      
      const settings = manager.getSettings();
      expect(settings.display.resources.scoreColor).toBe("rgba(236, 236, 236, 1)");
      expect(settings.display.resources.staffLineColor).toBe("rgba(200, 200, 200, 1)");
    });

    it('should apply light mode colors', () => {
      manager.setDarkMode(false);
      
      const settings = manager.getSettings();
      expect(settings.display.resources.scoreColor).toBe("rgba(0, 0, 0, 1)");
      expect(settings.display.resources.staffLineColor).toBe("rgba(0, 0, 0, 1)");
    });

    it('should re-render when changing theme', () => {
      const renderSpy = vi.fn();
      manager.api!.render = renderSpy;
      
      manager.setDarkMode(true);
      
      expect(renderSpy).toHaveBeenCalled();
    });
  });

  describe('Player Controls', () => {
    beforeEach(() => {
      manager.api = {
        playPause: vi.fn(),
        stop: vi.fn()
      } as any;
      
      const mockSettings = {
        player: { enablePlayer: true }
      };
      manager.setSettings(mockSettings as any);
    });

    it('should call API playPause when player is enabled', () => {
      manager.playPause();
      expect(manager.api!.playPause).toHaveBeenCalled();
    });

    it('should call API stop when player is enabled', () => {
      manager.stop();
      expect(manager.api!.stop).toHaveBeenCalled();
    });

    it('should handle playPause when player is disabled', () => {
      const settings = manager.getSettings();
      settings.player.enablePlayer = false;
      
      const errorSpy = vi.fn();
      mockOptions.onError = errorSpy;
      
      manager.playPause();
      
      expect(errorSpy).toHaveBeenCalledWith({
        message: "播放器当前已禁用"
      });
    });

    it('should handle stop when player is disabled', () => {
      const settings = manager.getSettings();
      settings.player.enablePlayer = false;
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      manager.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith("Player disabled");
      consoleSpy.mockRestore();
    });
  });

  describe('Track Management', () => {
    beforeEach(() => {
      manager.api = {
        renderTracks: vi.fn(),
        render: vi.fn()
      } as any;

      manager.score = {
        tracks: [
          { name: 'Track 1', index: 0 },
          { name: 'Track 2', index: 1 }
        ]
      } as any;
    });

    it('should update render tracks via API', () => {
      const tracks = [{ name: 'Track 1', index: 0 }] as any;
      
      manager.updateRenderTracks(tracks);
      
      expect(manager.api!.renderTracks).toHaveBeenCalledWith(tracks);
    });

    it('should get all tracks from score', () => {
      const allTracks = manager.getAllTracks();
      
      expect(allTracks).toHaveLength(2);
      expect(allTracks[0].name).toBe('Track 1');
      expect(allTracks[1].name).toBe('Track 2');
    });

    it('should return empty array when no score', () => {
      manager.score = null;
      
      const allTracks = manager.getAllTracks();
      
      expect(allTracks).toEqual([]);
    });

    it('should get selected render tracks', () => {
      const selectedTracks = [{ name: 'Track 1', index: 0 }] as any;
      manager.setRenderTracks(selectedTracks);
      
      const result = manager.getSelectedRenderTracks();
      
      expect(result).toEqual(selectedTracks);
    });
  });

  describe('API Management', () => {
    it('should render via API when available', () => {
      const renderSpy = vi.fn();
      manager.api = { render: renderSpy } as any;
      
      manager.render();
      
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should handle render when API is not available', () => {
      manager.api = null;
      
      // Should not throw
      expect(() => manager.render()).not.toThrow();
    });

    it('should destroy API and clean up', () => {
      const destroySpy = vi.fn();
      manager.api = { destroy: destroySpy } as any;
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      manager.destroy();
      
      expect(destroySpy).toHaveBeenCalled();
      expect(manager.api).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith("[ITabManager] Destroyed.");
      
      consoleSpy.mockRestore();
    });
  });

  describe('AlphaTex Support', () => {
    beforeEach(() => {
      manager.api = {
        tex: vi.fn(),
        score: { title: 'Test Score' }
      } as any;
    });

    it('should load from AlphaTex string when API is available', async () => {
      const texContent = ':4 c d e f | g a b c5';
      
      await manager.loadFromAlphaTexString(texContent);
      
      expect(manager.api!.tex).toHaveBeenCalledWith(texContent);
    });

    it('should throw error when API is not initialized for AlphaTex', async () => {
      manager.api = null;
      const texContent = ':4 c d e f | g a b c5';
      
      await expect(manager.loadFromAlphaTexString(texContent)).rejects.toThrow(
        'AlphaTab API 未初始化'
      );
    });

    it('should handle AlphaTex loading errors', async () => {
      // Mock console.error to suppress expected error output in tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = new Error('Invalid AlphaTex syntax');
      manager.api!.tex = vi.fn().mockImplementation(() => {
        throw error;
      });
      
      const texContent = 'invalid tex content';
      
      await expect(manager.loadFromAlphaTexString(texContent)).rejects.toThrow(error);
      
      // Verify that the error was logged (but suppressed in test output)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ITabManager] 从 AlphaTex 字符串加载失败:', error);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});
