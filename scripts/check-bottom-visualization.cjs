const assert = require('node:assert/strict');
async function main() {
    const host = { extensionSettings: {}, saveSettingsDebounced() {} };
    global.window = Object.assign(new EventTarget(), { getContext: () => host, setTimeout, clearTimeout });
    const settings = await import('../modules/settings.js');
    const chatSurface = await import('../modules/integration/tauritavern-chat-surface.js');
    assert.equal(chatSurface.isManagedTauriTavernChatSurface(), false, '普通环境不应启用 ChatSurface 兼容模式');
    window.__TAURITAVERN__ = {
        api: {
            chatSurface: {
                isManagedOwnershipRequired: () => true,
            },
        },
    };
    assert.equal(chatSurface.isManagedTauriTavernChatSurface(), true, '应识别 TauriTavern 虚拟聊天模式');
    delete window.__TAURITAVERN__;
    const initial = settings.getPhoneSettings().bottomVisualization;
    assert.equal(initial?.enabled, false, '底部可视化默认关闭');
    assert.equal(initial.layout, 'vertical');
    assert.equal(initial.cardWidth, 260);
    assert.equal(initial.optionsEnabled, false);
    settings.savePhoneSetting('bottomVisualization', { ...initial, enabled: true, position: 'edge', cardWidth: 370 });
    assert.equal(settings.getPhoneSettings().bottomVisualization.cardWidth, 370, '保存回读卡片宽度');
    settings.savePhoneSetting('bottomVisualization', { enabled: 'false', position: 'bad', cardWidth: 900, opacity: 0, height: NaN });
    const normalized = settings.getPhoneSettings().bottomVisualization;
    assert.equal(normalized.enabled, false);
    assert.equal(normalized.position, 'flow');
    assert.equal(normalized.cardWidth, 500);
    assert.equal(normalized.opacity, 20);
    assert.equal(normalized.height, 60);
    const view = await import('../modules/bottom-visualization/view.js');
    const raw = {
        sheet_late: { name: '选项二', orderNo: 9, content: [['row_id', '选项'], [1, '不应使用']] },
        sheet_a: { name: '普通<表>', orderNo: 1, content: [['row_id', '姓名', '内容', '空'], [7, '甲', '<script>危险</script>', ''], [9, '乙', '完整正文\n下一行', null]] },
        sheet_choice: { name: '选项表', orderNo: 2, content: [['row_id', '选择一', '选择二'], [1, '问候', '离开']] },
    };
    const before = structuredClone(raw);
    const nav = view.buildNavigation(raw, 'sheet_a');
    assert.ok(nav.indexOf('data-sheet="review"') < nav.indexOf('data-sheet="sheet_a"'));
    assert.ok(nav.indexOf('data-sheet="sheet_a"') < nav.indexOf('data-sheet="sheet_choice"'));
    assert.match(nav, /普通&lt;表&gt;/);
    const cards = view.buildTableContent(raw, 'sheet_a', true);
    assert.ok(cards.html.indexOf('乙') < cards.html.indexOf('甲'), '倒序仅改变展示');
    assert.match(cards.html, /&lt;script&gt;危险&lt;\/script&gt;/, '来源数据不执行 HTML');
    assert.match(cards.html, /完整正文\n下一行/);
    assert.doesNotMatch(cards.html, /<dt>空<\/dt>/);
    assert.equal(cards.count, 2);
    assert.deepEqual(view.getOptionTexts(raw), ['问候', '离开'], '仅第一张选项表');
    assert.deepEqual(raw, before, '渲染不修改表格数据');
    settings.flushPhoneSettingsSave();
    console.log('[通过] 底部可视化设置默认、保存回读与非法值归一化');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
