import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Obsidian API
global.require = require;

// Mock DOM globals
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Enhanced DOM mocking for better element creation
const createMockElement = (tagName: string, options: any = {}) => {
  const element = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn()
    },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createEl: vi.fn().mockImplementation((tag, opts) => createMockElement(tag, opts)),
    id: options.id || '',
    disabled: false,
    hidden: false,
    children: [],
    parentElement: null,
    querySelector: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([]),
    ...options
  };
  return element;
};

// Mock document methods
const originalGetElementById = document.getElementById;
const originalQuerySelector = document.querySelector; 
const originalQuerySelectorAll = document.querySelectorAll;
const originalCreateElement = document.createElement;

document.getElementById = vi.fn().mockImplementation((id) => {
  if (id === 'alphatab-font-faces') {
    return createMockElement('style', { id });
  }
  return originalGetElementById?.call(document, id) || null;
});

document.querySelector = vi.fn().mockImplementation((selector) => {
  if (selector.includes('link[rel="preload"]')) {
    return createMockElement('link');
  }
  return originalQuerySelector?.call(document, selector) || null;
});

document.querySelectorAll = vi.fn().mockImplementation((selector) => {
  if (selector.includes('style#alphatab-font-faces')) {
    return [];
  }
  if (selector.includes('link[rel="preload"]')) {
    return [];
  }
  return originalQuerySelectorAll?.call(document, selector) || [];
});

document.createElement = vi.fn().mockImplementation((tagName) => {
  return createMockElement(tagName);
});

// Mock head operations
const mockHead = createMockElement('head');
mockHead.appendChild = vi.fn();
mockHead.removeChild = vi.fn();
Object.defineProperty(document, 'head', {
  value: mockHead,
  writable: true
});

// Mock Obsidian Plugin API
const mockObsidian = {
  Plugin: class MockPlugin {
    app: any;
    manifest: any;
    loadData = vi.fn();
    saveData = vi.fn();
    addCommand = vi.fn();
    registerView = vi.fn();
    registerExtensions = vi.fn();
    registerEvent = vi.fn();
    addAction = vi.fn();
  },
  FileView: class MockFileView {
    leaf: any;
    containerEl: any = { 
      addClasses: vi.fn(),
      find: vi.fn().mockReturnValue({ setText: vi.fn() }),
      createDiv: vi.fn().mockReturnValue(createMockElement('div')),
      createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts)),
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      classList: { add: vi.fn(), remove: vi.fn() }
    };
    contentEl: any = {
      empty: vi.fn(),
      createDiv: vi.fn().mockReturnValue(createMockElement('div')),
      createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts)),
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      style: {},
      classList: { add: vi.fn(), remove: vi.fn() }
    };
    constructor(leaf: any) {
      this.leaf = leaf;
    }
    onLoadFile = vi.fn();
    onUnloadFile = vi.fn();
    getViewType = vi.fn();
    getDisplayText = vi.fn();
  },
  TextFileView: class MockTextFileView {
    leaf: any;
    containerEl: any = { 
      children: [null, { 
        empty: vi.fn(),
        createDiv: vi.fn().mockReturnValue(createMockElement('div')),
        createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts))
      }],
      createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts))
    };
    constructor(leaf: any) {
      this.leaf = leaf;
    }
    getViewData = vi.fn();
    setViewData = vi.fn();
    clear = vi.fn();
  },
  WorkspaceLeaf: class MockWorkspaceLeaf {
    view: any;
    openFile = vi.fn();
    setViewState = vi.fn();
  },
  TFile: class MockTFile {
    path: string;
    name: string;
    basename: string;
    extension: string;
    constructor(path: string) {
      this.path = path;
      this.name = path.split('/').pop() || '';
      this.basename = this.name.split('.')[0];
      this.extension = this.name.split('.').pop() || '';
    }
  },
  Notice: class MockNotice {
    constructor(message: string) {
      console.log('Notice:', message);
    }
  },
  App: class MockApp {
    vault = {
      adapter: {
        exists: vi.fn(),
        getResourcePath: vi.fn(),
        basePath: '/mock/path'
      },
      read: vi.fn(),
      readBinary: vi.fn(),
      create: vi.fn(),
      getAbstractFileByPath: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    };
    workspace = {
      getLeaf: vi.fn(),
      setActiveLeaf: vi.fn(),
      revealLeaf: vi.fn(),
      splitActiveLeaf: vi.fn(),
      on: vi.fn(),
      iterateAllLeaves: vi.fn(),
      detachLeavesOfType: vi.fn()
    };
  }
};

// Make Obsidian available globally
vi.stubGlobal('Plugin', mockObsidian.Plugin);
vi.stubGlobal('FileView', mockObsidian.FileView);
vi.stubGlobal('TextFileView', mockObsidian.TextFileView);
vi.stubGlobal('WorkspaceLeaf', mockObsidian.WorkspaceLeaf);
vi.stubGlobal('TFile', mockObsidian.TFile);
vi.stubGlobal('Notice', mockObsidian.Notice);
vi.stubGlobal('App', mockObsidian.App);

// Mock AlphaTab
const mockAlphaTab = {
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
      this.settings = settings || new mockAlphaTab.Settings();
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
      title = 'Mock Score';
      artist = 'Mock Artist';
      tracks = [];
    },
    Track: class MockTrack {
      name = 'Mock Track';
      index = 0;
    },
    Color: {
      fromJson: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0, a: 255 })
    }
  },
  LayoutMode: {
    Page: 'page',
    Horizontal: 'horizontal'
  },
  LogLevel: {
    Debug: 0,
    Info: 1,
    Warning: 2,
    Error: 3
  },
  Environment: {
    webPlatform: 'browser'
  },
  WebPlatform: {
    Browser: 'browser'
  }
};

vi.stubGlobal('alphaTab', mockAlphaTab);

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...paths) => paths.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  resolve: vi.fn((...paths) => '/' + paths.join('/'))
}));

// Mock CodeMirror
vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn()
  },
  Extension: vi.fn(),
  RangeSetBuilder: vi.fn()
}));

vi.mock('@codemirror/view', () => ({
  EditorView: class MockEditorView {
    constructor(config: any) {}
    state = { doc: { toString: () => '' } };
    dispatch = vi.fn();
    focus = vi.fn();
  },
  keymap: { of: vi.fn() },
  placeholder: vi.fn(),
  Decoration: { mark: vi.fn() },
  ViewPlugin: { fromClass: vi.fn() }
}));
