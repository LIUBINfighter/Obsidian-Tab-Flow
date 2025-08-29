export interface DocPanel {
  id: string;
  title: string;
  render: (container: HTMLElement, plugin?: unknown) => void;
}

import { getCurrentLanguageCode } from '../../i18n';

// 动态导入文档面板
async function importDocPanel(panelName: string): Promise<{ default: DocPanel }> {
  const language = getCurrentLanguageCode();
  
  try {
    // 优先加载对应语言版本
    if (language === 'zh') {
      return await import(`./zh/${panelName}`);
    } else {
      return await import(`./en/${panelName}`);
    }
  } catch (error) {
    console.warn(`[TabFlow Docs] Failed to load ${language}/${panelName}, falling back to default`);
    // fallback到根目录版本
    return await import(`./${panelName}`);
  }
}

// 面板配置
const panelConfigs: Array<{ id: string, module: string }> = [
  { id: 'readme', module: 'ReadMe' },
  { id: 'inMarkdownRender', module: 'InMarkdownRender' },
  { id: 'overview', module: 'Overview' },
  { id: 'metadata', module: 'Metadata' },
  { id: 'instrumentsTuning', module: 'InstrumentsTuning' },
  { id: 'notes', module: 'Notes' },
  { id: 'stylesheet', module: 'Stylesheet' },
  { id: 'barMetadata', module: 'BarMetadata' },
  { id: 'beatEffects', module: 'BeatEffects' },
  { id: 'noteEffects', module: 'NoteEffects' },
  { id: 'lyrics', module: 'Lyrics' },
  { id: 'percussion', module: 'Percussion' },
  { id: 'syncPoints', module: 'SyncPoints' },
  { id: 'exampleProgression', module: 'ExampleProgression' },
  { id: 'simpleTabify', module: 'SimpleTabify' },
];

// 异步加载所有面板
export async function loadDocPanels(): Promise<DocPanel[]> {
  const panels: DocPanel[] = [];
  
  for (const config of panelConfigs) {
    try {
      const module = await importDocPanel(config.module);
      panels.push(module.default);
    } catch (error) {
      console.error(`[TabFlow Docs] Failed to load panel ${config.id}:`, error);
    }
  }
  
  return panels;
}

// 为了向后兼容，保留同步版本（使用默认语言版本）
import ReadMe from './en/ReadMe';
import InMarkdownRender from './en/InMarkdownRender';
import Overview from './en/Overview';
import MetadataPanel from './en/Metadata';
import InstrumentsTuning from './en/InstrumentsTuning';
import Notes from './en/Notes';
import Stylesheet from './en/Stylesheet';
import BarMetadata from './en/BarMetadata';
import BeatEffects from './en/BeatEffects';
import NoteEffects from './en/NoteEffects';
import Lyrics from './en/Lyrics';
import Percussion from './en/Percussion';
import SyncPoints from './en/SyncPoints';
import ExampleProgression from './en/ExampleProgression';
import SimpleTabifyPanel from './en/SimpleTabify';

export const panels: DocPanel[] = [
  ReadMe,
  InMarkdownRender,
  Overview,
  MetadataPanel,
  InstrumentsTuning,
  Notes,
  Stylesheet,
  BarMetadata,
  BeatEffects,
  NoteEffects,
  Lyrics,
  Percussion,
  SyncPoints,
  ExampleProgression,
  SimpleTabifyPanel,
];

export default panels;
