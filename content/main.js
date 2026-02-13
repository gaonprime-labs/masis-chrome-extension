// content/main.js - Entry wrapper for ES6 module loading
// This wrapper is needed because Chrome content_scripts don't support type="module" directly

(async () => {
  try {
    const { default: init } = await import(chrome.runtime.getURL('content/main-module.js'));
    if (init) init();
  } catch (error) {
    console.error('[Extension] Failed to load main module:', error);
  }
})();
