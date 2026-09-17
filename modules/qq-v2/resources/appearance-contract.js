export const QQ_OUTFIT_SLOTS = Object.freeze({ avatarFrame: 'avatar-frame', bubble: 'bubble', profileBackground: 'profile-background', chatBackground: 'chat-background' });
export function normalizeBubbleStyle(value) {
    if (value === undefined) return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['padding', 'slice', 'radius', 'textColor'].includes(key))) throw new Error('QQ 气泡参数无效');
    for (const key of ['padding', 'slice', 'radius']) if (value[key] !== undefined && (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 128)) throw new Error('QQ 气泡尺寸无效');
    if (value.textColor !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.textColor)) throw new Error('QQ 气泡文字颜色无效');
    return { ...value };
}
export function normalizeOutfits(value = [], assets) {
    if (!Array.isArray(value)) throw new Error('QQ 套装必须是数组');
    const seen = new Set();
    return value.map(outfit => {
        if (!outfit || typeof outfit.id !== 'string' || !outfit.id || outfit.id.length > 256 || seen.has(outfit.id) || Object.keys(outfit).some(key => !['id', ...Object.keys(QQ_OUTFIT_SLOTS)].includes(key))) throw new Error('QQ 套装 ID 或字段无效');
        seen.add(outfit.id);
        for (const [slot, library] of Object.entries(QQ_OUTFIT_SLOTS)) {
            if (!outfit[slot] && slot !== 'avatarFrame' && slot !== 'bubble') continue;
            if (assets[outfit[slot]]?.library !== library) throw new Error('QQ 套装引用无效：' + slot);
        }
        return { ...outfit };
    });
}
