import ReadMe from './ReadMe';
import InMarkdownRender from './InMarkdownRender';

export interface DocPanel {
  id: string;
  title: string;
  render: (container: HTMLElement, plugin?: unknown) => void;
}

export const panels: DocPanel[] = [
  ReadMe,
  InMarkdownRender,
];

export default panels;
