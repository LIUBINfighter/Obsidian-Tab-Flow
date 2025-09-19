export interface DocPanel {
	id: string;
	title: string;
	render: (container: HTMLElement, plugin?: unknown) => void;
}

import { getCurrentLanguageCode } from '../../i18n';

// 面板配置
export const panelConfigs: Array<{ id: string; module: string }> = [
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
	// { id: 'simpleTabify', module: 'SimpleTabify' }, // 暂时不挂载，simpleTabify项目还未推出
];

// (动态加载逻辑已移除；保留同步按语言导入以避免运行时 fetch 问题)

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
// 同步导入中文面板（保证在运行时无需动态 fetch）
import ReadMe_zh from './zh/ReadMe';
import InMarkdownRender_zh from './zh/InMarkdownRender';
import Overview_zh from './zh/Overview';
import MetadataPanel_zh from './zh/Metadata';
import InstrumentsTuning_zh from './zh/InstrumentsTuning';
import Notes_zh from './zh/Notes';
import Stylesheet_zh from './zh/Stylesheet';
import BarMetadata_zh from './zh/BarMetadata';
import BeatEffects_zh from './zh/BeatEffects';
import NoteEffects_zh from './zh/NoteEffects';
import Lyrics_zh from './zh/Lyrics';
import Percussion_zh from './zh/Percussion';
import SyncPoints_zh from './zh/SyncPoints';
import ExampleProgression_zh from './zh/ExampleProgression';
// import SimpleTabifyPanel from './en/SimpleTabify'; // 暂时不挂载，simpleTabify项目还未推出

// 将中/英文面板分别导出，避免运行时动态 fetch 问题
export const enPanels: DocPanel[] = [
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
];

export const zhPanels: DocPanel[] = [
	ReadMe_zh,
	InMarkdownRender_zh,
	Overview_zh,
	MetadataPanel_zh,
	InstrumentsTuning_zh,
	Notes_zh,
	Stylesheet_zh,
	BarMetadata_zh,
	BeatEffects_zh,
	NoteEffects_zh,
	Lyrics_zh,
	Percussion_zh,
	SyncPoints_zh,
	ExampleProgression_zh,
];

// 兼容导出：默认返回enPanels（保持向后兼容）
export default enPanels;

// 可按语言参数获取面板集合
export function loadDocPanels(language?: 'en' | 'zh'): DocPanel[] {
	const lang = language || getCurrentLanguageCode();
	return lang === 'zh' ? zhPanels : enPanels;
}
