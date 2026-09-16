import { Plugin } from 'obsidian';
import { registerOpenViewCommands } from './open-views';
import { registerMigrationCommands } from './migration';
import { registerDebugCommands } from '../debug/fontProbe';

export function registerCommands(plugin: Plugin) {
	registerOpenViewCommands(plugin);
	registerMigrationCommands(plugin);
	registerDebugCommands(plugin);
}
