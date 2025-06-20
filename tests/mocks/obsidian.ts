// Mock implementation for obsidian package

// Create mock element with Obsidian HTMLElement extensions
const createMockElement = (tagName: string, options: any = {}) => {
  const element = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style: {},
    className: '',
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {}
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
    querySelector: () => null,
    querySelectorAll: () => [],
    ...options
  };
  return element;
};

export class Plugin {
  app: any;
  manifest: any = { dir: '/mock/plugin/dir' };
  
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

export class App {
  vault = {
    adapter: {
      exists: () => Promise.resolve(false),
      getResourcePath: () => '/mock/path',
      basePath: '/mock/path'
    },
    read: () => Promise.resolve(''),
    readBinary: () => Promise.resolve(new ArrayBuffer(0)),
    create: () => Promise.resolve(),
    getAbstractFileByPath: () => null,
    on: () => {},
    off: () => {}
  };
  
  workspace = {
    getLeaf: () => new WorkspaceLeaf(),
    setActiveLeaf: () => {},
    revealLeaf: () => {},
    splitActiveLeaf: () => new WorkspaceLeaf(),
    on: () => {},
    iterateAllLeaves: () => {},
    detachLeavesOfType: () => {}
  };
}

// Re-export everything as default
export default {
  Plugin,
  FileView,
  TextFileView,
  WorkspaceLeaf,
  TFile,
  Notice,
  App
};
