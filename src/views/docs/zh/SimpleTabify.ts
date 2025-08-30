import { DocPanel } from '../index';

const SimpleTabifyPanel: DocPanel = {
  id: 'simple-tabify',
  title: 'SimpleTabify 服务介绍',
  render(container: HTMLElement) {
    // 清空容器
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 创建标题
    const h2 = document.createElement('h2');
    h2.textContent = 'SimpleTabify 服务';
    container.appendChild(h2);

    // 创建描述段落
    const p1 = document.createElement('p');
    p1.textContent = 'SimpleTabify 是一个用于将乐谱转换为标准格式的服务，支持多种输入和输出格式，方便音乐创作者和爱好者使用。';
    container.appendChild(p1);

    // 创建列表
    const ul = document.createElement('ul');
    const li1 = document.createElement('li');
    li1.textContent = '支持多种乐谱格式转换';
    ul.appendChild(li1);

    const li2 = document.createElement('li');
    li2.textContent = '易于集成和使用';
    ul.appendChild(li2);

    const li3 = document.createElement('li');
    li3.textContent = '高效、准确';
    ul.appendChild(li3);

    container.appendChild(ul);

    // 创建链接段落
    const p2 = document.createElement('p');
    p2.textContent = '更多信息请访问 ';
    const link = document.createElement('a');
    link.href = 'https://github.com/your-repo/SimpleTabify';
    link.target = '_blank';
    link.textContent = 'SimpleTabify 项目主页';
    p2.appendChild(link);
    p2.appendChild(document.createTextNode('。'));
    container.appendChild(p2);

  }
};

export default SimpleTabifyPanel;
