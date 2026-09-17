const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.resolve(file)).href);

async function main() {
    const previous = { window: global.window, document: global.document, CustomEvent: global.CustomEvent };
    const host = { extensionSettings: { YuziPhone: {} }, saveSettingsDebounced() { throw new Error('测试不得保存真实宿主设置'); } };
    const timers = new Map();
    let nextTimerId = 0;
    global.window = Object.assign(new EventTarget(), {
        getContext: () => host,
        setTimeout(callback) { const id = ++nextTimerId; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
    });
    global.CustomEvent = class extends Event {
        constructor(type, options) { super(type); this.detail = options.detail; }
    };
    let bottom;
    let unsubscribe = () => {};
    try {
        const settings = await load('modules/settings.js');
        bottom = await load('modules/bottom-visualization/index.js');
        global.document = { getElementById: () => null };
        assert.equal(settings.getPhoneSettings().bottomVisualization.enabled, false);
        // 真实后台订阅即使功能关闭也读取设置，会在旧实现中使批量写入的对象失效。
        bottom.startBottomVisualization();
        const observed = [];
        unsubscribe = settings.subscribePhoneSettingsUpdates(({ key }) => {
            observed.push({ key, settings: structuredClone(settings.getPhoneSettings()) });
        });
        const image = value => 'data:image/png;base64,' + Buffer.from(value).toString('base64');
        const makePackPatch = id => ({
            backgroundImage: image(id + '-wallpaper'),
            appIcons: { dock_settings: image(id + '-settings'), qq: image(id + '-qq') },
            appIconOrigins: {},
            appearanceResourcePool: { wallpapers: [], icons: [] },
            appearanceActivePackId: id,
        });
        const applyAndCheck = patch => {
            observed.length = 0;
            assert.equal(settings.savePhoneSettingsPatch(patch), true);
            const current = settings.getPhoneSettings();
            for (const [key, value] of Object.entries(patch)) {
                assert.deepEqual(current[key], value, '批量保存不能丢失字段：' + key);
            }
            assert.deepEqual(observed.map(event => event.key), Object.keys(patch), '保留逐字段通知顺序和次数');
            for (const event of observed) {
                for (const [key, value] of Object.entries(patch)) {
                    assert.deepEqual(event.settings[key], value, '每次通知都必须读到完整批次：' + event.key + ' / ' + key);
                }
            }
        };
        for (const id of ['pack-a', 'pack-b', 'pack-a']) applyAndCheck(makePackPatch(id));
        // 图标单独选择也走批量保存，来源与图片必须一起更新。
        applyAndCheck({ appIcons: { dock_settings: image('selected') }, appIconOrigins: { dock_settings: 'pack-a' } });
        applyAndCheck({ appIcons: {}, appIconOrigins: {}, appearanceActivePackId: '' });
        // 语言通知自身也会读取设置，不能打断同批次的后续字段。
        applyAndCheck({ phoneLanguage: 'en', ...makePackPatch('pack-c') });
        applyAndCheck({ phoneLanguage: 'zh-CN', ...makePackPatch('pack-a') });
        observed.length = 0;
        assert.equal(settings.savePhoneSettingsPatch({}), true);
        assert.equal(observed.length, 0, '空补丁不发通知');
        assert.equal(settings.savePhoneSetting('appearanceActivePackId', 'single'), true);
        assert.equal(settings.getPhoneSettings().appearanceActivePackId, 'single');
        assert.deepEqual(observed.map(event => event.key), ['appearanceActivePackId'], '单项保存仍正常通知');
        assert.deepEqual(host.extensionSettings.YuziPhone, {}, '测试不修改宿主设置');
        console.log('[settings-patch-behavior-check] 检查通过');
    } finally {
        unsubscribe();
        bottom?.stopBottomVisualization();
        timers.clear();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete global[key];
            else global[key] = value;
        }
    }
}

main().catch(error => {
    console.error('[settings-patch-behavior-check] 检查失败：');
    console.error(error);
    process.exitCode = 1;
});
