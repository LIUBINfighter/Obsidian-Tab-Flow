import { Plugin, Notice } from 'obsidian';
import { t } from '../i18n';

export function registerMigrationCommands(plugin: Plugin) {
	plugin.addCommand({
		id: 'migrate-alphatab-to-atex',
		name: t('commands.migrateToAtex', undefined, 'Migrate .alphatab files to .atex'),
		callback: async () => {
			const files = plugin.app.vault.getFiles();
			let count = 0;
			for (const file of files) {
				if (file.extension === 'alphatab') {
					const newPath = file.path.replace(/\.alphatab$/, '.atex');
					try {
						await plugin.app.fileManager.renameFile(file, newPath);
						count++;
					} catch (error) {
						console.error(`Failed to rename ${file.path}:`, error);
						new Notice(`Failed to rename ${file.path}`);
					}
				}
			}
			if (count > 0) {
				new Notice(
					t(
						'commands.migrationComplete',
						{ count },
						`Successfully migrated ${count} files to .atex`
					)
				);
			} else {
				new Notice(t('commands.noFilesToMigrate', undefined, 'No .alphatab files found'));
			}
		},
	});
}
