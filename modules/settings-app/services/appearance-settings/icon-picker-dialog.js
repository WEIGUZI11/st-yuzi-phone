import { t } from '../../../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';
import {
    showSettingsActionSheet,
    showSettingsSheet,
} from '../../ui/settings-layer.js';

// 图标操作菜单与「从美化包选择」面板：外观复用设置公共弹层（settings-layer.js）。

/**
 * 图标操作菜单：从美化包选择 / 从本地上传 / 恢复默认 / 取消。
 * 没有可用美化包时不显示「从美化包选择」；未自定义时不显示「恢复默认」。
 */
export function showAppearanceIconSourceMenu({
    packName = '',
    iconName = '',
    previewHtml = '',
    onLocalUpload,
    onPackSelect,
    onReset,
    runtime = null,
} = {}) {
    const actions = [];
    if (typeof onPackSelect === 'function') {
        actions.push({ label: t`从「${packName || t("当前美化包")}」中选择`, onSelect: onPackSelect });
    }
    actions.push({ label: t`从本地上传图片`, onSelect: onLocalUpload });
    if (typeof onReset === 'function') {
        actions.push({ label: t`恢复默认图标`, danger: true, onSelect: onReset });
    }
    return showSettingsActionSheet({
        title: iconName ? t`更换「${iconName}」图标` : t`更换图标`,
        captionHtml: previewHtml
            ? `<span class="phone-ios-icon-cell-art" aria-hidden="true">${previewHtml}</span>`
            : '',
        actions,
        runtime,
    });
}

function normalizeMatchName(value) {
    return String(value || '').trim().toLowerCase();
}

/**
 * 从美化包选择图标：底部面板 + 4 列图标网格；与当前图标位同名的图标标记为推荐。
 */
export function showAppearancePackIconPicker({ packName, icons, slotName = '', onSelect, runtime = null } = {}) {
    const items = Array.isArray(icons) ? icons.filter(icon => icon?.dataUrl) : [];
    if (items.length === 0) return null;

    const matchName = normalizeMatchName(slotName);
    const gridHtml = items.map((icon, index) => {
        const isMatch = !!matchName && normalizeMatchName(icon.name) === matchName;
        return `
            <button type="button" class="phone-ios-icon-cell${isMatch ? ' is-match' : ''}" role="option" data-pack-icon-index="${index}" aria-label="${escapeHtmlAttr(t`使用 ${icon.name}`)}">
                <span class="phone-ios-icon-cell-art"><img src="${escapeHtmlAttr(icon.dataUrl)}" alt=""></span>
                <span class="phone-ios-icon-cell-label">${escapeHtml(icon.name)}</span>
            </button>
        `;
    }).join('');

    const sheet = showSettingsSheet({
        title: t`选择图标`,
        subtitle: t`${packName || t("当前美化包")} · ${items.length} 个图标`,
        bodyHtml: `<div class="phone-ios-group"><div class="phone-ios-icon-grid" role="listbox" aria-label="${escapeHtmlAttr(t`美化包图标`)}">${gridHtml}</div></div>`,
        footer: matchName ? t`带描边的是与当前图标位同名的图标，点按即替换。` : '',
        runtime,
    });
    if (!sheet) return null;
    sheet.overlay.querySelectorAll('[data-pack-icon-index]').forEach((button) => {
        sheet.bind(button, 'click', () => {
            const icon = items[Number(button.getAttribute('data-pack-icon-index'))];
            if (!icon) return;
            sheet.close();
            onSelect?.(icon);
        });
    });
    return sheet.close;
}
