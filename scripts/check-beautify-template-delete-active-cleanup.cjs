const fs = require('fs');
const assert = require('assert/strict');

const legacyRepository = fs.readFileSync('modules/phone-beautify-templates/repository.js', 'utf8');
const contentRepository = fs.readFileSync('modules/content-presets/repository.js', 'utf8');
const workshop = fs.readFileSync('modules/content-presets/workshop-service.js', 'utf8');
const behavior = fs.readFileSync('modules/settings-app/pages/beautify-behavior.js', 'utf8');

assert.ok(legacyRepository.includes('export function deletePhoneBeautifyUserTemplate(templateId)'));
assert.ok(legacyRepository.includes('createBeautifyUserTemplateWriteDisabledResult()'));
assert.ok(!legacyRepository.includes('cleanupActiveSettingsForDeletedTemplate'));

for (const operation of ['replacePresetRecord', 'deletePresetRecord']) {
    const start = contentRepository.indexOf(`export async function ${operation}`);
    assert.notEqual(start, -1, `${operation} 必须存在`);
    const body = contentRepository.slice(start, contentRepository.indexOf('\n}', start) + 2);
    assert.ok(
        body.includes('[CONTENT_PRESET_STORES.presets, CONTENT_PRESET_STORES.activeByTable, CONTENT_PRESET_STORES.popupByTable, CONTENT_PRESET_STORES.appBindings, CONTENT_PRESET_STORES.bottomByTable]'),
        `${operation} 必须在同一事务覆盖预设、页面应用、弹窗应用、独立 App 应用与底部应用 store`,
    );
    assert.ok(body.includes('removeAllPresetBindings(tx,'), `${operation} 必须在事务内清理页面、弹窗、独立 App 和底部引用绑定`);
}
const cleanupStart = contentRepository.indexOf('function removeAllPresetBindings(');
assert.notEqual(cleanupStart, -1, '统一绑定清理函数必须存在');
const cleanupBody = contentRepository.slice(cleanupStart, contentRepository.indexOf('\n}', cleanupStart) + 2);
for (const store of ['activeByTable', 'popupByTable', 'appBindings', 'bottomByTable']) {
    assert.ok(
        cleanupBody.includes(`removePresetBindings(tx, presetId, CONTENT_PRESET_STORES.${store})`),
        `统一绑定清理必须覆盖 ${store}`,
    );
}
assert.ok(workshop.includes('deletePreset: presetId => withCommittedMutation('));
assert.ok(workshop.includes('() => runtimeDeps.deletePresetRecord(presetId)'));
assert.ok(workshop.includes('metadata.delete(result.presetId)'));
assert.ok(workshop.includes('pageByTable: withoutPreset(pageBindings(current), result.presetId)'));
assert.ok(workshop.includes('popupByTable: withoutPreset(popupBindings(current), result.presetId)'));
assert.ok(workshop.includes('bottomByTable: withoutPreset(current.bottomByTable, result.presetId)'));
assert.ok(behavior.includes('service.deletePreset(presetId)'));
assert.ok(behavior.includes('并原子清除引用它的表格及 QQ 应用绑定'));

console.log('[beautify-template-delete-active-cleanup-check] 新工坊原子删除、表格双应用、底部与 QQ 应用清理、旧禁写边界检查通过');
