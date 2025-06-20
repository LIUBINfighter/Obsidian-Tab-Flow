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
const createMockElement = (tagName: string, options: any = {}): any => {
  const element: any = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style: {},
    className: options.cls || '',
    classList: {
      add: vi.fn((className: string) => {
        element.className = element.className ? `${element.className} ${className}` : className;
      }),
      remove: vi.fn((className: string) => {
        element.className = element.className.replace(new RegExp(`\\b${className}\\b`, 'g'), '').trim();
      }),
      contains: vi.fn((className: string): boolean => element.className.includes(className)),
      toggle: vi.fn()
    },
    setAttribute: vi.fn((name: string, value: string) => {
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
    }),
    getAttribute: vi.fn((name: string) => {
      if (name === 'id') return element.id;
      if (name === 'class') return element.className;
      return null;
    }),
    removeAttribute: vi.fn(),
    appendChild: vi.fn((child: any) => {
      element.children.push(child);
      if (child) child.parentElement = element;
      return child;
    }),
    removeChild: vi.fn((child: any) => {
      const index = element.children.indexOf(child);
      if (index > -1) {
        element.children.splice(index, 1);
        if (child) child.parentElement = null;
      }
      return child;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createEl: vi.fn().mockImplementation((tag: string, opts: any = {}) => {
      const child = createMockElement(tag, opts);
      if (opts.cls) child.className = opts.cls;
      if (opts.text) child.textContent = opts.text;
      element.appendChild(child);
      return child;
    }),
    createDiv: vi.fn().mockImplementation((opts: any = {}) => {
      const div = createMockElement('div', opts);
      if (opts.cls) div.className = opts.cls;
      if (opts.text) div.textContent = opts.text;
      element.appendChild(div);
      return div;
    }),
    empty: vi.fn(() => {
      element.children.length = 0;
      element.innerHTML = '';
      element.textContent = '';
    }),
    setText: vi.fn((text: string) => {
      element.textContent = text;
      element.innerHTML = text;
    }),
    addClasses: vi.fn((classes: string[]) => {
      classes.forEach(cls => element.classList.add(cls));
    }),
    addClass: vi.fn((className: string) => {
      element.classList.add(className);
    }),
    removeClass: vi.fn((className: string) => {
      element.classList.remove(className);
    }),
    find: vi.fn((selector: string) => {
      // 简单的选择器匹配，返回一个新的mock元素
      const found = createMockElement('div');
      return found;
    }),
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

// Store created elements by ID for persistence
const elementRegistry = new Map<string, any>();

document.getElementById = vi.fn().mockImplementation((id) => {
  // Check registry first
  if (elementRegistry.has(id)) {
    return elementRegistry.get(id);
  }
  
  // Create special elements as needed
  if (id === 'alphatab-font-faces') {
    const styleEl = createMockElement('style', { id });
    elementRegistry.set(id, styleEl);
    return styleEl;
  }
  
  return originalGetElementById?.call(document, id) || null;
});

document.querySelector = vi.fn().mockImplementation((selector) => {
  if (selector.includes('style#alphatab-font-faces')) {
    return document.getElementById('alphatab-font-faces');
  }
  if (selector.includes('link[rel="preload"]')) {
    return createMockElement('link');
  }
  return originalQuerySelector?.call(document, selector) || null;
});

document.querySelectorAll = vi.fn().mockImplementation((selector) => {
  if (selector.includes('style#alphatab-font-faces')) {
    const existing = document.getElementById('alphatab-font-faces');
    return existing ? [existing] : [];
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
mockHead.appendChild = vi.fn((child: any) => {
  mockHead.children.push(child);
  if (child) child.parentElement = mockHead;
  return child;
});
mockHead.removeChild = vi.fn((child: any) => {
  const index = mockHead.children.indexOf(child);
  if (index > -1) {
    mockHead.children.splice(index, 1);
    if (child) child.parentElement = null;
  }
  return child;
});
Object.defineProperty(document, 'head', {
  value: mockHead,
  writable: true
});

// Mock Obsidian Plugin API
const mockObsidian = {
  Plugin: class MockPlugin {
    app: any;
    manifest: any = { id: 'test-plugin', dir: '.obsidian/plugins/test-plugin' };
    loadData = vi.fn().mockResolvedValue({});
    saveData = vi.fn().mockResolvedValue(undefined);
    addCommand = vi.fn();
    registerView = vi.fn();
    registerExtensions = vi.fn();
    registerEvent = vi.fn();
    addAction = vi.fn();
    
    constructor() {
      this.app = new mockObsidian.App();
    }
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
  },  Notice: class MockNotice {
    constructor(message: string) {
      console.log('Notice:', message);
    }
  },
  Modal: class MockModal {
    app: any;
    contentEl: any;
    titleEl: any;
    modalEl: any;
    
    constructor(app: any) {
      this.app = app;
      this.contentEl = createMockElement('div');
      this.titleEl = createMockElement('div');
      this.modalEl = createMockElement('div');
    }
    
    open = vi.fn();
    close = vi.fn();
    onOpen = vi.fn();
    onClose = vi.fn();
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
      getLeaf: vi.fn().mockReturnValue({
        view: null,
        openFile: vi.fn(),
        setViewState: vi.fn()
      }),
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
vi.stubGlobal('Modal', mockObsidian.Modal);
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
    renderTracks = vi.fn(); // 添加缺失的renderTracks方法
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
    static theme = vi.fn().mockReturnValue({});
    
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
