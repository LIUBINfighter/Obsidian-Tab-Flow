import javascript

/**
 * Detect references to global `app` or `window.app` which are discouraged in Obsidian plugins.
 */
from Identifier id
where id.getName() = "app" and
  not id.getLocation().getFile().getBaseName().matches(".*test.*")
select id, "Usage of global 'app' detected; prefer using this.app from plugin instance."
