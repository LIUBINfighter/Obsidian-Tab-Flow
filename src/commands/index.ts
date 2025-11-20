import { Plugin } from 'obsidian';
import { registerOpenViewCommands } from './open-views';
import { registerMigrationCommands } from './migration';

export function registerCommands(plugin: Plugin) {
	registerOpenViewCommands(plugin);
	registerMigrationCommands(plugin);
}
