const assert = require('node:assert/strict');
(async () => {
    const { buildBuiltinTheaterSnapshot, getBuiltinImageCanvases } = await import('../modules/phone-theater/builtin/model.js');
    const raw = { sheet_square: { name: '广场表', content: [['帖子ID', '发帖账号名', '图片描述', '视频描述'], ['old', '旧人', '旧图', ''], ['new', '新人', '新图', '新视频']] } };
    const snapshot = buildBuiltinTheaterSnapshot(raw, 'sheet_square', 'square');
    assert.deepEqual(snapshot.rows.map(row => row[0]), ['new', 'old'], '用户先看到新动态');
    assert.equal(raw.sheet_square.content[1][0], 'old', '展示倒序不改变物理表');
    assert.deepEqual(snapshot.records.map(row => row.rowIndex), [1, 0], '编辑仍定位原始行');
    const canvases = getBuiltinImageCanvases(snapshot, snapshot.records[0]);
    assert.deepEqual(canvases.map(c => c.promptFields), [['发帖账号名', '图片描述'], ['发帖账号名', '视频描述']], '双画布不能混用描述');
    assert.deepEqual(canvases.map(c => c.canvas), ['image', 'video']);
    assert.equal(getBuiltinImageCanvases(snapshot, snapshot.records[1]).length, 1);
    assert.equal(getBuiltinImageCanvases(snapshot, { fields: {} }).length, 0, '没有描述不显示画布');
    const {createStableImageOwnershipTarget} = await import('../modules/image-generation/stable-image-ownership.js');
    const forum = buildBuiltinTheaterSnapshot({sheet_forum:{name:'论坛表',content:[['发帖账号名','帖子标题','帖子正文'],['网友','标题','内容']]}},'sheet_forum','forum');
    const cover = getBuiltinImageCanvases(forum, forum.records[0])[0];
    assert.doesNotThrow(()=>createStableImageOwnershipTarget({chatScope:'chat:one',physicalTable:'sheet_forum',identityFields:cover.stableIdentityFields,identityValues:forum.records[0].fields,canvas:'cover'}), '可选时间为空仍能建立安全归属');
    console.log('[theater-builtin-behavior] passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
