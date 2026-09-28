const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

function sourceSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    return source.slice(start, end < 0 ? source.length : end);
}

function main() {
    const app = read('modules/qq-v2/ui/app.js');
    const popup = read('modules/content-presets/qq-popup.js');
    const avatar = sourceSlice(app, 'const avatar =', 'const stickerImage =');
    const rootHeader = sourceSlice(app, 'const makeRootIdentityHeader =', 'const makeChatHeader =');
    const messageNode = sourceSlice(app, 'const messageNode =', 'const renderMessageStream =');
    const conversationRow = sourceSlice(app, 'const renderConversationRow =', 'const renderMessagesRoot =');
    const contactsRoot = sourceSlice(app, 'const renderContactsRoot =', 'const renderProfilePage =');
    const contactRow = sourceSlice(contactsRoot, 'row.append(conversationAvatar(', 'const copy =');
    const groupMemberEditor = sourceSlice(app, 'const renderGroupMemberEditor =', 'const renderCurrentProfile =');
    const groupDetails = sourceSlice(app, 'const renderConversationSettings =', 'const renderSettingsRoot =');

    assert.match(avatar, /showFrame\s*=\s*false/, '通用头像必须默认关闭头像框');
    assert.match(avatar, /if\s*\(showFrame\)\s*applyPersonalFrame/s,
        '通用头像只有在明确允许时才可加载头像框');
    assert.match(rootHeader, /identityAvatar\([\s\S]*showFrame:\s*true/,
        'QQ 根页面左上角当前用户头像必须明确保留头像框');
    assert.match(messageNode, /showFrame:\s*true/,
        '聊天消息头像必须明确保留头像框');

    assert.doesNotMatch(conversationRow, /showFrame:\s*true/,
        'QQ 消息列表头像不得显示头像框');
    assert.doesNotMatch(contactRow, /showFrame:\s*true/,
        '联系人页头像不得显示头像框');
    assert.doesNotMatch(groupMemberEditor, /showFrame:\s*true/,
        '群成员编辑页头像不得显示头像框');
    assert.doesNotMatch(groupDetails, /identityAvatar\([\s\S]*showFrame:\s*true/,
        '群聊设置中的当前用户头像不得额外显示头像框');

    assert.match(popup, /decorateQQAvatar\(/,
        'QQ 主动消息通知浮窗必须继续复用头像框装饰路径');

    console.log('[qq-avatar-frame-visibility-contract] passed');
}

try {
    main();
} catch (error) {
    console.error('[qq-avatar-frame-visibility-contract] failed');
    console.error(error);
    process.exitCode = 1;
}
