const assert = require('node:assert/strict');
const { FakeElement, installFakeDom } = require('./helpers/qq-ui-fixture.cjs');
const { createHarness, validRecord } = require('./check-content-presets-repository-idb-behavior.cjs');

const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (check()) return;
        await tick();
    }
    assert.ok(check(), '美化挂载应完成');
}
async function main() {
    const document = installFakeDom();
    global.HTMLElement = global.Element = global.HTMLButtonElement = FakeElement;
    document.body = new FakeElement('body'); document.body._rootConnected = true;
    document.getElementById = () => null;
    document.addEventListener = () => {}; document.removeEventListener = () => {};
    FakeElement.prototype.prepend = function (child) { this.append(child); this.children.unshift(this.children.pop()); };
    const records = ['A', 'B'].map(id => {
        const record = validRecord(id, ['page']);
        record.formatVersion = 3;
        record.apiVersion = 2;
        record.manifest.displays = [{
            id: 'popup', name: '测试弹窗', kind: 'inline',
            targets: [record.items[0].target], entry: { mount: 'pages/main.mjs' }, assets: [],
        }];
        record.displays = record.manifest.displays.map(display => ({ ...display, issues: [], activatable: true }));
        record.files['pages/main.mjs'].content = `export function mount(context) {
            context.root.dataset.preset = "${id}";
            const render = state => { context.root.dataset.value = state.rows[0]?.[1] || "empty"; };
            render(context.getState());
            const off = context.subscribe(render);
            return () => off();
        }`;
        return record;
    });
    global.indexedDB = createHarness({ seed: { presets: records } }).factory;
    let raw = {
        sheet_a: { name: '测试表', content: [['row_id', '字段'], [1, '旧数据']] },
        sheet_square: { name: '广场表', content: [['row_id', '正文']] },
    };
    let emit;
    window.AutoCardUpdaterAPI = {
        exportTableAsJson: () => raw,
        registerTableUpdateCallback: callback => { emit = callback; },
        unregisterTableUpdateCallback() {},
    };
    const host = { extensionSettings: {}, saveSettingsDebounced() {}, chatId: 'test-chat' };
    window.getContext = () => host;
    window.setTimeout = setTimeout; window.clearTimeout = clearTimeout;
    window.requestAnimationFrame = global.requestAnimationFrame;
    const { commitContentPresetIndex } = await import('../modules/content-presets/index-state.js');
    const { createContentPresetWorkshopService } = await import('../modules/content-presets/workshop-service.js');
    const { buildBeautifyTemplatePageContext } = await import('../modules/settings-app/page-renderers/page-context-builders.js');
    const { createBeautifyPageBehavior } = await import('../modules/settings-app/pages/beautify-behavior.js');
    const { buildBeautifyTemplatePageHtml } = await import('../modules/settings-app/layout/page-builders/editor-builders.js');
    const { tryRenderContentPreset } = await import('../modules/content-presets/renderer.js');
    const { createBottomContentRenderer } = await import('../modules/bottom-visualization/content-renderer.js');
    const importModule = async url => import(`data:text/javascript;base64,${Buffer.from(await (await fetch(url)).text()).toString('base64')}`);
    commitContentPresetIndex({ status: 'ready', pageByTable: new Map(), bottomByTable: new Map() });
    const service = createContentPresetWorkshopService({ getTableData: () => raw });
    const workshop = new FakeElement();
    document.body.append(workshop);
    const toasts = [];
    let confirmReset;
    const cleanupWorkshop = createBeautifyPageBehavior({ container: workshop }, buildBeautifyTemplatePageContext({
        contentPresetWorkshop: service,
        common: {
            showConfirmDialog(_container, title, _message, callback) {
                assert.equal(title, '全部恢复底部默认？');
                confirmReset = callback;
            },
        },
        feedback: { showToast: (_container, message, isError) => toasts.push({ message, isError }) },
    })).attachPageInteractions();
    async function selectBottomApplication(sheetKey, value, dataset = {}) {
        const select = new FakeElement('select');
        select.dataset = { contentPresetApplication: 'bottom', sheetKey };
        select.value = value;
        select.selectedOptions = value ? [{ dataset }] : [];
        workshop.append(select);
        toasts.length = 0;
        await workshop.dispatch('change', { target: select });
        await until(() => toasts.length > 0);
        assert.deepEqual(toasts, [{ message: '底部美化已保存，重开面板后生效', isError: false }], '真实工坊页面应成功保存底部选择');
        select.remove();
    }
    await service.setPageActive('sheet_a', 'A', 'page');
    await service.setPopupActive('sheet_a', 'A');
    await selectBottomApplication('sheet_a', 'A:page', { presetId: 'A', itemId: 'page' });
    const phone = new FakeElement(); const bottom = new FakeElement();
    document.body.append(phone, bottom);
    await tryRenderContentPreset(phone, { sheetKey: 'sheet_a', route: 'table:sheet_a' }, { renderToken: 0, importModule });
    const renderer = createBottomContentRenderer(bottom, { importModule, onChange: () => { if (bottom.dataset.beautified === 'false') bottom.replaceChildren(); } });
    assert.equal(renderer.update('sheet_a', raw), true);
    await until(() => bottom.children[0]?.dataset.preset === 'A');
    assert.equal(phone.children[0]?.dataset.preset, 'A', '两处挂载同表不能互相销毁');

    await selectBottomApplication('sheet_a', '');
    assert.equal((await service.getViewModel()).tables.find(table => table.sheetKey === 'sheet_a').bottomActive, null, '工坊恢复默认应清除底部绑定');
    assert.equal(bottom.children[0].dataset.preset, 'A', '恢复默认也应延后到重开');
    await selectBottomApplication('sheet_a', 'B:page', { presetId: 'B', itemId: 'page' });
    renderer.update('sheet_a', raw);
    assert.equal(bottom.children[0].dataset.preset, 'A', '仅保存选择不立即换美化');
    raw.sheet_a.content[1][1] = '新数据'; emit(raw);
    assert.equal(bottom.children[0].dataset.value, '新数据', '延后换美化不延后数据更新');
    assert.equal(phone.children[0].dataset.value, '新数据');
    renderer.update('', raw); renderer.update('sheet_a', raw);
    await until(() => bottom.children[0]?.dataset.preset === 'B');
    assert.equal(phone.children[0].dataset.preset, 'A');
    await service.deletePreset('B');
    assert.equal(phone.children[0]?.dataset.preset, 'A', '删除底部使用的包不得影响手机使用的另一个包');
    assert.equal(bottom.children.length, 0, '删包立即停止正在显示的旧包');
    assert.equal(renderer.update('sheet_a', raw), false, '删包后静默回默认');

    assert.equal(renderer.update('sheet_square', raw), false, '小剧场默认也使用普通卡片');
    await selectBottomApplication('sheet_square', 'builtin:square', { builtinScene: 'square' });
    assert.equal(renderer.update('sheet_square', raw), false, '内置美化选择也延后到重新打开');

    await selectBottomApplication('sheet_a', 'A:page', { presetId: 'A', itemId: 'page' });
    const beforeReset = await service.getViewModel();
    assert.match(buildBeautifyTemplatePageHtml(beforeReset), /data-action="clear-all-bottom"[^>]*>全部恢复底部默认<\/button>/, '工坊应提供全部恢复底部默认按钮');
    const resetButton = new FakeElement('button');
    resetButton.dataset.action = 'clear-all-bottom';
    workshop.append(resetButton);
    toasts.length = 0;
    await workshop.dispatch('click', { target: resetButton });
    assert.equal(typeof confirmReset, 'function', '批量恢复应沿用其他两个按钮的确认逻辑');
    assert.equal((await service.getViewModel()).tables.filter(table => table.bottomActive).length, 2, '确认前不得清除底部绑定');
    await confirmReset();
    assert.deepEqual(toasts, [{ message: '全部底部可视化已恢复默认', isError: false }]);
    const afterReset = await service.getViewModel();
    assert.ok(afterReset.tables.every(table => table.bottomActive === null), '导入美化和内置美化都应恢复默认');
    for (const field of ['pageActive', 'popupActive']) {
        assert.deepEqual(afterReset.tables.map(table => table[field]), beforeReset.tables.map(table => table[field]), '批量底部恢复不得影响页面或弹窗绑定');
    }
    assert.deepEqual(afterReset.presets, beforeReset.presets, '批量底部恢复不得删除已导入预设');
    renderer.update('', raw);
    assert.equal(renderer.update('sheet_a', raw), false, '恢复后普通表重开应使用默认卡片');
    assert.equal(renderer.update('sheet_square', raw), false, '恢复后小剧场重开也应使用默认卡片');
    assert.equal(phone.children[0]?.dataset.preset, 'A', '底部批量恢复不得销毁手机页面');
    renderer.dispose();
    cleanupWorkshop();
    assert.equal(bottom.children.length, 0, '关闭底部释放当前内容');
    console.log('[bottom-content-presets-check] 检查通过');
}
main().catch(error => { console.error('[bottom-content-presets-check] 检查失败'); console.error(error); process.exitCode = 1; });
