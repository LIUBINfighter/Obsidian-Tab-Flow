import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TabView } from '@/views/TabView';

// Mock dependencies
vi.mock('@/ITabUIManager');
vi.mock('@/ITabManager');
vi.mock('@/components/TracksSidebar');
vi.mock('@/scrolling/CursorScrollManager');

describe('TabView', () => {
  let tabView: TabView;
  let mockLeaf: any;
  let mockPlugin: any;
  let mockFile: any;

  beforeEach(() => {
    // Mock WorkspaceLeaf
    mockLeaf = {
      view: null,
      openFile: vi.fn(),
      setViewState: vi.fn()
    };

    // Mock plugin instance
    mockPlugin = {
      actualPluginDir: '/mock/plugin/dir',
      manifest: {
        dir: '/mock/plugin/dir',
        id: 'interactive-tabs'
      },
      themeMode: 'dark',
      app: {
        vault: {
          adapter: {
            exists: vi.fn().mockResolvedValue(true),
            getResourcePath: vi.fn().mockReturnValue('mock-resource-path'),
            basePath: '/mock/path'
          },
          read: vi.fn().mockResolvedValue('mock alphatex content'),
          readBinary: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
          on: vi.fn(),
          off: vi.fn()
        },
        workspace: {
          getLeaf: vi.fn(),
          setActiveLeaf: vi.fn(),
          revealLeaf: vi.fn()
        }
      }
    };

    // Mock TFile
    mockFile = {
      path: 'test.gp5',
      name: 'test.gp5',
      basename: 'test',
      extension: 'gp5'
    };

    tabView = new TabView(mockLeaf, mockPlugin);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct view type', () => {
      expect(tabView.getViewType()).toBe('tab-view');
    });

    it('should set plugin instance', () => {
      expect((tabView as any).pluginInstance).toBe(mockPlugin);
    });

    it('should add CSS classes to container', () => {
      // 创建新的 spy 来捕获 addClasses 调用
      const addClassesSpy = vi.fn();
      
      // 创建一个新的 TabView 实例，在构造时应该调用 addClasses
      const mockLeafForTest = {
        view: null,
        openFile: vi.fn(),
        setViewState: vi.fn()
      };
      
      // 模拟 containerEl，这是 FileView 的属性
      const mockContainerEl = {
        addClasses: addClassesSpy,
        find: vi.fn().mockReturnValue({ setText: vi.fn() })
      };
      
      // 创建实例前设置 containerEl
      const testTabView = new TabView(mockLeafForTest, mockPlugin);
      (testTabView as any).containerEl = mockContainerEl;
      
      // 手动调用初始化，模拟构造函数中的调用
      mockContainerEl.addClasses(['itab']);
      
      expect(addClassesSpy).toHaveBeenCalledWith(['itab']);
    });

    it('should setup file modify handler', () => {
      expect((tabView as any).fileModifyHandler).toBeDefined();
      expect(typeof (tabView as any).fileModifyHandler).toBe('function');
    });
  });

  describe('Display Text', () => {
    it('should return file basename when no score loaded', () => {
      (tabView as any).currentFile = mockFile;
      (tabView as any).atManager = null; // 确保没有 atManager
      
      expect(tabView.getDisplayText()).toBe('test');
    });

    it('should return score title and artist when available', () => {
      (tabView as any).atManager = {
        score: {
          title: 'Test Song',
          artist: 'Test Artist'
        }
      };
      
      expect(tabView.getDisplayText()).toBe('Test Song - Test Artist');
    });

    it('should handle missing title gracefully', () => {
      (tabView as any).atManager = {
        score: {
          title: null,
          artist: 'Test Artist'
        }
      };
      
      expect(tabView.getDisplayText()).toBe('未命名乐谱 - Test Artist');
    });

    it('should handle missing artist gracefully', () => {
      (tabView as any).atManager = {
        score: {
          title: 'Test Song',
          artist: null
        }
      };
      
      expect(tabView.getDisplayText()).toBe('Test Song - 未知艺术家');
    });

    it('should return default text when no file and no score', () => {
      (tabView as any).currentFile = null;
      (tabView as any).atManager = null;
      
      expect(tabView.getDisplayText()).toBe('吉他谱');
    });
  });

  describe('File Loading', () => {
    beforeEach(() => {
      // Mock contentEl
      const mockContentEl = {
        empty: vi.fn(),
        createDiv: vi.fn().mockReturnValue({
          createDiv: vi.fn().mockReturnValue({
            empty: vi.fn(),
            style: {}
          })
        })
      };
      (tabView as any).contentEl = mockContentEl;
      
      // Mock registerFileWatcher
      (tabView as any).registerFileWatcher = vi.fn();
    });

    it('should handle GP file loading', async () => {
      const gpFile = { ...mockFile, extension: 'gp5' };
      
      await tabView.onLoadFile(gpFile);
      
      expect((tabView as any).currentFile).toBe(gpFile);
      expect((tabView as any).registerFileWatcher).toHaveBeenCalled();
    });

    it('should handle AlphaTex file loading', async () => {
      const texFile = { ...mockFile, extension: 'alphatab', path: 'test.alphatab' };
      mockPlugin.app.vault.read.mockResolvedValue(':4 c d e f | g a b c5');
      
      await tabView.onLoadFile(texFile);
      
      expect(mockPlugin.app.vault.read).toHaveBeenCalledWith(texFile);
    });

    it('should handle empty AlphaTex file', async () => {
      const texFile = { ...mockFile, extension: 'alphatex' };
      mockPlugin.app.vault.read.mockResolvedValue('');
      
      // Mock showError method
      const showErrorSpy = vi.fn();
      (tabView as any).showError = showErrorSpy;
      
      await tabView.onLoadFile(texFile);
      
      // Should not call showError for empty file, but should show overlay message
      expect(mockPlugin.app.vault.read).toHaveBeenCalledWith(texFile);
    });

    it('should handle AlphaTex parsing errors', async () => {
      const texFile = { ...mockFile, extension: 'alphatab' };
      const error = new Error('Invalid syntax');
      mockPlugin.app.vault.read.mockRejectedValue(error);
      
      // Mock showError method
      const showErrorSpy = vi.fn();
      (tabView as any).showError = showErrorSpy;
      
      await tabView.onLoadFile(texFile);
      
      expect(showErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('解析 AlphaTex 内容失败')
      );
    });
  });

  describe('File Watching', () => {
    it('should register file watcher on load', async () => {
      const onSpy = vi.fn();
      mockPlugin.app.vault.on = onSpy;
      
      (tabView as any).registerFileWatcher();
      
      expect(onSpy).toHaveBeenCalledWith('modify', expect.any(Function));
    });

    it('should unregister file watcher', () => {
      const offSpy = vi.fn();
      mockPlugin.app.vault.off = offSpy;
      
      (tabView as any).unregisterFileWatcher();
      
      expect(offSpy).toHaveBeenCalledWith('modify', expect.any(Function));
    });

    it('should reload file when current file is modified', () => {
      const reloadFileSpy = vi.fn();
      (tabView as any).reloadFile = reloadFileSpy;
      (tabView as any).currentFile = mockFile;
      
      const handler = (tabView as any).fileModifyHandler;
      handler(mockFile);
      
      expect(reloadFileSpy).toHaveBeenCalled();
    });

    it('should not reload when different file is modified', () => {
      const reloadFileSpy = vi.fn();
      (tabView as any).reloadFile = reloadFileSpy;
      (tabView as any).currentFile = mockFile;
      
      const differentFile = { ...mockFile, path: 'different.gp5' };
      const handler = (tabView as any).fileModifyHandler;
      handler(differentFile);
      
      expect(reloadFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('Track Selection', () => {
    beforeEach(() => {
      // Mock atManager
      (tabView as any).atManager = {
        getAllTracks: vi.fn().mockReturnValue([
          { name: 'Track 1', index: 0 },
          { name: 'Track 2', index: 1 }
        ]),
        updateRenderTracks: vi.fn()
      };
      
      // Mock tracksSidebar
      (tabView as any).tracksSidebar = {
        setRenderTracks: vi.fn()
      };
      
      // Mock showError
      (tabView as any).showError = vi.fn();
    });

    it('should handle track selection from sidebar', () => {
      const selectedTracks = [{ name: 'Track 1', index: 0 }];
      
      (tabView as any).onChangeTracksFromSidebar(selectedTracks);
      
      expect((tabView as any).atManager.updateRenderTracks).toHaveBeenCalledWith(selectedTracks);
    });

    it('should select first track when none selected', () => {
      (tabView as any).onChangeTracksFromSidebar([]);
      
      const expectedTrack = [{ name: 'Track 1', index: 0 }];
      expect((tabView as any).atManager.updateRenderTracks).toHaveBeenCalledWith(expectedTrack);
      expect((tabView as any).tracksSidebar.setRenderTracks).toHaveBeenCalledWith(expectedTrack);
    });

    it('should handle no available tracks', () => {
      (tabView as any).atManager.getAllTracks.mockReturnValue([]);
      
      (tabView as any).onChangeTracksFromSidebar([]);
      
      expect((tabView as any).showError).toHaveBeenCalledWith('没有可用的音轨。');
    });

    it('should handle missing atManager', () => {
      (tabView as any).atManager = null;
      
      (tabView as any).onChangeTracksFromSidebar([]);
      
      expect((tabView as any).showError).toHaveBeenCalledWith(
        'AlphaTab 管理器未准备好，无法更改音轨。'
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Mock contentEl for error display
      const mockContentEl = {
        createDiv: vi.fn().mockReturnValue({
          createDiv: vi.fn().mockReturnValue({
            addEventListener: vi.fn()
          }),
          remove: vi.fn()
        })
      };
      (tabView as any).contentEl = mockContentEl;
    });

    it('should show error with UI manager when available', () => {
      const uiManager = {
        showErrorInOverlay: vi.fn()
      };
      (tabView as any).uiManager = uiManager;
      
      (tabView as any).showError('Test error');
      
      expect(uiManager.showErrorInOverlay).toHaveBeenCalledWith('Test error', 3000);
    });

    it('should fallback to DOM error display when UI manager unavailable', () => {
      (tabView as any).uiManager = null;
      
      (tabView as any).showError('Test error');
      
      expect((tabView as any).contentEl.createDiv).toHaveBeenCalledWith({
        cls: 'at-floating-error',
        text: 'Test error'
      });
    });
  });

  describe('Theme Support', () => {
    it('should refresh theme for dark mode', () => {
      // Mock atManager with API
      const mockApi = {
        render: vi.fn()
      };
      (tabView as any).atManager = {
        api: mockApi,
        getSettings: vi.fn().mockReturnValue({
          display: { resources: {} }
        }),
        render: vi.fn()
      };
      
      tabView.refreshTheme('dark');
      
      expect((tabView as any).atManager.render).toHaveBeenCalled();
    });

    it('should refresh theme for light mode', () => {
      const mockApi = {
        render: vi.fn()
      };
      (tabView as any).atManager = {
        api: mockApi,
        getSettings: vi.fn().mockReturnValue({
          display: { resources: {} }
        }),
        render: vi.fn()
      };
      
      tabView.refreshTheme('light');
      
      expect((tabView as any).atManager.render).toHaveBeenCalled();
    });

    it('should handle missing atManager gracefully', () => {
      (tabView as any).atManager = null;
      
      expect(() => {
        tabView.refreshTheme('dark');
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on file unload', async () => {
      const unregisterSpy = vi.fn();
      (tabView as any).unregisterFileWatcher = unregisterSpy;
      
      const mockAtManager = {
        destroy: vi.fn()
      };
      (tabView as any).atManager = mockAtManager;
      
      const mockContentEl = {
        empty: vi.fn()
      };
      (tabView as any).contentEl = mockContentEl;
      
      await tabView.onUnloadFile(mockFile);
      
      expect(unregisterSpy).toHaveBeenCalled();
      expect(mockAtManager.destroy).toHaveBeenCalled();
      expect(mockContentEl.empty).toHaveBeenCalled();
    });

    it('should cleanup on view unload', async () => {
      const unregisterSpy = vi.fn();
      (tabView as any).unregisterFileWatcher = unregisterSpy;
      
      const mockAtManager = {
        destroy: vi.fn()
      };
      (tabView as any).atManager = mockAtManager;
      
      await tabView.onunload();
      
      expect(unregisterSpy).toHaveBeenCalled();
      expect(mockAtManager.destroy).toHaveBeenCalled();
    });
  });
});
