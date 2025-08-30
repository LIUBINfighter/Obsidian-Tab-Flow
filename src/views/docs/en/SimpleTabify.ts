import { DocPanel } from '../index';

const SimpleTabifyPanel: DocPanel = {
	id: 'simple-tabify',
	title: 'SimpleTabify Service Introduction',
	render(container: HTMLElement) {
		// 使用 DOM API 替代 innerHTML，避免安全风险
		// 清空容器
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		// 创建标题
		const h2 = document.createElement('h2');
		h2.textContent = 'SimpleTabify Service';
		container.appendChild(h2);

		// 创建描述段落
		const p1 = document.createElement('p');
		p1.textContent =
			'SimpleTabify is a service for converting musical scores to standard formats, supporting multiple input and output formats, making it convenient for music creators and enthusiasts.';
		container.appendChild(p1);

		// 创建列表
		const ul = document.createElement('ul');
		const li1 = document.createElement('li');
		li1.textContent = 'Supports multiple score format conversions';
		ul.appendChild(li1);

		const li2 = document.createElement('li');
		li2.textContent = 'Easy to integrate and use';
		ul.appendChild(li2);

		const li3 = document.createElement('li');
		li3.textContent = 'Efficient and accurate';
		ul.appendChild(li3);

		container.appendChild(ul);

		// 创建链接段落
		const p2 = document.createElement('p');
		p2.textContent = 'For more information, please visit ';
		const link = document.createElement('a');
		link.href = 'https://github.com/your-repo/SimpleTabify';
		link.target = '_blank';
		link.textContent = 'SimpleTabify project homepage';
		p2.appendChild(link);
		p2.appendChild(document.createTextNode('.'));
		container.appendChild(p2);
	},
};

export default SimpleTabifyPanel;
