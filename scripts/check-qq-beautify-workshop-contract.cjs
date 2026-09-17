const assert = require('node:assert/strict');
const { createMemoryIndexedDB } = require('./helpers/memory-indexeddb.cjs');
(async () => {
  globalThis.indexedDB = createMemoryIndexedDB();
  const { __test__createContentPresetWorkshopService, createUnavailableContentPresetWorkshopService } = await import('../modules/content-presets/workshop-service.js');
  const { buildBeautifyTemplatePageHtml } = await import('../modules/settings-app/layout/page-builders/editor-builders.js');
  const unavailable = createUnavailableContentPresetWorkshopService();
  assert.equal(typeof unavailable.setQQActive, 'function', 'Unavailable workshop keeps the same QQ mutation interface');
  await assert.rejects(unavailable.setQQActive('theme', ''), /完整页面运行时/);
  const importedResources = [];
  const service = __test__createContentPresetWorkshopService({
    importQQPresetResources: async preset => importedResources.push(structuredClone(preset.qq)),
  }, { getTableData: () => ({}) });
  const bundle = { format: 'yuzi-beautify-preset', formatVersion: 3, apiVersion: 2,
    manifest: { id: 'qq-skin', name: '樱花QQ', items: [], displays: [], qq: { theme: { css: 'skin.css' }, popup: { css: 'skin.css' } } },
    files: { 'skin.css': { mimeType: 'text/css', encoding: 'text', content: ':scope { color: pink; }' } } };
  await service.importPrepared(await service.prepareImport(bundle));
  await service.setQQActive('theme', 'qq-skin');
  await service.setQQActive('popup', 'qq-skin');
  let model = await service.getViewModel();
  assert.equal(model.tables.length, 0, 'QQ does not fabricate a table');
  assert.equal(model.qq.bindings.theme, 'qq-skin');
  assert.match(buildBeautifyTemplatePageHtml(model), /QQ/);
  assert.match(buildBeautifyTemplatePageHtml(model), /data-qq-preset-application="theme"/);
  await service.setQQActive('theme', '');
  model = await service.getViewModel();
  assert.equal(model.qq.bindings.theme, '');
  assert.equal(model.qq.bindings.popup, 'qq-skin', 'Restoring theme leaves popup untouched');
  await service.deletePreset('qq-skin');
  assert.equal((await service.getViewModel()).qq.bindings.popup, '', 'Deleting a package removes its QQ bindings');
  const materials = structuredClone(bundle);
  materials.manifest.id = 'qq-materials';
  materials.manifest.qq = { resources: [{ id: 'frame', library: 'avatar-frame', file: 'frame.png' }] };
  materials.files['frame.png'] = { mimeType: 'image/png', encoding: 'base64', content: 'AQID' };
  await service.importPrepared(await service.prepareImport(materials));
  assert.deepEqual(importedResources, [materials.manifest.qq], 'Workshop forwards declared materials through the QQ import boundary');
  await service.deletePreset('qq-materials');
  assert.equal(importedResources.length, 1, 'Deleting preset never calls a destructive QQ library operation');
  console.log('QQ beautify workshop contract passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
