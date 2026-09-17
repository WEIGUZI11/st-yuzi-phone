import { normalizePackagePath } from './paths.js';

const LIBRARIES = new Set(['avatar', 'profile-background', 'chat-background', 'avatar-frame', 'bubble']);
const OUTFIT_SLOTS = { avatarFrame: 'avatar-frame', bubble: 'bubble', profileBackground: 'profile-background', chatBackground: 'chat-background' };
function requireObject(value, keys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('QQ ' + label + '字段无效');
}
function id(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value)) throw new Error('QQ 资源或套装 ID 无效');
    return value;
}
function fileAt(value, files, css = false) {
    let name;
    try { name = normalizePackagePath(value); } catch { throw new Error('QQ 资源路径无效'); }
    const file = files[name];
    if (!file || (css ? file.mimeType !== 'text/css' || file.encoding !== 'text' : !/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(file.mimeType) || file.encoding !== 'base64')) throw new Error('QQ 资源文件缺失或类型无效：' + name);
    return name;
}
export function normalizeQQPreset(source, files) {
    requireObject(source, ['theme', 'popup', 'assets', 'resources', 'outfits'], '美化声明');
    const result = {};
    for (const kind of ['theme', 'popup']) {
        if (source[kind] === undefined) continue;
        requireObject(source[kind], ['css', 'darkCss'], kind);
        result[kind] = { css: fileAt(source[kind].css, files, true) };
        if (source[kind].darkCss !== undefined) result[kind].darkCss = fileAt(source[kind].darkCss, files, true);
    }
    if (source.assets !== undefined) {
        if (!Array.isArray(source.assets)) throw new Error('QQ 主题 assets 必须是数组');
        const seen = new Set();
        result.assets = source.assets.map(value => {
            const path = normalizePackagePath(value);
            if (seen.has(path) || !files[path] || /javascript/i.test(files[path].mimeType)) throw new Error('QQ 主题资源缺失、重复或类型无效：' + path);
            seen.add(path);
            return path;
        });
    }
    const resources = new Map();
    if (source.resources !== undefined) {
        if (!Array.isArray(source.resources)) throw new Error('QQ 资源必须是数组');
        result.resources = source.resources.map(resource => {
            requireObject(resource, ['id', 'library', 'file', 'bubble'], '资源');
            id(resource.id);
            if (resources.has(resource.id) || !LIBRARIES.has(resource.library)) throw new Error('QQ 资源 ID 重复或分类无效');
            fileAt(resource.file, files);
            if (resource.bubble !== undefined) {
                if (resource.library !== 'bubble') throw new Error('QQ 气泡参数只能用于气泡');
                requireObject(resource.bubble, ['padding', 'slice', 'radius', 'textColor'], '气泡');
                for (const key of ['padding', 'slice', 'radius']) if (resource.bubble[key] !== undefined && (!Number.isFinite(resource.bubble[key]) || resource.bubble[key] < 0 || resource.bubble[key] > 128)) throw new Error('QQ 气泡尺寸无效');
                if (resource.bubble.textColor !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(resource.bubble.textColor)) throw new Error('QQ 气泡文字颜色无效');
            }
            resources.set(resource.id, resource);
            return structuredClone(resource);
        });
    }
    if (source.outfits !== undefined) {
        if (!Array.isArray(source.outfits)) throw new Error('QQ 套装必须是数组');
        const ids = new Set();
        result.outfits = source.outfits.map(outfit => {
            requireObject(outfit, ['id', ...Object.keys(OUTFIT_SLOTS)], '套装');
            id(outfit.id);
            if (ids.has(outfit.id)) throw new Error('QQ 套装 ID 重复');
            ids.add(outfit.id);
            for (const [slot, library] of Object.entries(OUTFIT_SLOTS)) {
                if (outfit[slot] === undefined && slot !== 'avatarFrame' && slot !== 'bubble') continue;
                if (resources.get(outfit[slot])?.library !== library) throw new Error('QQ 套装引用缺失或分类不符：' + slot);
            }
            return structuredClone(outfit);
        });
    }
    if (!result.theme && !result.popup && !result.resources?.length) throw new Error('QQ 美化声明不能为空');
    return Object.freeze(result);
}
