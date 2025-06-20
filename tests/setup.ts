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
    nodeType: 1, // ELEMENT_NODE - 添加 Node 类型兼容性
    nodeName: tagName.toUpperCase(),
    ownerDocument: document, // 添加 ownerDocument 属性
    parentNode: null,
    childNodes: [],
    classList: {
      add: vi.fn((className: string) => {
        const classes = element.className ? element.className.split(' ').filter(Boolean) : [];
        if (!classes.includes(className)) {
          classes.push(className);
          element.className = classes.join(' ');
        }
      }),
      remove: vi.fn((className: string) => {
        const classes = element.className ? element.className.split(' ').filter(Boolean) : [];
        const index = classes.indexOf(className);
        if (index > -1) {
          classes.splice(index, 1);
          element.className = classes.join(' ');
        }
      }),
      contains: vi.fn((className: string): boolean => {
        const classes = element.className ? element.className.split(' ').filter(Boolean) : [];
        return classes.includes(className);
      }),
      toggle: vi.fn((className: string) => {
        const classes = element.className ? element.className.split(' ').filter(Boolean) : [];
        const index = classes.indexOf(className);
        if (index > -1) {
          classes.splice(index, 1);
        } else {
          classes.push(className);
        }
        element.className = classes.join(' ');
      })
    },
    setAttribute: vi.fn((name: string, value: string) => {
      if (name === 'id') element.id = value;
      if (name === 'class') element.className = value;
      if (name === 'href') element.href = value;
      if (name === 'rel') element.rel = value;
      if (name === 'as') element.as = value;
      if (name === 'crossorigin') element.crossOrigin = value;
      if (name === 'type') element.type = value;
      // Store all attributes in a generic way
      if (!element._attributes) element._attributes = {};
      element._attributes[name] = value;
    }),
    getAttribute: vi.fn((name: string) => {
      if (name === 'id') return element.id;
      if (name === 'class') return element.className;
      if (name === 'href') return element.href;
      if (name === 'rel') return element.rel;
      if (name === 'as') return element.as;
      if (name === 'crossorigin') return element.crossOrigin;
      if (name === 'type') return element.type;
      // Check generic attributes store
      if (element._attributes && element._attributes[name]) {
        return element._attributes[name];
      }
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
    addEventListener: vi.fn((type: string, listener: any) => {
      if (!element._eventListeners) element._eventListeners = {};
      if (!element._eventListeners[type]) element._eventListeners[type] = [];
      element._eventListeners[type].push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: any) => {
      if (element._eventListeners && element._eventListeners[type]) {
        const index = element._eventListeners[type].indexOf(listener);
        if (index > -1) {
          element._eventListeners[type].splice(index, 1);
        }
      }
    }),
    dispatchEvent: vi.fn((event: Event) => {
      // 模拟事件分发
      const eventType = event.type;
      const listeners = element._eventListeners || {};
      const eventListeners = listeners[eventType] || [];
      eventListeners.forEach((listener: any) => {
        if (typeof listener === 'function') {
          listener(event);
        }
      });
      return true;
    }),
    createEl: vi.fn().mockImplementation((tag: string, opts: any = {}) => {
      const child = createMockElement(tag, opts);
      if (opts.cls) child.className = opts.cls;
      if (opts.text) child.textContent = opts.text;
      if (opts.attr) {
        for (const [key, value] of Object.entries(opts.attr)) {
          child.setAttribute(key, value as string);
          // 特殊处理 style 属性
          if (key === 'style' && typeof value === 'string') {
            const styles = value.split(';').filter(s => s.trim());
            styles.forEach(style => {
              const [prop, val] = style.split(':').map(s => s.trim());
              if (prop && val) {
                (child.style as any)[prop] = val;
              }
            });
          }
        }
      }
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
    parentElement: null,    querySelector: vi.fn((selector: string) => {
      // 简单的选择器匹配实现
      if (selector === 'label' && element.tagName === 'DIV') {
        return element.children.find((child: any) => child.tagName === 'LABEL') || null;
      }
      if (selector === 'select' && element.tagName === 'DIV') {
        return element.children.find((child: any) => child.tagName === 'SELECT') || null;
      }
      if (selector === 'option' && element.tagName === 'SELECT') {
        return element.children[0] || null;
      }
      if (selector === '.at-main-ui') {
        return createMockElement('div', { cls: 'at-main-ui' });
      }
      if (selector === '.at-wrap') {
        return element.children.find((child: any) => child.className && child.className.includes('at-wrap')) || null;
      }
      return null;
    }),
    querySelectorAll: vi.fn((selector: string) => {
      // 简单的选择器匹配实现
      if (selector === 'option' && element.tagName === 'SELECT') {
        return element.children.filter((child: any) => child.tagName === 'OPTION');
      }
      return [];
    }),
    // 添加 remove 方法，修复 FontManager 测试
    remove: vi.fn(() => {
      if (element.parentElement) {
        element.parentElement.removeChild(element);
      } else if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      // 从 registry 中移除
      if (element.id) {
        elementRegistry.delete(element.id);
      }
      // 标记元素为已移除，这样 getElementById 就不会再返回它
      element._removed = true;
    }),
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
const removedElements = new Set<string>(); // Track removed elements
const linkElements = new Set<any>(); // Track link elements

// Export for testing
(global as any).linkElements = linkElements;
(global as any).removedElements = removedElements;

document.getElementById = vi.fn().mockImplementation((id) => {
  // Check registry first
  if (elementRegistry.has(id)) {
    const element = elementRegistry.get(id);
    // If element was removed, delete from registry and return null
    if (element._removed) {
      elementRegistry.delete(id);
      return null;
    }
    return element;
  }
  
  // Create special elements as needed
  if (id === 'alphatab-font-faces' || id === 'alphatab-manual-font-styles') {
    const styleEl = createMockElement('style', { id });
    elementRegistry.set(id, styleEl);
    return styleEl;
  }
  
  return originalGetElementById?.call(document, id) || null;
});

document.querySelector = vi.fn().mockImplementation((selector) => {
  if (selector.includes('style#alphatab-font-faces') || selector === '#alphatab-manual-font-styles') {
    return document.getElementById('alphatab-manual-font-styles');
  }
  if (selector.includes('link[rel="preload"]')) {
    // Return the first matching link element
    for (const link of linkElements) {
      if (link.rel === 'preload') {
        return link;
      }
    }
    return null;
  }
  return originalQuerySelector?.call(document, selector) || null;
});

document.querySelectorAll = vi.fn().mockImplementation((selector) => {
  if (selector.includes('style#alphatab-font-faces') || selector === '#alphatab-manual-font-styles') {
    const existing = document.getElementById('alphatab-manual-font-styles');
    return existing ? [existing] : [];
  }
  if (selector.includes('link[rel="preload"]')) {
    // Return all matching link elements
    const matches = [];
    for (const link of linkElements) {
      if (link.rel === 'preload' && link.as === 'font') {
        matches.push(link);
      }
    }
    return matches;
  }
  return originalQuerySelectorAll?.call(document, selector) || [];
});

document.createElement = vi.fn().mockImplementation((tagName) => {
  const element = createMockElement(tagName);
  
  // 为select元素添加特殊属性
  if (tagName.toLowerCase() === 'select') {
    element.value = '';
    Object.defineProperty(element, 'value', {
      get: () => element._value || '',
      set: (val) => { element._value = val; },
      enumerable: true,
      configurable: true
    });
  }
  
  // 为link元素添加特殊处理
  if (tagName.toLowerCase() === 'link') {
    linkElements.add(element);
  }
  
  // 为option元素添加特殊属性
  if (tagName.toLowerCase() === 'option') {
    element.value = '';
    element.selected = false;
    Object.defineProperty(element, 'value', {
      get: () => element._value || '',
      set: (val) => { element._value = val; },
      enumerable: true,
      configurable: true
    });
  }
  
  // 为style元素添加特殊处理
  if (tagName.toLowerCase() === 'style') {
    element.textContent = '';
    element.innerHTML = '';
    element.sheet = {
      insertRule: vi.fn(),
      deleteRule: vi.fn(),
      cssRules: []
    };
    // 当设置 textContent 时，自动注册到 registry
    const originalTextContentSetter = Object.getOwnPropertyDescriptor(element, 'textContent')?.set;
    Object.defineProperty(element, 'textContent', {
      get: () => element._textContent || '',
      set: (value) => {
        element._textContent = value;
        element.innerHTML = value;
        // 如果有 id，注册到 registry
        if (element.id) {
          elementRegistry.set(element.id, element);
        }
      },
      enumerable: true,
      configurable: true
    });
  }
  
  // 为link元素添加特殊处理
  if (tagName.toLowerCase() === 'link') {
    element.rel = '';
    element.href = '';
    element.crossOrigin = '';
    element.as = '';
  }
  
  return element;
});

// Mock head and body operations
const mockHead = createMockElement('head');
mockHead.appendChild = vi.fn((child: any) => {
  if (!child || typeof child !== 'object') {
    console.warn('head.appendChild: invalid child', child);
    return child;
  }
  mockHead.children.push(child);
  if (child) {
    child.parentElement = mockHead;
    // 如果是 style 元素且有 id，注册到 registry
    if (child.tagName === 'STYLE' && child.id) {
      elementRegistry.set(child.id, child);
    }
  }
  return child;
});
mockHead.removeChild = vi.fn((child: any) => {
  const index = mockHead.children.indexOf(child);
  if (index > -1) {
    mockHead.children.splice(index, 1);
    if (child) {
      child.parentElement = null;
      // 从 registry 中移除
      if (child.tagName === 'STYLE' && child.id) {
        elementRegistry.delete(child.id);
      }
    }
  }
  return child;
});

const mockBody = createMockElement('body');
mockBody.appendChild = vi.fn((child: any) => {
  if (!child || typeof child !== 'object') {
    console.warn('appendChild: invalid child', child);
    return child;
  }
  mockBody.children.push(child);
  if (child) child.parentElement = mockBody;
  return child;
});
mockBody.removeChild = vi.fn((child: any) => {
  const index = mockBody.children.indexOf(child);
  if (index > -1) {
    mockBody.children.splice(index, 1);
    if (child) child.parentElement = null;
  }
  return child;
});

// 添加 Node 类型兼容性，修复 MutationObserver 问题
mockBody.nodeType = 1; // ELEMENT_NODE
mockBody.nodeName = 'BODY';
mockBody.firstChild = null;
mockBody.lastChild = null;
mockBody.nextSibling = null;
mockBody.previousSibling = null;
mockBody.contains = vi.fn().mockReturnValue(true);
mockBody.hasChildNodes = vi.fn().mockReturnValue(false);
mockBody.isConnected = true;
mockBody.isDefaultNamespace = vi.fn().mockReturnValue(true);
mockBody.isEqualNode = vi.fn().mockReturnValue(false);
mockBody.isSameNode = vi.fn().mockReturnValue(false);
mockBody.lookupNamespaceURI = vi.fn().mockReturnValue(null);
mockBody.lookupPrefix = vi.fn().mockReturnValue(null);
mockBody.normalize = vi.fn();
mockBody.compareDocumentPosition = vi.fn().mockReturnValue(0);
mockBody.getRootNode = vi.fn().mockReturnValue(document);

mockHead.nodeType = 1; // ELEMENT_NODE
mockHead.nodeName = 'HEAD';
mockHead.firstChild = null;
mockHead.lastChild = null;
mockHead.nextSibling = null;
mockHead.previousSibling = null;
mockHead.contains = vi.fn().mockReturnValue(true);
mockHead.hasChildNodes = vi.fn().mockReturnValue(false);
mockHead.isConnected = true;
mockHead.isDefaultNamespace = vi.fn().mockReturnValue(true);
mockHead.isEqualNode = vi.fn().mockReturnValue(false);
mockHead.isSameNode = vi.fn().mockReturnValue(false);
mockHead.lookupNamespaceURI = vi.fn().mockReturnValue(null);
mockHead.lookupPrefix = vi.fn().mockReturnValue(null);
mockHead.normalize = vi.fn();
mockHead.compareDocumentPosition = vi.fn().mockReturnValue(0);
mockHead.getRootNode = vi.fn().mockReturnValue(document);

Object.defineProperty(document, 'head', {
  value: mockHead,
  writable: true
});

Object.defineProperty(document, 'body', {
  value: mockBody,
  writable: true
});

// Mock Obsidian Plugin API
const mockObsidian = {  Plugin: class MockPlugin {
    app: any;
    manifest: any = { 
      id: 'test-plugin', 
      dir: '.obsidian/plugins/test-plugin',
      name: 'Test Plugin',
      version: '1.0.0'
    };
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
    file: any = null;
    containerEl: any;
    contentEl: any;
    app: any; // 添加 app 属性
    
    constructor(leaf: any) {
      this.leaf = leaf;
      this.app = new mockObsidian.App(); // 初始化 app 属性
      
      // 创建完全可控的 containerEl mock，基于文档建议
      this.containerEl = {
        className: '',
        innerHTML: '',
        style: {},
        tagName: 'DIV',
        children: [],
        addClasses: vi.fn((classes: string[]) => {
          // Mock addClasses method for Obsidian FileView
          classes.forEach(cls => {
            if (!this.containerEl.className.includes(cls)) {
              this.containerEl.className += this.containerEl.className ? ` ${cls}` : cls;
            }
          });
        }),
        addClass: vi.fn((className: string) => {
          if (!this.containerEl.className.includes(className)) {
            this.containerEl.className += this.containerEl.className ? ` ${className}` : className;
          }
        }),
        removeClass: vi.fn((className: string) => {
          this.containerEl.className = this.containerEl.className.replace(new RegExp(`\\b${className}\\b`, 'g'), '').trim();
        }),
        empty: vi.fn(() => {
          this.containerEl.innerHTML = '';
          this.containerEl.children.length = 0;
        }),
        setText: vi.fn((text: string) => {
          this.containerEl.innerHTML = text;
        }),
        createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts)),
        createDiv: vi.fn().mockReturnValue(createMockElement('div')),
        appendChild: vi.fn((child: any) => {
          this.containerEl.children.push(child);
          if (child) child.parentElement = this.containerEl;
          return child;
        }),
        removeChild: vi.fn((child: any) => {
          const index = this.containerEl.children.indexOf(child);
          if (index > -1) {
            this.containerEl.children.splice(index, 1);
            if (child) child.parentElement = null;
          }
          return child;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
        find: vi.fn().mockReturnValue({ setText: vi.fn() }),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
          toggle: vi.fn()
        }
      };
      
      // 创建完全可控的 contentEl mock
      this.contentEl = {
        className: '',
        innerHTML: '',
        style: {},
        tagName: 'DIV',
        children: [],
        empty: vi.fn(() => {
          this.contentEl.innerHTML = '';
          this.contentEl.children.length = 0;
        }),
        setText: vi.fn((text: string) => {
          this.contentEl.innerHTML = text;
        }),
        createEl: vi.fn().mockImplementation((tag: string, opts?: any) => createMockElement(tag, opts)),
        createDiv: vi.fn().mockReturnValue(createMockElement('div')),
        appendChild: vi.fn((child: any) => {
          this.contentEl.children.push(child);
          if (child) child.parentElement = this.contentEl;
          return child;
        }),
        addClasses: vi.fn((classes: string[]) => {
          classes.forEach(cls => {
            if (!this.contentEl.className.includes(cls)) {
              this.contentEl.className += this.contentEl.className ? ` ${cls}` : cls;
            }
          });
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
          toggle: vi.fn()
        }
      };
    }
      onLoadFile = vi.fn((file: any) => {
      this.file = file; // 确保设置 file 属性
      return Promise.resolve();
    });
    onUnloadFile = vi.fn(() => {
      this.file = null; // 清空 file 属性
      return Promise.resolve();
    });
    getViewType = vi.fn(() => 'tab-view'); // 实现 getViewType 方法
    // 移除 getDisplayText 的 Mock，让子类自己实现
    // getDisplayText = vi.fn(() => '吉他谱'); // 这个会覆盖子类的实现！
    getViewData = vi.fn();
    setViewData = vi.fn();
    clear = vi.fn();
    addAction = vi.fn((icon: string, title: string, callback: Function) => {
      // Mock addAction method for Obsidian FileView - adds action buttons to view
      return {
        icon,
        title,
        callback
      };
    });
    load = vi.fn();
    unload = vi.fn();
    onunload = vi.fn(); // 添加 onunload 方法
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
  },  App: class MockApp {    vault = {
      adapter: {
        exists: vi.fn().mockResolvedValue(true),
        getResourcePath: vi.fn().mockReturnValue('/mock/vault/path'),
        basePath: '/mock/vault/path'
      },
      read: vi.fn().mockResolvedValue('mock file content'),
      readBinary: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      create: vi.fn().mockResolvedValue(undefined),
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      on: vi.fn((event: string, callback: Function) => {
        // Store event listeners for later triggering
        if (!this.vault._eventListeners) this.vault._eventListeners = {};
        if (!this.vault._eventListeners[event]) this.vault._eventListeners[event] = [];
        this.vault._eventListeners[event].push(callback);
        return { event, callback };
      }),
      off: vi.fn((event: string, callback: Function) => {
        // Remove event listeners
        if (this.vault._eventListeners && this.vault._eventListeners[event]) {
          const index = this.vault._eventListeners[event].indexOf(callback);
          if (index > -1) {
            this.vault._eventListeners[event].splice(index, 1);
          }
        }
      }),
      trigger: vi.fn((event: string, ...args: any[]) => {
        // Trigger event listeners
        if (this.vault._eventListeners && this.vault._eventListeners[event]) {
          this.vault._eventListeners[event].forEach((callback: Function) => {
            callback(...args);
          });
        }
      }),
      _eventListeners: {} as Record<string, Function[]>
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

// Mock the entire "obsidian" module
vi.mock('obsidian', () => ({
  Plugin: mockObsidian.Plugin,
  FileView: mockObsidian.FileView,
  TextFileView: mockObsidian.TextFileView,
  WorkspaceLeaf: mockObsidian.WorkspaceLeaf,
  TFile: mockObsidian.TFile,
  Notice: mockObsidian.Notice,
  Modal: mockObsidian.Modal,
  App: mockObsidian.App
}));

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
    playerState: string = 'paused';
    isReadyForPlayback: boolean = false;
    container: any = null;
    
    constructor(element: any, settings: any) {
      this.settings = settings || new mockAlphaTab.Settings();
      this.container = element;
    }
    
    load = vi.fn();
    tex = vi.fn();
    render = vi.fn();
    renderTracks = vi.fn((tracks: any) => {
      // Mock renderTracks method - 接受tracks参数并模拟渲染
      console.log('Mock renderTracks called with:', tracks);
      return Promise.resolve();
    });
    playPause = vi.fn();
    stop = vi.fn();
    destroy = vi.fn();
    on = vi.fn((event: string, callback: Function) => {
      // Mock event listener registration
      if (!this._eventHandlers) this._eventHandlers = {};
      if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
      this._eventHandlers[event].push(callback);
    });
    scrollToCursor = vi.fn();
    _eventHandlers: any = {};
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
  existsSync: vi.fn().mockImplementation((filePath: string) => {
    // Mock 插件目录和 manifest.json 存在
    if (filePath.includes('manifest.json')) {
      return true;
    }
    if (filePath.includes('assets') || filePath.includes('alphatab')) {
      return true;
    }
    return false;
  }),
  readFileSync: vi.fn().mockImplementation((filePath: string, encoding?: string) => {
    if (filePath.includes('manifest.json')) {
      return JSON.stringify({ id: 'test-plugin', name: 'Test Plugin', version: '1.0.0' });
    }
    if (encoding === 'utf8') {
      return 'mock file content';
    }
    return Buffer.from('mock file content');
  }),
  writeFileSync: vi.fn()
}));

vi.mock('path', () => ({
  join: vi.fn((...paths) => paths.filter(p => p).join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  resolve: vi.fn((...paths) => '/' + paths.filter(p => p).join('/'))
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

// Utility function to create mock files for testing
const createMockFile = (path: string = 'test.tex', content: string = 'mock content'): any => ({
  path,
  name: path.split('/').pop() || path,
  basename: path.split('/').pop()?.split('.')[0] || 'test',
  extension: path.split('.').pop() || 'tex',
  stat: { 
    mtime: Date.now(), 
    ctime: Date.now(), 
    size: content.length 
  },
  vault: null // Will be set when needed
});

// Export for use in tests
(global as any).createMockFile = createMockFile;

// Mock MutationObserver for better test compatibility
global.MutationObserver = class MockMutationObserver {
  private callback: Function;
  private options: any;
  
  constructor(callback: Function) {
    this.callback = callback;
  }
  
  observe(target: any, options: any) {
    this.options = options;
    // Store the observer on the target for triggering later
    if (!target._mutationObservers) target._mutationObservers = [];
    target._mutationObservers.push(this);
  }
  
  disconnect() {
    // Mock disconnect
  }
  
  takeRecords() {
    return [];
  }
  
  trigger(mutations: any[] = []) {
    this.callback(mutations);
  }
};

// Extend document.body to make it compatible with real DOM Node
Object.setPrototypeOf(mockBody, Node.prototype);
Object.setPrototypeOf(mockHead, Node.prototype);
