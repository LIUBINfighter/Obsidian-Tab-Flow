import { DocPanel } from '../index';

const SimpleTabifyPanel: DocPanel = {
	id: 'simple-tabify',
	title: 'SimpleTabify service introduction',
	render(container: HTMLElement) {
		// 清空容器
		while (container.firstChild) {
			container.removeChild(container.firstChild);
		}

		// 创建标题
		const h2 = createEl('h2');
		h2.textContent = 'Simpletabify service';
		container.appendChild(h2);

		// 创建描述段落
		const p1 = createEl('p');
		p1.textContent =
			'Simpletabify is a service for converting musical scores to standard formats, supporting multiple input and output formats, making it convenient for music creators and enthusiasts.';
		container.appendChild(p1);

		// 创建列表
		const ul = createEl('ul');
		const li1 = createEl('li');
		li1.textContent = 'Supports multiple score format conversions';
		ul.appendChild(li1);

		const li2 = createEl('li');
		li2.textContent = 'Easy to integrate and use';
		ul.appendChild(li2);

		const li3 = createEl('li');
		li3.textContent = 'Efficient and accurate';
		ul.appendChild(li3);

		container.appendChild(ul);

		// 创建链接段落
		const p2 = createEl('p');
		p2.textContent = 'For more information, please visit ';
		const link = createEl('a');
		link.href = 'https://github.com/your-repo/SimpleTabify';
		link.target = '_blank';
		link.textContent = 'Simpletabify project homepage';
		p2.appendChild(link);
		p2.appendChild(document.createTextNode('.'));
		container.appendChild(p2);
	},
};

export default SimpleTabifyPanel;
