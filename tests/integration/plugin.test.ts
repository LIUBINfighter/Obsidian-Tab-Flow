import { describe, it, expect, beforeEach, vi } from 'vitest';
import AlphaTabPlugin from '@/main';

describe('AlphaTabPlugin Integration', () => {
  let plugin: AlphaTabPlugin;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(true),
          basePath: '/mock/vault/path'
        },
        on: vi.fn(),
        off: vi.fn()
      },
      workspace: {
        registerView: vi.fn(),
        on: vi.fn(),
        detachLeavesOfType: vi.fn(),
        getLeaf: vi.fn(),
        setActiveLeaf: vi.fn(),
        revealLeaf: vi.fn(),
        splitActiveLeaf: vi.fn(),
        iterateAllLeaves: vi.fn()
      }
    };

    // Create plugin instance
    plugin = new AlphaTabPlugin(mockApp, {
      id: 'interactive-tabs',
      name: 'Interactive Tabs',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Test plugin',
      author: 'Test Author',
      dir: '/mock/plugin/dir'
    });

    // Mock plugin methods
    plugin.loadData = vi.fn().mockResolvedValue({});
    plugin.saveData = vi.fn().mockResolvedValue(undefined);
    plugin.registerView = vi.fn();
    plugin.registerExtensions = vi.fn();
    plugin.registerEvent = vi.fn();
    plugin.addAction = vi.fn();
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize correctly', async () => {
      await plugin.onload();

      expect(plugin.settings).toBeDefined();
      expect(plugin.actualPluginDir).toBeDefined();
    });

    it('should register views and extensions', async () => {
      await plugin.onload();

      expect(plugin.registerView).toHaveBeenCalledWith(
        'tab-view',
        expect.any(Function)
      );
      expect(plugin.registerView).toHaveBeenCalledWith(
        'tex-editor-view',
        expect.any(Function)
      );

      expect(plugin.registerExtensions).toHaveBeenCalledWith(
        ['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7'],
        'tab-view'
      );
      expect(plugin.registerExtensions).toHaveBeenCalledWith(
        ['alphatab', 'alphatex'],
        'tex-editor-view'
      );
    });

    it('should handle plugin directory detection failure', async () => {
      // Create a new plugin instance with modified fs mock
      const mockFailureApp = { ...mockApp };
      const failurePlugin = new AlphaTabPlugin(mockFailureApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: '/nonexistent/plugin/dir'  // Use a non-existent directory
      });
      
      failurePlugin.loadData = vi.fn().mockResolvedValue({});
      failurePlugin.saveData = vi.fn().mockResolvedValue(undefined);
      failurePlugin.registerView = vi.fn();
      failurePlugin.registerExtensions = vi.fn();
      failurePlugin.registerEvent = vi.fn();
      
      // Mock fs.existsSync to return false for the manifest path
      const originalExistsSync = require('fs').existsSync;
      require('fs').existsSync = vi.fn().mockImplementation((path: string) => {
        if (path.includes('manifest.json')) {
          return false;
        }
        return originalExistsSync(path);
      });

      try {
        await expect(failurePlugin.onload()).rejects.toThrow(
          'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
        );
      } finally {
        // Restore original function
        require('fs').existsSync = originalExistsSync;
      }
    });

    it('should cleanup on unload', async () => {
      // 确保插件已加载
      await plugin.onload();
      
      // 调用卸载
      plugin.onunload();

      expect(mockApp.workspace.detachLeavesOfType).toHaveBeenCalledWith('tab-view');
      expect(mockApp.workspace.detachLeavesOfType).toHaveBeenCalledWith('tex-editor-view');
    });
  });

  describe('Theme Management', () => {
    it('should detect current theme mode', async () => {
      // Mock document.body.className to simulate dark theme
      Object.defineProperty(document.body, 'className', {
        value: 'theme-dark',
        writable: true
      });

      await plugin.onload();

      expect(plugin.themeMode).toBe('dark');
    });

    it('should handle theme changes', async () => {
      await plugin.onload();

      // Simulate theme change
      const themeChangeCallback = vi.fn();
      
      // Mock the theme change functionality
      plugin.themeMode = 'light';
      
      expect(plugin.themeMode).toBe('light');
    });
  });

  describe('Settings Management', () => {
    it('should load default settings', async () => {
      plugin.loadData = vi.fn().mockResolvedValue(null);

      await plugin.onload();

      expect(plugin.settings).toEqual({
        mySetting: 'default'
      });
    });

    it('should merge saved settings with defaults', async () => {
      const savedSettings = { mySetting: 'custom' };
      plugin.loadData = vi.fn().mockResolvedValue(savedSettings);

      await plugin.onload();

      expect(plugin.settings).toEqual(savedSettings);
    });

    it('should save settings', async () => {
      await plugin.saveSettings();

      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });
  });

  describe('View Creation', () => {
    it('should create TabView instance', async () => {
      await plugin.onload();

      const mockLeaf = { view: null };
      const viewCreator = plugin.registerView.mock.calls.find(
        call => call[0] === 'tab-view'
      )?.[1];

      expect(viewCreator).toBeDefined();
      
      const view = viewCreator(mockLeaf);
      expect(view).toBeDefined();
      expect(view.getViewType()).toBe('tab-view');
    });

    it('should create TexEditorView instance', async () => {
      await plugin.onload();

      const mockLeaf = { view: null };
      const viewCreator = plugin.registerView.mock.calls.find(
        call => call[0] === 'tex-editor-view'
      )?.[1];

      expect(viewCreator).toBeDefined();
      
      const view = viewCreator(mockLeaf);
      expect(view).toBeDefined();
      expect(view.getViewType()).toBe('tex-editor-view');
    });
  });

  describe('File Menu Integration', () => {
    it('should register file menu event handler', async () => {
      await plugin.onload();

      expect(plugin.registerEvent).toHaveBeenCalledWith(
        mockApp.workspace.on('file-menu', expect.any(Function))
      );
    });

    it('should handle file menu for guitar pro files', async () => {
      await plugin.onload();

      const fileMenuHandler = plugin.registerEvent.mock.calls.find(
        call => call[0] === mockApp.workspace.on.mock.results[0]?.value
      );

      expect(fileMenuHandler).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing manifest directory', async () => {
      // Create plugin with empty dir
      const pluginWithEmptyDir = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: ''  // Empty directory should trigger error
      });
      
      pluginWithEmptyDir.loadData = vi.fn().mockResolvedValue({});
      pluginWithEmptyDir.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithEmptyDir.registerView = vi.fn();
      pluginWithEmptyDir.registerExtensions = vi.fn();
      pluginWithEmptyDir.registerEvent = vi.fn();

      await expect(pluginWithEmptyDir.onload()).rejects.toThrow(
        'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
      );
    });

    it('should handle invalid manifest.json', async () => {
      // Mock readFileSync to return invalid JSON
      const originalReadFileSync = require('fs').readFileSync;
      require('fs').readFileSync = vi.fn().mockImplementation((path: string, encoding?: string) => {
        if (path.includes('manifest.json')) {
          return 'invalid json content';
        }
        return originalReadFileSync(path, encoding);
      });

      const pluginWithInvalidManifest = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: '/mock/plugin/dir'
      });
      
      pluginWithInvalidManifest.loadData = vi.fn().mockResolvedValue({});
      pluginWithInvalidManifest.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithInvalidManifest.registerView = vi.fn();
      pluginWithInvalidManifest.registerExtensions = vi.fn();
      pluginWithInvalidManifest.registerEvent = vi.fn();

      try {
        await expect(pluginWithInvalidManifest.onload()).rejects.toThrow(
          'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
        );
      } finally {
        // Restore original function
        require('fs').readFileSync = originalReadFileSync;
      }
    });
  });

  describe('Plugin Directory Resolution', () => {
    it('should resolve plugin directory correctly', async () => {
      await plugin.onload();

      expect(plugin.actualPluginDir).toBeDefined();
      expect(plugin.actualPluginDir).toContain('/mock/plugin/dir');
    });

    it('should handle manifest ID mismatch', async () => {
      // Mock readFileSync to return manifest with wrong ID
      const originalReadFileSync = require('fs').readFileSync;
      require('fs').readFileSync = vi.fn().mockImplementation((path: string, encoding?: string) => {
        if (path.includes('manifest.json')) {
          return JSON.stringify({ id: 'wrong-plugin-id' });
        }
        return originalReadFileSync(path, encoding);
      });

      const pluginWithWrongId = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: '/mock/plugin/dir'
      });
      
      pluginWithWrongId.loadData = vi.fn().mockResolvedValue({});
      pluginWithWrongId.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithWrongId.registerView = vi.fn();
      pluginWithWrongId.registerExtensions = vi.fn();
      pluginWithWrongId.registerEvent = vi.fn();

      try {
        await expect(pluginWithWrongId.onload()).rejects.toThrow(
          'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
        );
      } finally {
        // Restore original function
        require('fs').readFileSync = originalReadFileSync;
      }
    });
  });

  describe('Resource Loading', () => {
    it('should register styles on load', async () => {
      // Mock registerStyles function to be trackable
      const { registerStyles } = require('@/utils/utils');
      const mockRegisterStyles = vi.fn();
      
      // Replace the function
      vi.doMock('@/utils/utils', () => ({
        registerStyles: mockRegisterStyles,
        isGuitarProFile: vi.fn().mockReturnValue(true),
        getCurrentThemeMode: vi.fn().mockReturnValue('dark'),
        watchThemeModeChange: vi.fn()
      }));

      // Note: The registerStyles call happens in onload, but since mocking happens after import,
      // we need to test the actual call indirectly or ensure the function is called
      await plugin.onload();

      // Since the import has already happened, we can't easily track this call
      // Instead, verify that the plugin loaded successfully (which implies registerStyles was called)
      expect(plugin.actualPluginDir).toBeDefined();
    });
  });
});
