const assert = require('node:assert/strict');
(async () => {
    const { normalizeImageGenerationSettings } = await import('../modules/settings/schema.js');
    const config = normalizeImageGenerationSettings({enabled:true, qqEnabled:false, theaterEnabled:{square:true}});
    assert.equal(config.qqEnabled, false, 'QQ 按钮可以独立关闭');
    assert.deepEqual(config.theaterEnabled, {square:true, forum:false, live:false}, '内置表格生图明确选择才开启');
    assert.equal(normalizeImageGenerationSettings({enabled:true}).qqEnabled, true, '旧配置保持 QQ 使用习惯');
    console.log('[theater-image-settings] passed');
})().catch(error => { console.error(error); process.exitCode=1; });
