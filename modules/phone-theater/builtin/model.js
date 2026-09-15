/** Read-only presentation snapshot. Row indexes always address the physical table. */
export function buildBuiltinTheaterSnapshot(rawData, sheetKey, sceneId) {
    const sheet = rawData?.[sheetKey];
    const headers = (sheet?.content?.[0] || []).map(value => String(value ?? '').trim());
    const records = (sheet?.content || []).slice(1).map((row, rowIndex) => ({
        rowIndex,
        values: [...row],
        fields: Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '')])),
    }));
    for(const record of records) {
        const f=record.fields;
        const identity = sceneId === 'square' && String(f['帖子ID'] || f['帖子唯一标识'] || '').trim()
            ? ['post', f['帖子ID'] || f['帖子唯一标识']]
            : sceneId === 'live' ? ['room', f['直播间名'] || 'single-live']
                : [sceneId, f['发帖账号名'] || '', f['帖子标题'] || '', f['时间文本'] || '', f['分区/版面名'] || ''];
        f.__yuzi_theater_identity=JSON.stringify(identity.map(value=>String(value).normalize('NFKC').trim()));
    }
    if (sceneId !== 'live') records.reverse();
    return { sheetKey, sceneId, tableName: sheet?.name || '', headers, records, rows: records.map(row => row.values) };
}

export const BUILTIN_IMAGE_TABLES = Object.freeze({ square: '广场表', forum: '论坛表', live: '直播表' });
const identityFields = ['__yuzi_theater_identity'];
const present = value => Boolean(String(value ?? '').trim()) && !/^(none|null|无|没有)$/i.test(String(value).trim());
export function getBuiltinImageCanvases(snapshot, record) {
    const { sceneId, sheetKey } = snapshot;
    const fields = record.fields;
    const definitions = sceneId === 'square'
        ? [['image', ['发帖账号名', '图片描述'], '2:1'], ['video', ['发帖账号名', '视频描述'], '2:1']].filter(([, names]) => present(fields[names[1]]))
        : sceneId === 'forum' ? [['cover', ['帖子正文'], '16:10']]
            : sceneId === 'live' ? [['background', ['剧情舞台概述'], '']] : [];
    return definitions.map(([canvas, promptFields, ratio]) => ({
        canvas, tableName: sheetKey, stableIdentityFields: identityFields, promptFields, ratio,
        promptSuffix: ratio ? '画布宽高比为 ' + ratio + '，横向构图，主体完整呈现。' : '',
    }));
}
