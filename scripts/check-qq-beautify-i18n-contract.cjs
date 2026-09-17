const assert = require('node:assert/strict');

async function main() {
    const { applyPhoneLanguage, t } = await import('../modules/i18n/index.js');
    const { buildBeautifyTemplatePageHtml } = await import('../modules/settings-app/layout/page-builders/editor-builders.js');
    applyPhoneLanguage('en');
    try {
        const workshop = buildBeautifyTemplatePageHtml({
            status: 'ready',
            presets: [{
                id: 'qq-sakura',
                name: 'Sakura QQ',
                items: [],
                qq: { theme: { css: 'theme.css' }, popup: { css: 'popup.css' } },
            }],
            tables: [],
            qq: {
                bindings: { theme: 'qq-sakura', popup: '' },
                presets: [{
                    id: 'qq-sakura',
                    name: 'Sakura QQ',
                    qq: { theme: { css: 'theme.css' }, popup: { css: 'popup.css' } },
                }],
            },
        });
        for (const chinese of ['主题应用', '弹窗应用', '默认主题（保留个人装饰）', '内置通知样式', '主题与通知独立应用']) {
            assert.doesNotMatch(workshop, new RegExp(chinese), `英文模板工坊仍显示中文：${chinese}`);
        }

        for (const key of [
            '头像框',
            '气泡',
            '导入会追加头像、资料背景、聊天背景和表情，也会追加头像框、气泡和套装；已配套的头像框与气泡会一起保留。相同资源 ID 会自动添加 (1)、(2)。',
            '导入 QQ 美化素材？',
            'QQ 美化应用已更新',
        ]) {
            assert.notEqual(t(key), key, `英文词典缺少 QQ 美化文案：${key}`);
        }
        const importSummary = t`已导入：头像 ${1}，头像框 ${2}，气泡 ${3}，套装 ${4}，资料背景 ${5}，聊天背景 ${6}，表情 ${7}`;
        assert.doesNotMatch(importSummary, /\p{Script=Han}/u, '英文图片资料导入统计仍包含中文');
        const materialSummary = t`将追加保留 ${2} 个 QQ 素材和 ${1} 套装饰；相同素材不重复入库。`;
        assert.doesNotMatch(materialSummary, /\p{Script=Han}/u, '英文 QQ 素材导入确认仍包含中文');
    } finally {
        applyPhoneLanguage('zh-CN');
    }
    console.log('[qq-beautify-i18n] 通过；QQ 工坊、人物装饰和导入统计支持英文模式');
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
