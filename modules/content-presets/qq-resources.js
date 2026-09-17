// The adapter uses QQ's public intent. It does not write QQ's database directly.
export async function importQQPresetResources(preset) {
    if (!preset.qq?.resources?.length) return;
    const { initializeQQV2Runtime, getQQV2Facade } = await import('../qq-v2/runtime/default-runtime.js');
    if (!getQQV2Facade()) await initializeQQV2Runtime();
    const result = await getQQV2Facade()?.intent?.importBeautifyPreset({ preset });
    if (!result?.ok) throw new Error(result?.error?.message || 'QQ 装饰素材入库失败，请重试');
}
