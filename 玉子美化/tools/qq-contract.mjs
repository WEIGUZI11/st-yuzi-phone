const LIBRARIES = new Set(['avatar-frame', 'bubble', 'profile-background', 'chat-background']);
const SLOTS = Object.freeze({ avatarFrame: 'avatar-frame', bubble: 'bubble', profileBackground: 'profile-background', chatBackground: 'chat-background' });
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

function object(value, label, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`);
  const unknown = Object.keys(value).find(key => !allowed.includes(key));
  if (unknown) throw new Error(`${label} 包含未知字段：${unknown}`);
}
function id(value, label) {
  const normalized = String(value || '').trim();
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} 必须是稳定 ID`);
  return normalized;
}
function bubbleStyle(value) {
  if (value === undefined) return undefined;
  object(value, 'QQ 气泡参数', ['padding', 'slice', 'radius', 'textColor']);
  const result = {};
  for (const key of ['padding', 'slice', 'radius']) {
    if (value[key] === undefined) continue;
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number < 0 || number > 128) throw new Error(`QQ 气泡 ${key} 必须在 0～128 之间`);
    result[key] = number;
  }
  if (value.textColor !== undefined) {
    const color = String(value.textColor).trim();
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) throw new Error('QQ 气泡 textColor 必须是十六进制颜色');
    result.textColor = color;
  }
  return result;
}
function requireFile(files, file, type) {
  if (!files) return;
  const record = files[file];
  if (!record) throw new Error(`QQ 引用文件不存在：${file}`);
  if (type === 'css' && (record.encoding !== 'text' || record.mimeType !== 'text/css')) throw new Error(`QQ 样式必须是文本 CSS：${file}`);
  if (type === 'image' && (record.encoding !== 'base64' || !/^image\/(?:png|jpeg|webp|gif|avif|bmp)$/i.test(record.mimeType))) throw new Error(`QQ 素材必须是受支持的图片：${file}`);
}
export function normalizeQQManifest(source, { normalizePath = value => String(value || '').trim(), files = null } = {}) {
  object(source, 'manifest.qq', ['theme', 'popup', 'assets', 'resources', 'outfits']);
  const result = {};
  for (const kind of ['theme', 'popup']) {
    if (source[kind] === undefined) continue;
    object(source[kind], `manifest.qq.${kind}`, ['css', 'darkCss']);
    const css = normalizePath(source[kind].css);
    if (!css) throw new Error(`manifest.qq.${kind}.css 不能为空`);
    requireFile(files, css, 'css');
    result[kind] = { css };
    if (source[kind].darkCss !== undefined) {
      const darkCss = normalizePath(source[kind].darkCss);
      requireFile(files, darkCss, 'css');
      result[kind].darkCss = darkCss;
    }
  }
  if (source.assets !== undefined) {
    if (!Array.isArray(source.assets)) throw new Error('manifest.qq.assets 必须是数组');
    const seen = new Set();
    result.assets = source.assets.map((value, index) => {
      const file = normalizePath(value);
      if (seen.has(file)) throw new Error(`manifest.qq.assets[${index}] 重复`);
      seen.add(file);
      if (files) {
        const record = files[file];
        if (!record || /javascript/i.test(record.mimeType)) throw new Error(`QQ 主题资源缺失或类型无效：${file}`);
      }
      return file;
    });
  }
  const resources = new Map();
  if (source.resources !== undefined) {
    if (!Array.isArray(source.resources)) throw new Error('manifest.qq.resources 必须是数组');
    result.resources = source.resources.map((resource, index) => {
      object(resource, `manifest.qq.resources[${index}]`, ['id', 'library', 'file', 'bubble']);
      const resourceId = id(resource.id, `manifest.qq.resources[${index}].id`);
      if (resources.has(resourceId)) throw new Error(`QQ 素材 ID 重复：${resourceId}`);
      const library = String(resource.library || '').trim();
      if (!LIBRARIES.has(library)) throw new Error(`QQ 素材分类无效：${library}`);
      const file = normalizePath(resource.file);
      requireFile(files, file, 'image');
      if (resource.bubble !== undefined && library !== 'bubble') throw new Error('只有气泡素材可以声明 bubble 参数');
      const normalized = { id: resourceId, library, file, ...(resource.bubble !== undefined ? { bubble: bubbleStyle(resource.bubble) } : {}) };
      resources.set(resourceId, normalized);
      return normalized;
    });
  }
  if (source.outfits !== undefined) {
    if (!Array.isArray(source.outfits)) throw new Error('manifest.qq.outfits 必须是数组');
    const ids = new Set();
    result.outfits = source.outfits.map((outfit, index) => {
      object(outfit, `manifest.qq.outfits[${index}]`, ['id', ...Object.keys(SLOTS)]);
      const outfitId = id(outfit.id, `manifest.qq.outfits[${index}].id`);
      if (ids.has(outfitId)) throw new Error(`QQ 套装 ID 重复：${outfitId}`);
      ids.add(outfitId);
      const normalized = { id: outfitId };
      for (const [slot, library] of Object.entries(SLOTS)) {
        const reference = String(outfit[slot] || '').trim();
        if (!reference && (slot === 'avatarFrame' || slot === 'bubble')) throw new Error(`QQ 套装 ${outfitId} 缺少 ${slot}`);
        if (!reference) continue;
        if (resources.get(reference)?.library !== library) throw new Error(`QQ 套装 ${outfitId} 的 ${slot} 引用缺失或分类不符`);
        normalized[slot] = reference;
      }
      return normalized;
    });
  }
  if (!result.theme && !result.popup && !(result.resources?.length > 0)) throw new Error('QQ 美化至少需要主题、通知样式或一个人物素材');
  return result;
}
