const assert = require('assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = file => import(`${pathToFileURL(path.resolve(file)).href}?t=${Date.now()}-${Math.random()}`);

function candidate(presetId, itemId, name) {
    return {
        presetId,
        itemId,
        preset: { id: presetId, name: `${name}预设` },
        item: { id: itemId, name },
    };
}

async function main() {
    const { buildBeautifyTemplatePageHtml } = await load('modules/settings-app/layout/page-builders/editor-builders.js');
    const page = candidate('page-preset', 'page-item', '页面美化');
    const popup = candidate('popup-preset', 'popup-item', '正文卡片');
    const html = buildBeautifyTemplatePageHtml({
        status: 'ready',
        presets: [{ id: 'internal-preset-id', name: '测试预设', items: [page.item], issues: [{ code: 'TEST_ISSUE', message: '需要检查的兼容性问题' }] }],
        tables: [{
            sheetKey: 'sheet-square',
            tableName: '广场表',
            headers: ['帖子编号', '正文'],
            pageCandidates: [page],
            pageActive: { presetId: page.presetId, itemId: page.itemId },
            popupCandidates: [popup],
            popupActive: { presetId: popup.presetId },
            presentation: 'theater',
            sceneId: 'square',
            bottomActive: { kind: 'builtin', sceneId: 'square' },
        }],
    });

    assert.match(html, /表格美化应用/, '工坊必须单独显示表格美化应用下拉框');
    assert.match(html, /弹窗应用/, '工坊必须单独显示弹窗应用下拉框');
    assert.match(html, /data-content-preset-application="page"/, '页面下拉框必须声明页面应用类型');
    assert.match(html, /data-content-preset-application="popup"/, '弹窗下拉框必须声明弹窗应用类型');
    assert.match(html, /data-content-preset-current-value="page-preset:page-item"/, '页面下拉框必须保留当前真实绑定值');
    assert.match(html, /data-content-preset-current-value="popup-preset"/, '弹窗下拉框必须保留当前真实绑定值');
    assert.match(html, /data-preset-id="page-preset"/, '页面候选只能出现在页面应用选择中');
    assert.match(html, /data-preset-id="popup-preset"/, '弹窗候选只能出现在弹窗应用选择中');
    assert.match(html, />默认页面<\/option>/, '页面下拉框必须允许恢复默认页面');
    assert.match(html, />内置展示<\/option>/, '弹窗下拉框必须允许移除自定义展示而保留内置展示');
    assert.match(html, /data-action="clear-all-page"/, '工坊必须明确支持只恢复全部页面默认值');
    assert.match(html, /data-action="clear-all-popup"/, '工坊必须明确支持只清空全部弹窗应用');
    assert.match(html, /selected/, '两个应用的当前值必须可独立呈现');
    const bottom = html.match(/<select[^>]*data-content-preset-application="bottom"[\s\S]*?<\/select>/)?.[0];
    assert.ok(bottom, '每张表必须提供独立的底部可视化美化选择');
    assert.match(bottom, />默认<\/option>/, '底部默认始终是普通卡片，不是手机内置界面');
    assert.match(bottom, /data-builtin-scene="square" selected>内置美化<\/option>/);
    assert.match(bottom, /data-preset-id="page-preset"/, '底部复用同一份已导入页面美化');
    const ordinary = buildBeautifyTemplatePageHtml({ status: 'ready', tables: [{ sheetKey: 'sheet-normal', pageCandidates: [page] }] });
    assert.doesNotMatch(ordinary, /data-builtin-scene=/, '普通表格不得提供内置小剧场美化');

    assert.doesNotMatch(html, /sheetKey：|字段：|帖子编号|同 ID 导入会要求确认|ID：internal-preset-id/,
        '工坊不得常驻展示字段清单、内部标识说明和重复覆盖提示');
    assert.match(html, /1个模板项/, '预设保留动态模板项数量');
    assert.match(html, /测试预设/);
    assert.match(html, /导入后，请分别选择页面和弹窗应用。/);
    assert.match(html, /TEST_ISSUE/); assert.match(html, /需要检查的兼容性问题/, '校验问题仍须展示');
    assert.match(html, /data-sheet-key="sheet-square"/, '隐藏说明不移除内部表绑定');
    assert.match(html, /data-action="export" data-preset-id="internal-preset-id"/);
    assert.match(html, /data-action="delete" data-preset-id="internal-preset-id"/);
    for (const status of ['error', 'unavailable']) {
        assert.match(buildBeautifyTemplatePageHtml({ status, error: { message: '读取失败' } }), /模板仓库不可用：读取失败/);
    }
    assert.match(buildBeautifyTemplatePageHtml({ status: 'loading' }), /正在读取模板仓库/);
    console.log('[content-presets-dual-application-ui-check] 检查通过');
}

main().catch(error => {
    console.error('[content-presets-dual-application-ui-check] 检查失败');
    console.error(error);
    process.exitCode = 1;
});
