const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

async function main() {
    const { createMemoryQQV2StateStore } = await import('../modules/qq-v2/storage/state-store.js');
    const { createQQV2Repository } = await import('../modules/qq-v2/domain/repository.js');
    const { createQQV2ProductionRuntime } = await import('../modules/qq-v2/application/production-runtime.js');

    const stateStore = createMemoryQQV2StateStore();
    const runtime = createQQV2ProductionRuntime({
        host: {
            readScope: () => ({
                scopeId: 'message-text-color-contract',
                chatId: 'message-text-color-contract',
                chatFile: 'message-text-color-contract',
                hostType: 'character',
                hostId: 'test',
            }),
            readUserIdentity: () => ({ name: 'Traveler', avatar: '' }),
            readStoryTime: () => '2042-05-20 09:30',
            readStoryMessages: () => [],
            readRawContext: () => ({}),
        },
        stateStore,
        repository: createQQV2Repository({
            stateStore,
        }),
        cryptoApi: webcrypto,
        backend: { async generate() {}, async loadModels() { return []; } },
        worldbookGateway: {
            async loadBook() { return { entries: {} }; },
            async saveBook() {},
        },
    });
    await runtime.initialize();
    const facade = runtime.getFacade();

    const current = await facade.query.currentProfile();
    assert.equal(current.profile.messageTextColor, 'white', '当前用户默认使用白字');

    const created = await facade.intent.createPrivateConversation({ name: 'Alice' });
    assert.equal(created.ok, true);
    const conversationId = created.result.conversation.conversationId;
    assert.equal(
        (await facade.query.conversation({ conversationId })).conversation.messageTextColor,
        'black',
        '联系人默认使用黑字',
    );

    const frame = await facade.intent.saveImageLibraryAsset({
        library: 'avatar-frame',
        blob: new Blob(['frame'], { type: 'image/png' }),
        mimeType: 'image/png',
    });
    const bubble = await facade.intent.saveImageLibraryAsset({
        library: 'bubble',
        blob: new Blob(['bubble'], { type: 'image/png' }),
        mimeType: 'image/png',
    });
    assert.equal(frame.ok, true);
    assert.equal(bubble.ok, true);
    const decorated = await facade.intent.updatePrivateProfile({
        conversationId,
        profile: {
            avatarFrameAssetId: frame.asset.assetId,
            bubbleAssetId: bubble.asset.assetId,
        },
    });
    assert.equal(decorated.ok, true);
    assert.equal(decorated.result.person.avatarFrameAssetId, frame.asset.assetId);
    assert.equal(decorated.result.person.bubbleAssetId, bubble.asset.assetId);

    const changed = await facade.intent.updatePrivateProfile({
        conversationId,
        profile: { messageTextColor: 'white' },
    });
    assert.equal(changed.ok, true);
    assert.equal(changed.result.person.messageTextColor, 'white');
    assert.equal(
        (await facade.query.conversation({ conversationId })).conversation.messageTextColor,
        'white',
        '人物字色修改应回读为人物当前设置',
    );

    const invalid = await facade.intent.updatePrivateProfile({
        conversationId,
        profile: { messageTextColor: 'blue' },
    });
    assert.equal(invalid.ok, false, '人物字色只能选择白字或黑字');

    const assistantCharacters = await facade.query.assistantCharacters();
    assert.equal(assistantCharacters.ok, true);
    assert.equal(assistantCharacters.characters[0].messageTextColor, 'black', '助手默认使用黑字');
    const assistantSaved = await facade.intent.saveAssistantCharacter({
        characterId: assistantCharacters.characters[0].characterId,
        patch: {
            avatarFrameAssetId: frame.asset.assetId,
            bubbleAssetId: bubble.asset.assetId,
            messageTextColor: 'white',
        },
    });
    assert.equal(assistantSaved.ok, true);
    assert.equal(assistantSaved.character.avatarFrameAssetId, frame.asset.assetId);
    assert.equal(assistantSaved.character.bubbleAssetId, bubble.asset.assetId);
    assert.equal(assistantSaved.character.messageTextColor, 'white');

    const currentChanged = await facade.intent.updateCurrentProfile({
        profile: {
            avatarFrameAssetId: frame.asset.assetId,
            bubbleAssetId: bubble.asset.assetId,
            messageTextColor: 'black',
        },
    });
    assert.equal(currentChanged.ok, true);
    assert.equal(currentChanged.profile.avatarFrameAssetId, frame.asset.assetId);
    assert.equal(currentChanged.profile.bubbleAssetId, bubble.asset.assetId);
    assert.equal(currentChanged.profile.messageTextColor, 'black');

    runtime.destroy();
    console.log('[qq-message-text-color-contract] passed');
}

main().catch((error) => {
    console.error('[qq-message-text-color-contract] failed');
    console.error(error);
    process.exitCode = 1;
});
