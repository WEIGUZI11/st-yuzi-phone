const assert = require('node:assert/strict');

async function main() {
    const host = { extensionSettings: {}, saveSettingsDebounced() {} };
    global.window = Object.assign(new EventTarget(), {
        getContext: () => host, setTimeout, clearTimeout,
    });
    const settings = await import('../modules/settings.js');
    assert.equal(settings.getPhoneSettings().phoneLanguage, 'zh-CN', '未选择时默认中文');
    const before = structuredClone(settings.getPhoneSettings());
    assert.equal(settings.savePhoneSetting('phoneLanguage', 'en'), true);
    assert.equal(settings.getPhoneSettings().phoneLanguage, 'en', '重新读取保留英文选择');
    assert.deepEqual(settings.getPhoneSettings(), { ...before, phoneLanguage: 'en' }, '不改其他设置');
    assert.equal(settings.savePhoneSetting('phoneLanguage', 'invalid'), true);
    assert.equal(settings.getPhoneSettings().phoneLanguage, 'zh-CN', '沿用设置接口的非法值归一化行为');
    const { validateSettings } = await import('../modules/settings/schema.js');
    assert.equal(validateSettings({ phoneLanguage: 'invalid' }).phoneLanguage, 'zh-CN', '旧设置非法值回退中文');
    const { buildAppearancePageHtml } = await import('../modules/settings-app/layout/page-builders/appearance-builders.js');
    const view = () => buildAppearancePageHtml({ layoutValues: settings.getPhoneSettings(), fontLibrary: { options: [{ id: 'user', name: '保存' }] } });
    assert.match(view(), /语言.*Language/, '语言入口无需识别中文');
    settings.savePhoneSetting('phoneLanguage', 'en');
    assert.match(view(), />Upload</, '英文设置页面实际渲染英文');
    assert.doesNotMatch(view(), />上传</);
    assert.match(view(), /保存/, '用户名不能因与系统文案同名而翻译');
    const rawData = { sheet_settings: { name: '设置', content: [['保存', '删除'], ['<中文&>', '保存']] } };
    const rawBefore = structuredClone(rawData);
    const { buildHomeScreenViewModel } = await import('../modules/phone-home/view-model.js');
    const { collectAppearanceIconSlots, getAppearanceIconDisplayName } = await import('../modules/settings-app/services/appearance-settings/icon-slots.js');
    const englishHome = buildHomeScreenViewModel(rawData, settings.getPhoneSettings());
    assert.equal(englishHome.apps.find(app=>app.key==='sheet_settings').name, '设置');
    assert.equal(englishHome.dockApps.find(app=>app.id==='settings').name, 'Settings');
    const englishSlots = collectAppearanceIconSlots(rawData);
    assert.equal(getAppearanceIconDisplayName(englishSlots.find(slot=>slot.key==='sheet_settings')), '设置');
    assert.equal(getAppearanceIconDisplayName(englishSlots.find(slot=>slot.key==='dock_settings')), 'Settings');
    const { buildGenericDetailPageHtml } = await import('../modules/table-viewer/detail-page-template.js');
    const detail = buildGenericDetailPageHtml({ title: '设置<中文&>', kvPairs: [{ key: '保存', value: '删除<中文&>', rawColIndex: 0 }], state: {}, genericStylePayload: {} });
    assert.match(detail, /Save changes/);
    assert.match(detail, /设置&lt;中文&amp;&gt;/);
    assert.match(detail, /保存/);
    assert.match(detail, /删除&lt;中文&amp;&gt;/);
    assert.deepEqual(rawData, rawBefore);
    const { updateTableRow } = await import('../modules/phone-core/data-api.js');
    const invalid = await updateTableRow('保存', -1, {});
    assert.equal(invalid.code, 'row_index_invalid');
    assert.equal(invalid.message, 'Row update failed: invalid row index', '系统校验错误英译，错误码保持稳定');
    settings.savePhoneSetting('phoneLanguage', 'zh-CN');
    assert.deepEqual(collectAppearanceIconSlots(rawData), englishSlots, '图标身份、匹配名称、类型不随语言改变');
    assert.match(view(), />上传</, '切回中文恢复原文');
    settings.flushPhoneSettingsSave();
    console.log('[通过] 语言设置默认、保存、回读、隔离与非法值保护');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
