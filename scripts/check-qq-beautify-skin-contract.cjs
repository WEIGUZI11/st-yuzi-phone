const assert = require('node:assert/strict');
const { createMemoryIndexedDB } = require('./helpers/memory-indexeddb.cjs');
const { FakeElement, installFakeDom } = require('./helpers/qq-ui-fixture.cjs');
(async () => {
  globalThis.indexedDB = createMemoryIndexedDB();
  installFakeDom();
  // CSSOM is a browser boundary; fixtures describe the browser's parsed rules.
  globalThis.CSSStyleSheet = class { replaceSync(css) { this.cssRules = [{ selectorText: ':scope', style: { cssText: css.includes('pink') ? 'color: pink;' : 'color: white;' } }, { selectorText: 'body, .yuzi-qq-nav', style: { cssText: 'border-radius: 12px;' } }]; } };
  const { importContentPreset } = await import('../modules/content-presets/import-export.js');
  const repository = await import('../modules/content-presets/repository.js');
  const { prepareQQSkin } = await import('../modules/content-presets/qq-skin.js');
  const preset = importContentPreset({ format: 'yuzi-beautify-preset', formatVersion: 3, apiVersion: 2, manifest: { id: 'skin', items: [], displays: [], qq: { theme: { css: 'light.css', darkCss: 'dark.css' } } }, files: { 'light.css': { mimeType: 'text/css', encoding: 'text', content: ':scope { color: pink; }' }, 'dark.css': { mimeType: 'text/css', encoding: 'text', content: ':scope { color: white; }' } } });
  await repository.replacePresetRecord(preset); await repository.setQQBinding('theme', 'skin');
  const root = new FakeElement('div'); root.removeAttribute = name => root._attributes.delete(name);
  const skin = await prepareQQSkin('theme', { mode: 'dark' });
  skin.apply(root);
  assert.match(root.querySelector('style').textContent, /color: white/);
  assert.match(root.querySelector('style').textContent, /\[data-qq-skin=/, 'Every rule is confined to this QQ root');
  skin.dispose();
  assert.equal(root.querySelector('style'), null, 'Disposal removes authored CSS');
  await repository.setQQBinding('theme', '');
  assert.equal(await prepareQQSkin('theme'), null, 'Default theme adds no extra CSS');
  console.log('QQ beautify skin contract passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
