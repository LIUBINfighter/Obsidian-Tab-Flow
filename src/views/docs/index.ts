export interface DocPanel {
  id: string;
  title: string;
  render: (container: HTMLElement, plugin?: unknown) => void;
}

import ReadMe from './ReadMe';
import InMarkdownRender from './InMarkdownRender';
import Overview from './Overview';
import MetadataPanel from './Metadata';
import InstrumentsTuning from './InstrumentsTuning';
import Notes from './Notes';
import Stylesheet from './Stylesheet';
import BarMetadata from './BarMetadata';
import BeatEffects from './BeatEffects';
import NoteEffects from './NoteEffects';
import Lyrics from './Lyrics';
import Percussion from './Percussion';
import SyncPoints from './SyncPoints';
import ExampleProgression from './ExampleProgression';
import SimpleTabifyPanel from './SimpleTabify';

// 所有可用的页签
const allPanels: Record<string, DocPanel> = {
  readme: ReadMe,
  inMarkdownRender: InMarkdownRender,
  overview: Overview,
  metadata: MetadataPanel,
  instrumentsTuning: InstrumentsTuning,
  notes: Notes,
  stylesheet: Stylesheet,
  barMetadata: BarMetadata,
  beatEffects: BeatEffects,
  noteEffects: NoteEffects,
  lyrics: Lyrics,
  percussion: Percussion,
  syncPoints: SyncPoints,
  exampleProgression: ExampleProgression,
  simpleTabify: SimpleTabifyPanel,
};

// 控制显示和顺序的配置，只需调整此数组即可
const panelConfig: string[] = [
  'readme',
  'inMarkdownRender',
  'overview',
  'metadata',
  'instrumentsTuning',
  'notes',
  'stylesheet',
  'barMetadata',
  'beatEffects',
  'noteEffects',
  'lyrics',
  'percussion',
  'syncPoints',
  'exampleProgression',
  'simpleTabify',
];

// 根据配置生成 panels
export const panels: DocPanel[] = panelConfig.map(id => allPanels[id]);

export default panels;
