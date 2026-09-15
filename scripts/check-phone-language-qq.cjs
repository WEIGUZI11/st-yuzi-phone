const assert = require('node:assert/strict');
async function main() {
    const settingsHost = { extensionSettings: {}, saveSettingsDebounced() {} };
    global.window = Object.assign(new EventTarget(), { getContext: () => settingsHost, setTimeout, clearTimeout });
    const { savePhoneSetting, flushPhoneSettingsSave } = await import('../modules/settings.js');
    const { createMemoryQQV2StateStore } = await import('../modules/qq-v2/storage/state-store.js');
    const { createQQV2ProductionRuntime } = await import('../modules/qq-v2/application/production-runtime.js');
    const runtime = createQQV2ProductionRuntime({
        stateStore: createMemoryQQV2StateStore(),
        host: {
            readScope: () => ({ scopeId: 'language-test', hostType: 'character', hostId: 'test', chatId: 'language-test', chatFile: 'language-test' }),
            readUserIdentity: () => ({ name: '读者' }), readStoryTime: () => '2042-05-20 09:30', readStoryMessages: () => [],
        },
        backend: { generate: async () => { throw Error('语言测试不允许 AI 调用'); }, loadModels: async () => [] },
        worldbookGateway: { getCurrentCharacterBookNames: async () => ({ primary: '', additional: [] }), loadBook: async () => ({ entries: {} }), saveBook: async () => { throw Error('语言切换不写世界书'); } },
    });
    await runtime.initialize();
    try {
        const facade = runtime.getFacade();
        const presetsBefore = (await facade.query.sharedResources()).promptPresets;
        const a = await facade.intent.createPrivateConversation({ name: '保存' });
        const b = await facade.intent.createPrivateConversation({ name: '林月' });
        assert.equal(a.ok, true); assert.equal(b.ok, true);
        const result = await facade.intent.createGroupConversation({ name: '中文群名', memberIds: [a.result.person.personId, b.result.person.personId], ownerId: '__self__' });
        assert.equal(result.ok, true, JSON.stringify(result));
        const groupId = result.result.group.groupId;
        const conversationId = result.result.conversation.conversationId;
        savePhoneSetting('phoneLanguage', 'en');
        assert.equal((await facade.intent.manageGroup({ groupId, action: 'rename', value: '新的群名' })).ok, true);
        const englishMessages = (await facade.query.messages({ conversationId })).page.items;
        assert.equal(englishMessages.at(-1).content, 'User changed the group name', '新系统通知按产生时语言保存，名字原样保留');
        savePhoneSetting('phoneLanguage', 'zh-CN');
        assert.deepEqual((await facade.query.messages({ conversationId })).page.items, englishMessages, '切换不改已有消息');
        assert.equal((await facade.intent.manageGroup({ groupId, action: 'rename', value: '最后的群名' })).ok, true);
        assert.equal((await facade.query.messages({ conversationId })).page.items.at(-1).content, '用户修改了群名称');
        assert.deepEqual((await facade.query.sharedResources()).promptPresets, presetsBefore, '五套预设的名称、正文和消息块不因语言切换而保存新值');
    } finally { await runtime.destroy(); flushPhoneSettingsSave(); }
    console.log('[通过] QQ 系统通知使用产生时语言，旧消息和预设内容保持不变');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
