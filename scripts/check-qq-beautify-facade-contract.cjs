const assert = require('node:assert/strict');
(async () => {
  const { createMemoryQQV2StateStore } = await import('../modules/qq-v2/storage/state-store.js');
  const { createQQV2ProductionRuntime } = await import('../modules/qq-v2/application/production-runtime.js');
  const host = { readScope: () => ({ scopeId: 'chat-a', chatId: 'a', chatFile: 'a', hostType: 'character', hostId: 'c' }), readUserIdentity: () => ({ name: '我' }), readStoryTime: () => '2042-01-01 12:00', readStoryMessages: () => [], readRawContext: () => ({}) };
  const runtime = createQQV2ProductionRuntime({ stateStore: createMemoryQQV2StateStore(), host, worldbookGateway: { getCurrentCharacterBookNames: async () => ({ primary: '', additional: [] }), loadBook: async () => ({ entries: {} }), saveBook: async () => {}  } });
  try {
    await runtime.initialize();
    const facade = runtime.getFacade();
    const preset = { id: 'beauty', qq: { resources: [{ id: 'frame', library: 'avatar-frame', file: 'f.png' }, { id: 'bubble', library: 'bubble', file: 'f.png', bubble: { padding: 11 } }], outfits: [{ id: 'pair', avatarFrame: 'frame', bubble: 'bubble' }] }, files: { 'f.png': { mimeType: 'image/png', encoding: 'base64', content: 'AQID' } } };
    const imported = await facade.intent.importBeautifyPreset({ preset });
    assert.equal(imported.ok, true);
    const created = await facade.intent.createPrivateConversation({ name: '小樱' });
    assert.equal(created.ok, true);
    const conversations = await facade.query.conversations();
    const person = conversations.conversations.find(item => item.formalName === '小樱');
    assert.ok(person.avatarFrameAssetId, 'Conversation API exposes live personal frame');
    assert.ok(person.bubbleAssetId);
    assert.ok((await facade.query.currentProfile()).profile.avatarFrameAssetId, 'Self profile exposes assigned frame');
    assert.equal((await facade.query.media({ assetId: person.bubbleAssetId })).media.bubble.padding, 11);
    assert.equal((await facade.query.imageLibrary({ library: 'avatar-frame' })).assets.length, 1);
    const { createQQFullscreenOverlaySourceAdapter } = await import('../modules/fullscreen-overlay/sources/qq.js');
    const adapter = createQQFullscreenOverlaySourceAdapter({ getFacade: () => facade, random: () => 0 });
    const events = adapter.readEvents({ events: await adapter.readTestEvents() });
    assert.equal(events[0].avatarFrameAssetId, person.avatarFrameAssetId, 'Notification receives the same personal avatar frame');
    assert.equal(events[0].text, '小樱给你发了1条消息');
    console.log('QQ beautify facade contract passed');
  } finally { runtime.destroy(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
