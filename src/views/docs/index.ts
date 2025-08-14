import ReadMe from './ReadMe';
import InMarkdownRender from './InMarkdownRender';
import Overview from './Overview';
import MetadataPanel from './Metadata';
import InstrumentsTuning from './InstrumentsTuning';

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
];

export default panels;
