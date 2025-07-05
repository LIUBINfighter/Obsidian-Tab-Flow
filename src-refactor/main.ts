
import { Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {
    async onload() {
        console.log('Hello from refactored code!');
    }

    onunload() {

    }
}
