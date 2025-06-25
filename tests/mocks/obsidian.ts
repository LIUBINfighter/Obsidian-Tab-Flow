// Mock implementation for obsidian package

// Enhanced mock element to support style and classList behaviors
const createMockElement = (tagName: string, options: any = {}) => {
  const element = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style: {
      display: '',
    },
    className: '',
    classList: {
      classes: new Set<string>(),
      add: function (cls: string) { this.classes.add(cls); },
      remove: function (cls: string) { this.classes.delete(cls); },
      contains: function (cls: string) { return this.classes.has(cls); },
      toggle: function (cls: string) { this.classes.has(cls) ? this.classes.delete(cls) : this.classes.add(cls); }
    },
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    createEl: (tag: string, opts?: any) => createMockElement(tag, opts),
    id: options.id || '',
    disabled: false,
    hidden: false,
    children: [],
    parentElement: null,
    querySelector: (selector: string) => {
      if (selector === 'select' && tagName.toUpperCase() === 'DIV') {
        return createMockSelectElement();
      }
      return null;
    },
    querySelectorAll: () => [],
    // Special properties for select elements
    ...(tagName.toLowerCase() === 'select' ? {
      options: [],
      value: options.value || '',
      selectedIndex: 0
    } : {}),
    ...options
  };
  return element;
};

// Special mock for select elements
const createMockSelectElement = () => {
  const selectElement = {
    tagName: 'SELECT',
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    options: [] as any[],
    value: '',
    selectedIndex: 0,
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    appendChild: function(child: any) {
      if (child.tagName === 'OPTION') {
        // Mock the options collection behavior
        this.options.push(child);
        // Update length property
        Object.defineProperty(this.options, 'length', {
          value: this.options.length,
          writable: true
        });
      }
    },
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    children: [],
    parentElement: null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  
  // Ensure options has length property
  Object.defineProperty(selectElement.options, 'length', {
    value: 0,
    writable: true
  });
  
  return selectElement;
};

export class Plugin {
  app: any;
  manifest: any = { dir: '/mock/plugin/dir' };
  
  constructor(app?: any, manifest?: any) {
    if (app) {
      this.app = app;
    }
    if (manifest) {
      this.manifest = manifest;
    }
  }
  
  loadData = () => Promise.resolve({});
  saveData = () => Promise.resolve();
  addCommand = () => {};
  registerView = () => {};
  registerExtensions = () => {};
  registerEvent = () => {};
  addAction = () => {};
}

export class FileView {
  leaf: any;
  containerEl: any = createMockElement('div');
  contentEl: any = createMockElement('div');
  
  constructor(leaf: any) {
    this.leaf = leaf;
  }
  
  onLoadFile = () => Promise.resolve();
  onUnloadFile = () => {};
  getViewType = () => 'file';
  getDisplayText = () => 'Mock File';
}

export class TextFileView extends FileView {
  constructor(leaf: any) {
    super(leaf);
    this.containerEl = { 
      children: [null, createMockElement('div')],
      createEl: (tag: string, opts?: any) => createMockElement(tag, opts)
    };
  }
  
  getViewData = () => '';
  setViewData = () => {};
  clear = () => {};
}

export class WorkspaceLeaf {
  view: any;
  openFile = () => Promise.resolve();
  setViewState = () => Promise.resolve();
}

export class TFile {
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
}

export class Notice {
  constructor(message: string) {
    console.log('Notice:', message);
  }
}

export class Modal {
  app: any;
  contentEl: any;
  titleEl: any;
  modalEl: any;
  
  constructor(app: any) {
    this.app = app;
    this.contentEl = { createEl: () => ({}), empty: () => {} };
    this.titleEl = { setText: () => {} };
    this.modalEl = { addClass: () => {} };
  }
  
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any;
  
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = createMockElement('div');
  }
  
  display() {}
  hide() {}
}

// Mock Vault Adapter
export class MockAdapter {
  getBasePath() {
    return '/mock/vault/root';
  }
  // 可根据需要添加更多方法
}

// Mock Vault
export class MockVault {
  adapter = new MockAdapter();
}

// Mock App
export class MockApp {
  vault = new MockVault();
  // 可根据需要添加更多属性和方法
}

// 让 App 继承 MockApp
export class App extends MockApp {}

export default {
  Plugin,
  FileView,
  TextFileView,
  WorkspaceLeaf,
  TFile,
  Notice,
  Modal,
  PluginSettingTab,
  App,
  MockApp,
  MockVault,
  MockAdapter
};
