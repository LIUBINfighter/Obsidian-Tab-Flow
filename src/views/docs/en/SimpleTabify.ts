import { DocPanel } from '../index';

const SimpleTabifyPanel: DocPanel = {
  id: 'simple-tabify',
  title: 'SimpleTabify Service Introduction',
  render(container: HTMLElement) {
    container.innerHTML = `
      <h2>SimpleTabify Service</h2>
      <p>SimpleTabify is a service for converting musical scores to standard formats, supporting multiple input and output formats, making it convenient for music creators and enthusiasts.</p>
      <ul>
        <li>Supports multiple score format conversions</li>
        <li>Easy to integrate and use</li>
        <li>Efficient and accurate</li>
      </ul>
      <p>For more information, please visit <a href="https://github.com/your-repo/SimpleTabify" target="_blank">SimpleTabify project homepage</a>.</p>
    `;
  }
};

export default SimpleTabifyPanel;
