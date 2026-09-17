const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
async function main() {
    const root = path.resolve(__dirname, '..');
    const workshop = path.join(root, '玉子美化');
    const canvas = JSON.parse(fs.readFileSync(path.join(workshop, 'examples/image-avatar/canvas.json'), 'utf8'));
    const { normalizePageItemHostCapabilities } = await import(pathToFileURL(path.join(root, 'modules/content-presets/display-contract.js')).href);
    const target = { tableName: canvas.tableName, fields: [...new Set([...canvas.stableIdentityFields, ...canvas.promptFields])] };
    // The host receives the same author declaration that ships in the standalone kit.
    const normalized = normalizePageItemHostCapabilities({ target, imageGeneration: { canvases: [canvas] } });
    assert.deepEqual(normalized.imageGeneration.canvases[0], canvas);
    assert.throws(() => normalizePageItemHostCapabilities({ target, imageGeneration: { canvases: [{ ...canvas, promptSuffix: 1 }] } }));
    const { createContentPresetImageActions } = await import(pathToFileURL(path.join(root, 'modules/content-presets/image-actions.js')).href);
    const actions = createContentPresetImageActions({ declaration: { imageGeneration: { canvases: [canvas] } }, imageGenerationService: { async generate() {}, async read() {} } });
    const docs = fs.readFileSync(path.join(workshop, 'docs/runtime/host-capabilities.md'), 'utf8');
    const types = fs.readFileSync(path.join(workshop, 'docs/runtime/host-capabilities.d.ts'), 'utf8');
    for (const name of Object.keys(actions)) {
        assert.ok(docs.includes(name), `作者文档缺少宿主动作：${name}`);
        assert.ok(types.includes(name + '('), `作者类型缺少宿主动作：${name}`);
    }

    const handoff = fs.readFileSync(path.join(root, 'docs/content-preset-authoring-handoff.md'), 'utf8');
    const qqDocs = fs.readFileSync(path.join(workshop, 'docs/runtime/qq-authoring-workflow.md'), 'utf8');
    assert.ok(handoff.includes('qq-authoring-workflow.md'), '维护者交接必须登记 QQ 作者文档');
    for (const flag of ['--theme-css', '--theme-dark-css', '--popup-css', '--popup-dark-css', '--asset', '--resource', '--outfit', '--replace']) {
        assert.ok(qqDocs.includes(flag), `QQ 作者文档缺少 CLI 参数：${flag}`);
    }
    for (const term of ['manifest.qq', 'avatar-frame', 'bubble', 'profile-background', 'chat-background', 'padding', 'slice', 'radius', 'textColor']) {
        assert.ok(qqDocs.includes(term), `QQ 作者文档缺少合同说明：${term}`);
    }
    assert.match(qqDocs, /主题资源[\s\S]*人物图库|人物图库[\s\S]*主题资源/, 'QQ 作者文档必须区分主题资源与人物图库');
    assert.match(qqDocs, /不(?:得|能).*(?:位置|调度|生命周期|动画)|(?:位置|调度|生命周期|动画).*不(?:得|能)/, 'QQ 作者文档必须说明通知 CSS 的逻辑边界');
    assert.match(qqDocs, /真实小手机[\s\S]*待验收|待验收[\s\S]*真实小手机/, 'QQ 作者文档必须说明真实宿主验收边界');

    const packageJson = JSON.parse(fs.readFileSync(path.join(workshop, 'package.json'), 'utf8'));
    assert.match(packageJson.scripts?.['project:add-qq'] || '', /project-add-qq\.mjs/, '制作包必须公开 project:add-qq 命令');
    const { buildBundle, validateBundle } = await import(pathToFileURL(path.join(workshop, 'tools/lib.mjs')).href);
    const qqExampleProject = path.join(workshop, 'examples/qq-beautify/project.json');
    const qqBundle = await buildBundle(qqExampleProject);
    assert.equal(qqBundle.manifest.items.length, 0, '纯 QQ 示例不得伪造表格 item');
    assert.deepEqual(qqBundle.manifest.displays, [], '纯 QQ 示例不得伪造展示应用');
    assert.ok(qqBundle.manifest.qq?.theme, '纯 QQ 示例必须包含主题声明');
    assert.ok(qqBundle.manifest.qq?.popup, '纯 QQ 示例必须包含通知浮窗声明');
    assert.ok(qqBundle.manifest.qq?.resources?.length >= 2, '纯 QQ 示例必须包含头像框和气泡人物素材');
    assert.ok(qqBundle.manifest.qq?.outfits?.length >= 1, '纯 QQ 示例必须包含人物装饰套装');
    assert.equal(validateBundle(qqBundle, { strict: true, tables: [] }).ok, true, '纯 QQ 示例必须通过制作端严格检查');

    const { importContentPreset, readbackContentPreset } = await import(pathToFileURL(path.join(root, 'modules/content-presets/import-export.js')).href);
    const qqRecord = importContentPreset(qqBundle);
    assert.deepEqual(qqRecord.qq, qqBundle.manifest.qq, '宿主必须保留制作端生成的 QQ 声明');
    assert.deepEqual(readbackContentPreset(qqRecord).record.qq, qqRecord.qq, 'QQ 声明必须通过宿主导出回读');

    console.log('[beautify-authoring-handoff] 通过；表格图片能力与 QQ 制作、示例、宿主回读文档一致');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
