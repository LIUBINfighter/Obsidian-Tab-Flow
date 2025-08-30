import { DocPanel } from '../index';

const SimpleTabifyPanel: DocPanel = {
  id: 'simple-tabify',
  title: 'SimpleTabify 服务介绍',
  render(container: HTMLElement) {
    // TO FIX: 使用 innerHTML 存在安全风险，应该使用 DOM API 或 Obsidian helper functions
    // 原因: https://docs.obsidian.md/Plugins/User+interface/HTML+elements
    container.innerHTML = `
      <h2>SimpleTabify 服务</h2>
      <p>SimpleTabify 是一个用于将乐谱转换为标准格式的服务，支持多种输入和输出格式，方便音乐创作者和爱好者使用。</p>
      <ul>
        <li>支持多种乐谱格式转换</li>
        <li>易于集成和使用</li>
        <li>高效、准确</li>
      </ul>
      <p>更多信息请访问 <a href="https://github.com/your-repo/SimpleTabify" target="_blank">SimpleTabify 项目主页</a>。</p>
    `;
  }
};

export default SimpleTabifyPanel;
