import { getAppearanceIconDisplayName } from './icon-slots.js';
import { t } from '../../../i18n/index.js';
import { getTableData } from '../../../phone-core/data-api.js';
import {
    getPhoneSettings,
    savePhoneSetting,
} from '../../../settings.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';
import { Logger } from '../../../error-handler.js';
import { showToast } from '../../ui/toast.js';
import { collectAppearanceIconSlots } from './icon-slots.js';

const logger = Logger.withScope({ scope: 'settings-app/services/appearance-settings/visibility-settings', feature: 'settings-app' });

function normalizeHiddenTableApps(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const map = {};
    Object.entries(raw).forEach(([key, value]) => {
        if (!key) return;
        if (value) map[key] = true;
    });
    return map;
}

export function setupAppearanceToggles(container) {
    const badgeToggle = container.querySelector('#phone-hide-table-count-badge');
    if (!badgeToggle) {
        return () => {};
    }

    const onChange = () => {
        savePhoneSetting('hideTableCountBadge', !!badgeToggle.checked);
        showToast(container, badgeToggle.checked ? t("已隐藏数量徽标") : t("已显示数量徽标"));
    };

    badgeToggle.addEventListener('change', onChange);
    return () => {
        badgeToggle.removeEventListener('change', onChange);
    };
}

export function renderHiddenTableAppsList(listEl, options = {}) {
    if (!listEl) return () => {};
    const hiddenMap = normalizeHiddenTableApps(getPhoneSettings().hiddenTableApps);
    const cleanups = [];

    const addCleanup = (cleanup) => {
        if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
        }
    };

    const allItems = (Array.isArray(options.items)
        ? options.items
        : collectAppearanceIconSlots(getTableData()))
        .filter(item => item.type !== 'dock');

    if (allItems.length === 0) {
        listEl.innerHTML = `<div class="phone-ios-row phone-ios-row-empty">${t("暂无表格可配置")}</div>`;
        return () => {};
    }

    // 开关语义为「在首页显示」：打开 = 未隐藏；底层仍写 hiddenTableApps，数据结构不变。
    listEl.innerHTML = allItems.map((item) => {
        const visible = !hiddenMap[item.key];
        const inputId = `phone-table-app-visible-${escapeHtmlAttr(item.key)}`;
        return `
            <label class="phone-ios-row phone-appearance-check-item" for="${inputId}" data-sheet-key="${escapeHtmlAttr(item.key)}">
                <span class="phone-ios-row-label">${escapeHtml(getAppearanceIconDisplayName(item))}</span>
                <span class="phone-ios-switch">
                    <input type="checkbox" id="${inputId}" role="switch" ${visible ? 'checked' : ''}>
                    <span class="phone-ios-switch-track" aria-hidden="true"></span>
                </span>
            </label>
        `;
    }).join('');

    listEl.querySelectorAll('.phone-appearance-check-item').forEach((itemEl) => {
        const checkbox = itemEl.querySelector('input[type="checkbox"]');
        const sheetKey = itemEl.getAttribute('data-sheet-key') || '';
        if (!checkbox || !sheetKey) return;

        const onChange = () => {
            const current = normalizeHiddenTableApps(getPhoneSettings().hiddenTableApps);
            if (checkbox.checked) {
                delete current[sheetKey];
            } else {
                current[sheetKey] = true;
            }
            savePhoneSetting('hiddenTableApps', current);
            showToast(listEl, checkbox.checked ? t("已在首页显示") : t("已从首页隐藏"));
        };

        checkbox.addEventListener('change', onChange);
        addCleanup(() => checkbox.removeEventListener('change', onChange));
    });

    return () => {
        const tasks = [...cleanups];
        cleanups.length = 0;
        tasks.reverse().forEach((cleanup) => {
            try {
                cleanup();
            } catch (error) {
                logger.warn('visibility cleanup 执行失败', error);
            }
        });
    };
}
