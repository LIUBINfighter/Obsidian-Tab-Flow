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

export interface DocPanel {
  id: string;
  title: string;
  render: (container: HTMLElement, plugin?: unknown) => void;
}

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
];

export default panels;
