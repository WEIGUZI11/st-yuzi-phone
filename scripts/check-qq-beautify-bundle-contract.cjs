const assert = require('node:assert/strict');
(async () => {
  const { importContentPreset, readbackContentPreset } = await import('../modules/content-presets/import-export.js');
  const bundle = {
    format: 'yuzi-beautify-preset', formatVersion: 3, apiVersion: 2,
    manifest: { id: 'qq-sakura', name: '樱花 QQ', items: [], displays: [], qq: {
      theme: { css: 'qq.css' }, assets: ['frame.png'], popup: { css: 'notice.css' },
      resources: [{ id: 'frame', library: 'avatar-frame', file: 'frame.png' }, { id: 'bubble', library: 'bubble', file: 'frame.png' }],
      outfits: [{ id: 'sakura', avatarFrame: 'frame', bubble: 'bubble' }],
    } },
    files: {
      'qq.css': { mimeType: 'text/css', encoding: 'text', content: ':scope { --yuzi-qq-accent: #bd497d; }' },
      'notice.css': { mimeType: 'text/css', encoding: 'text', content: ':scope { border: 1px solid pink; }' },
      'frame.png': { mimeType: 'image/png', encoding: 'base64', content: 'AQID' },
    },
  };
  const record = importContentPreset(bundle);
  assert.deepEqual(record.qq, bundle.manifest.qq, 'QQ-only packages retain skins, library resources and paired outfits');
  assert.deepEqual(readbackContentPreset(record).record.qq, record.qq, 'QQ capabilities survive export and reimport');
  for (const mutate of [
    b => { b.manifest.qq.theme.css = 'missing.css'; },
    b => { b.manifest.qq.outfits[0].bubble = 'missing'; },
    b => { b.manifest.qq.resources[0].library = 'arbitrary'; },
    b => { b.manifest.qq.resources.push({ ...b.manifest.qq.resources[0] }); },
    b => { b.manifest.qq.theme.mount = 'script.js'; },
    b => { b.manifest.qq.resources[0].file = '../escape.png'; },
    b => { b.manifest.qq.resources[1].bubble = { padding: -1 }; },
    b => { b.manifest.qq.resources[1].bubble = { textColor: '#12345' }; },
  ]) {
    const invalid = structuredClone(bundle); mutate(invalid);
    assert.throws(() => importContentPreset(invalid), /QQ|资源|套装|气泡/, 'Invalid QQ packages must fail before persistence');
  }
  console.log('QQ beautify bundle contract passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
