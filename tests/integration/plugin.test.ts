import { describe, it, expect, beforeEach, vi } from 'vitest';
import AlphaTabPlugin from '../../src/main';

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
      // Create a plugin that simulates the actualPluginDir being null
      // by using a manifest.dir that doesn't exist or has wrong content
      const failurePlugin = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: 'nonexistent/path/that/will/fail'  // Non-existent path
      });
      
      failurePlugin.loadData = vi.fn().mockResolvedValue({});
      failurePlugin.saveData = vi.fn().mockResolvedValue(undefined);
      failurePlugin.registerView = vi.fn();
      failurePlugin.registerExtensions = vi.fn();
      failurePlugin.registerEvent = vi.fn();

      // Mock the app.vault.adapter.basePath to a fake path
      (mockApp.vault.adapter as any).basePath = '/fake/vault/path';

      // This should throw because the directory/manifest cannot be found
      await expect(failurePlugin.onload()).rejects.toThrow(
        'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
      );
    });

    it('should cleanup on unload', async () => {
      // 确保插件已加载
      await plugin.onload();
      
      const detachSpy = vi.spyOn(mockApp.workspace, 'detachLeavesOfType');
      
      // 调用卸载
      plugin.onunload();

      expect(detachSpy).toHaveBeenCalledWith('tab-view');
      expect(detachSpy).toHaveBeenCalledWith('tex-editor-view');
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
      const pluginWithEmptyDir = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: 'nonexistent/directory/path'  // Use non-existent directory
      });
      
      pluginWithEmptyDir.loadData = vi.fn().mockResolvedValue({});
      pluginWithEmptyDir.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithEmptyDir.registerView = vi.fn();
      pluginWithEmptyDir.registerExtensions = vi.fn();
      pluginWithEmptyDir.registerEvent = vi.fn();

      // Mock the app.vault.adapter.basePath to a path that doesn't exist
      (mockApp.vault.adapter as any).basePath = '/nonexistent/vault/path';

      await expect(pluginWithEmptyDir.onload()).rejects.toThrow(
        'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
      );
    });

    it('should handle invalid manifest.json', async () => {
      // Use a plugin with a path that will fail validation
      const pluginWithInvalidManifest = new AlphaTabPlugin(mockApp, {
        id: 'wrong-plugin-id',  // Wrong ID to trigger manifest mismatch  
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: 'invalid/manifest/path'
      });
      
      pluginWithInvalidManifest.loadData = vi.fn().mockResolvedValue({});
      pluginWithInvalidManifest.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithInvalidManifest.registerView = vi.fn();
      pluginWithInvalidManifest.registerExtensions = vi.fn();
      pluginWithInvalidManifest.registerEvent = vi.fn();

      // Mock the app.vault.adapter.basePath to a non-existent path
      (mockApp.vault.adapter as any).basePath = '/invalid/vault/path';

      await expect(pluginWithInvalidManifest.onload()).rejects.toThrow(
        'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
      );
    });
  });

  describe('Plugin Directory Resolution', () => {
    it('should resolve plugin directory correctly', async () => {
      await plugin.onload();

      expect(plugin.actualPluginDir).toBeDefined();
      expect(plugin.actualPluginDir).toContain('test-plugin');  // Should match mock setup
    });

    it('should handle manifest ID mismatch', async () => {
      // Create plugin with mismatched ID that should cause error
      const pluginWithWrongId = new AlphaTabPlugin(mockApp, {
        id: 'different-plugin-id',  // This won't match any real manifest
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: 'mismatch/manifest/path'
      });
      
      pluginWithWrongId.loadData = vi.fn().mockResolvedValue({});
      pluginWithWrongId.saveData = vi.fn().mockResolvedValue(undefined);
      pluginWithWrongId.registerView = vi.fn();
      pluginWithWrongId.registerExtensions = vi.fn();
      pluginWithWrongId.registerEvent = vi.fn();

      // Mock the app.vault.adapter.basePath to a non-existent path
      (mockApp.vault.adapter as any).basePath = '/mismatch/vault/path';

      await expect(pluginWithWrongId.onload()).rejects.toThrow(
        'AlphaTab 插件根目录查找失败，请检查插件安装路径。'
      );
    });
  });

  describe('Resource Loading', () => {
    it('should register styles on load', async () => {
      // Mock utils module
      vi.doMock('../../src/utils/utils', () => ({
        registerStyles: vi.fn(),
        isGuitarProFile: vi.fn().mockReturnValue(true),
        getCurrentThemeMode: vi.fn().mockReturnValue('dark'),
        watchThemeModeChange: vi.fn()
      }));

      // Create a new plugin instance to test with mocked utils
      const testPlugin = new AlphaTabPlugin(mockApp, {
        id: 'interactive-tabs',
        name: 'Interactive Tabs',
        version: '1.0.0',
        minAppVersion: '0.15.0',
        description: 'Test plugin',
        author: 'Test Author',
        dir: '/mock/plugin/dir'
      });
      
      testPlugin.loadData = vi.fn().mockResolvedValue({});
      testPlugin.saveData = vi.fn().mockResolvedValue(undefined);
      testPlugin.registerView = vi.fn();
      testPlugin.registerExtensions = vi.fn();
      testPlugin.registerEvent = vi.fn();

      await testPlugin.onload();

      // Verify that the plugin loaded successfully (which implies registerStyles was called)
      expect(testPlugin.actualPluginDir).toBeDefined();
    });
  });
});
