// Lightweight utils compatibility module
// NOTE: The file-type helper exports below are deprecated convenience re-exports.
// They remain to maintain compatibility with tests and external code but may
// be removed in a future release. Prefer using explicit extension arrays where
// possible.

export function registerStyles() {
  // noop for tests and runtime; real style registration happens elsewhere
}

export function getCurrentThemeMode(): 'dark' | 'light' {
  if (document.body.classList.contains('theme-dark')) return 'dark';
  if (document.body.classList.contains('theme-light')) return 'light';
  return 'dark';
}

export function watchThemeModeChange(callback: (mode: 'dark'|'light') => void): MutationObserver {
  // call immediately with current mode
  callback(getCurrentThemeMode());
  const observer = new MutationObserver(() => {
    callback(getCurrentThemeMode());
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // expose callback for tests that want to trigger it
  (observer as any).callback = (mutations: MutationRecord[]) => {
    callback(getCurrentThemeMode());
  };
  return observer;
}
