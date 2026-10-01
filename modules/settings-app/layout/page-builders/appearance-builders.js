import { t, getPhoneLanguage } from '../../../i18n/index.js';
import {
    buildSettingsPageFrame,
    buildSettingsSectionHtml,
} from '../primitives.js';
import { PHONE_ICONS } from '../../../phone-home/icons.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
    if (value >= 1024) return `${Math.round(value / 1024)}KB`;
    return `${Math.max(0, Math.round(value))}B`;
}

// 界面外观页：iOS 分组列表结构。原生 select / input 隐藏保留，外观由 settings-controls.js 桥接，
// 既有服务仍按原 id 监听 change / input。规范见 docs/phone-ui-variables.md「设置分组列表」。

const CHEVRON_HTML = '<span class="phone-ios-row-chevron" aria-hidden="true">›</span>';

function buildSelectRowHtml({ selectId, label, valueText, sheetFooter = '' }) {
    return `
        <button type="button" class="phone-ios-row is-tappable" data-settings-select="${escapeHtmlAttr(selectId)}" data-sheet-footer="${escapeHtmlAttr(sheetFooter)}" aria-haspopup="dialog">
            <span class="phone-ios-row-label">${escapeHtml(label)}</span>
            <span class="phone-ios-row-value"><span class="phone-ios-row-value-text">${escapeHtml(valueText)}</span>${CHEVRON_HTML}</span>
        </button>
    `;
}

function buildSegRowHtml({ selectId, label, value, options }) {
    return `
        <div class="phone-ios-row">
            <span class="phone-ios-row-label">${escapeHtml(label)}</span>
            <div class="phone-ios-seg" role="group" aria-label="${escapeHtmlAttr(label)}" data-settings-seg="${escapeHtmlAttr(selectId)}">
                ${options.map(option => `<button type="button" class="phone-ios-seg-item" data-value="${escapeHtmlAttr(option.value)}" aria-pressed="${option.value === value ? 'true' : 'false'}">${escapeHtml(option.label)}</button>`).join('')}
            </div>
        </div>
    `;
}

function buildStepperRowHtml({ inputId, label, value, min, max, step = 1, inputStep = '', unit = 'px' }) {
    const display = `${Math.round(Number(value) * 1000) / 1000}${unit}`;
    return `
        <div class="phone-ios-row">
            <span class="phone-ios-row-label">${escapeHtml(label)}</span>
            <div class="phone-ios-stepper" data-settings-stepper="${escapeHtmlAttr(inputId)}" data-step="${escapeHtmlAttr(step)}" data-unit="${escapeHtmlAttr(unit)}">
                <button type="button" class="phone-ios-stepper-btn" data-direction="-1" aria-label="${escapeHtmlAttr(t`减少${label}`)}">−</button>
                <output class="phone-ios-stepper-value">${escapeHtml(display)}</output>
                <button type="button" class="phone-ios-stepper-btn" data-direction="1" aria-label="${escapeHtmlAttr(t`增加${label}`)}">+</button>
            </div>
            <input type="number" id="${escapeHtmlAttr(inputId)}" min="${escapeHtmlAttr(min)}" max="${escapeHtmlAttr(max)}" ${inputStep ? `step="${escapeHtmlAttr(inputStep)}"` : ''} value="${escapeHtmlAttr(value)}" hidden>
        </div>
    `;
}

function buildFontLibraryOptionsHtml(fontLibrary) {
    const activeFontId = String(fontLibrary?.activeFontId || 'builtin.system-ui');
    const options = Array.isArray(fontLibrary?.options) ? fontLibrary.options : [];
    const buildOption = (font) => {
        const id = String(font?.id || '').trim();
        if (!id) return '';
        const name = String(font?.name || id);
        const short = `${font?.builtin ? t("内置") : t("用户")} · ${name}`;
        return `<option value="${escapeHtmlAttr(id)}" data-short="${escapeHtmlAttr(short)}" ${id === activeFontId ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    };
    const builtinHtml = options.filter(font => font?.builtin).map(buildOption).join('');
    const userHtml = options.filter(font => !font?.builtin).map(buildOption).join('');
    return `
        ${builtinHtml ? `<optgroup label="${escapeHtmlAttr(t("内置"))}">${builtinHtml}</optgroup>` : ''}
        ${userHtml ? `<optgroup label="${escapeHtmlAttr(t("我导入的"))}">${userHtml}</optgroup>` : ''}
    `;
}

function buildThemeSectionHtml({ phoneThemeMode, homeAppLabelColorMode }) {
    const language = getPhoneLanguage();
    return `
        <h2 class="phone-ios-group-header">${t("主题与背景")}</h2>
        <section class="phone-ios-group">
            ${buildSegRowHtml({ selectId: 'phone-theme-mode-select', label: t`主题模式`, value: phoneThemeMode, options: [{ value: 'light', label: t`白天` }, { value: 'dark', label: t`夜间` }] })}
            ${buildSegRowHtml({ selectId: 'phone-home-app-label-color-mode', label: t`首页名称颜色`, value: homeAppLabelColorMode, options: [{ value: 'white', label: t`白色` }, { value: 'black', label: t`黑色` }] })}
            ${buildSelectRowHtml({ selectId: 'phone-language-select', label: '语言 / Language', valueText: language === 'en' ? 'English' : '简体中文' })}
            <select id="phone-theme-mode-select" class="phone-settings-select" hidden>
                <option value="light" ${phoneThemeMode === 'light' ? 'selected' : ''}>${t`白天`}</option>
                <option value="dark" ${phoneThemeMode === 'dark' ? 'selected' : ''}>${t`夜间`}</option>
            </select>
            <select id="phone-home-app-label-color-mode" class="phone-settings-select" hidden>
                <option value="white" ${homeAppLabelColorMode === 'white' ? 'selected' : ''}>${t`白色`}</option>
                <option value="black" ${homeAppLabelColorMode === 'black' ? 'selected' : ''}>${t`黑色`}</option>
            </select>
            <select id="phone-language-select" class="phone-settings-select" hidden>
                <option value="zh-CN" data-sub="Simplified Chinese" ${language === 'zh-CN' ? 'selected' : ''}>简体中文</option>
                <option value="en" data-sub="英语" ${language === 'en' ? 'selected' : ''}>English</option>
            </select>
        </section>
        <section class="phone-ios-group">
            <button type="button" class="phone-ios-row is-action" id="phone-upload-bg">${t`上传背景图`}</button>
            <button type="button" class="phone-ios-row is-action is-danger" id="phone-clear-bg" aria-haspopup="dialog">${t`清除背景`}</button>
        </section>
        <p class="phone-ios-group-footer">${t("上传的图片会作为首页壁纸显示。")}</p>
    `;
}

function buildPackSectionHtml() {
    return `
        <h2 class="phone-ios-group-header">${t("外观资源包")}</h2>
        <div id="phone-appearance-pack-repository" class="phone-appearance-pack-repository">
            <div id="phone-appearance-pack-repository-list" class="phone-appearance-pack-repository-list" aria-live="polite"></div>
        </div>
        <section class="phone-ios-group">
            <button type="button" class="phone-ios-row is-action" id="phone-import-appearance-pack">${t`导入到仓库`}</button>
            <button type="button" class="phone-ios-row is-action" id="phone-export-appearance-pack">${t`导出当前外观`}</button>
            <input type="file" id="phone-appearance-pack-file" accept="application/json,.json" hidden>
        </section>
        <p class="phone-ios-group-footer">${t("导入官方美化包。")}${t("导出只打包当前背景与自定义图标。")}</p>
    `;
}
function buildFontSectionHtml(fontLibrary) {
    const activeFont = fontLibrary?.activeFont || {};
    const userFontCount = Number(fontLibrary?.stats?.userFontCount) || 0;
    const maxFonts = Number(fontLibrary?.limits?.maxFonts) || 0;
    const totalFontBytes = Number(fontLibrary?.stats?.totalBytes) || 0;
    const maxTotalFontBytes = Number(fontLibrary?.limits?.totalFontBytes) || 0;
    const singleFontBytes = Number(fontLibrary?.limits?.singleFontBytes) || 0;
    const canDeleteActiveFont = !!activeFont?.id && !activeFont?.builtin;
    const activeShort = `${activeFont?.builtin === false ? t("用户") : t("内置")} · ${String(activeFont?.name || t("系统默认"))}`;
    const quotaText = t`${escapeHtml(String(userFontCount))}/${escapeHtml(String(maxFonts))} 个 · ${escapeHtml(formatBytes(totalFontBytes))}/${escapeHtml(formatBytes(maxTotalFontBytes))} · 单文件 ≤${escapeHtml(formatBytes(singleFontBytes))}`;
    return `
        <h2 class="phone-ios-group-header">${t("字体库")}</h2>
        <section class="phone-ios-group">
            <div class="phone-ios-font-preview" id="phone-font-preview" style="font-family: var(--yuzi-phone-font-family);">
                <span class="phone-ios-font-preview-title">${escapeHtml(activeFont.name || t("系统默认"))}</span>
                <span class="phone-ios-font-preview-sample">${escapeHtml(activeFont.previewText || t("玉子手机 · 字体预览 Aa 123"))}</span>
            </div>
            ${buildSelectRowHtml({ selectId: 'phone-font-select', label: t`当前字体`, valueText: activeShort })}
            <select id="phone-font-select" class="phone-settings-select" hidden>
                ${buildFontLibraryOptionsHtml(fontLibrary)}
            </select>
            <button type="button" class="phone-ios-row is-action" id="phone-import-font-btn">${t`导入本地字体`}</button>
            <button type="button" class="phone-ios-row is-action is-danger" id="phone-delete-font-btn" aria-haspopup="dialog" ${canDeleteActiveFont ? '' : 'disabled'}>${t`删除当前字体`}</button>
            <input type="file" id="phone-font-file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf,application/x-font-ttf,application/x-font-otf" hidden>
        </section>
        <p class="phone-ios-group-footer">${quotaText}${t("内置字体不可删除。")}</p>
        <section class="phone-ios-group">
            <details class="phone-ios-details">
                <summary class="phone-ios-row is-tappable">
                    <span class="phone-ios-row-label">${t`添加网络字体`}</span>
                    <span class="phone-ios-row-value">${CHEVRON_HTML}</span>
                </summary>
                <label class="phone-ios-row">
                    <span class="phone-ios-row-field-label">${t`显示名称`}</span>
                    <input type="text" id="phone-font-url-name" class="phone-ios-inline-input" placeholder="${t`例如：寒蝉全圆体`}">
                </label>
                <label class="phone-ios-row">
                    <span class="phone-ios-row-field-label">${t`字体 CSS URL`}</span>
                    <input type="url" id="phone-font-css-url" class="phone-ios-inline-input" placeholder="https://fontsapi.zeoseven.com/3/main/result.css" inputmode="url" spellcheck="false" autocapitalize="off" autocomplete="off">
                </label>
                <label class="phone-ios-row">
                    <span class="phone-ios-row-field-label">${t`字体族名`}</span>
                    <input type="text" id="phone-font-url-family" class="phone-ios-inline-input" placeholder="${t`例如：寒蝉全圆体`}">
                </label>
                <button type="button" class="phone-ios-row is-action" id="phone-import-font-url-btn">${t`保存网络字体`}</button>
            </details>
        </section>
        <p class="phone-ios-group-footer">${t`仅支持 HTTPS 字体 CSS 地址，需联网加载。`}</p>
    `;
}

function buildTextScaleSectionHtml(readableTextScalePercent) {
    const value = Math.max(80, Math.min(160, Math.round(Number(readableTextScalePercent) || 100)));
    return `
        <h2 class="phone-ios-group-header">${t("主要内容字体大小")}</h2>
        <section class="phone-ios-group">
            <div class="phone-ios-row">
                <div class="phone-ios-slider-row">
                    <span class="phone-ios-slider-glyph" aria-hidden="true">A</span>
                    <input type="range" min="80" max="160" step="1" id="phone-readable-text-scale-range" value="${escapeHtmlAttr(value)}" aria-label="${t`主要内容字体大小`}">
                    <span class="phone-ios-slider-glyph is-large" aria-hidden="true">A</span>
                    <span class="phone-ios-stepper-value" id="phone-readable-text-scale-value">${escapeHtml(String(value))}%</span>
                </div>
            </div>
        </section>
        <p class="phone-ios-group-footer">${t("调整首页名称与通用表格文字，不影响按钮和标题栏。")}</p>
    `;
}

function buildLayoutSectionHtml(layoutValues) {
    return `
        <h2 class="phone-ios-group-header">${t("图标布局")}</h2>
        <section class="phone-ios-group">
            ${buildStepperRowHtml({ inputId: 'phone-app-grid-columns', label: t`每行图标`, value: layoutValues.appGridColumns, min: 3, max: 6, unit: '' })}
            ${buildStepperRowHtml({ inputId: 'phone-app-icon-size', label: t`图标大小`, value: layoutValues.appIconSize, min: 40, max: 88, step: 2 })}
            ${buildStepperRowHtml({ inputId: 'phone-app-icon-radius', label: t`圆角`, value: layoutValues.appIconRadius, min: 6, max: 26 })}
            ${buildStepperRowHtml({ inputId: 'phone-app-grid-gap', label: t`图标间距`, value: layoutValues.appGridGap, min: 8, max: 24, inputStep: '0.001' })}
            ${buildStepperRowHtml({ inputId: 'phone-dock-icon-size', label: t`Dock 图标大小`, value: layoutValues.dockIconSize, min: 32, max: 72, step: 2 })}
        </section>
    `;
}

function buildDisplaySectionHtml(hideTableCountBadge) {
    return `
        <h2 class="phone-ios-group-header">${t("显示控制")}</h2>
        <section class="phone-ios-group">
            <label class="phone-ios-row" for="phone-hide-table-count-badge">
                <span class="phone-ios-row-label">${t`隐藏数量徽标`}</span>
                <span class="phone-ios-switch">
                    <input type="checkbox" id="phone-hide-table-count-badge" role="switch" ${hideTableCountBadge ? 'checked' : ''}>
                    <span class="phone-ios-switch-track" aria-hidden="true"></span>
                </span>
            </label>
        </section>
        <h2 class="phone-ios-group-header">${t("在首页显示的表格 App")}</h2>
        <section class="phone-ios-group" id="phone-hidden-table-apps"></section>
        <p class="phone-ios-group-footer">${t("关闭后该 App 不在首页显示，数据不受影响。")}</p>
        <h2 class="phone-ios-group-header">${t("自定义图标")}</h2>
        <div id="phone-icon-upload-list" class="phone-icon-upload-list"></div>
    `;
}

export function buildAppearancePageHtml({
    layoutValues,
    hideTableCountBadge,
    homeAppLabelColorMode = 'white',
    phoneThemeMode = 'light',
    fontLibrary = {},
    readableTextScalePercent = 100,
}) {
    const bodyHtml = `
        ${buildThemeSectionHtml({ phoneThemeMode, homeAppLabelColorMode })}
        ${buildPackSectionHtml()}
        ${buildFontSectionHtml(fontLibrary)}
        ${buildTextScaleSectionHtml(readableTextScalePercent)}
        ${buildLayoutSectionHtml(layoutValues)}
        ${buildDisplaySectionHtml(hideTableCountBadge)}
    `;

    return buildSettingsPageFrame({
        title: t("界面外观"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open phone-ios-grouped-page',
        bodyHtml,
    });
}



function buildToggleCoverPreviewHtml(shape, coverDataUrl, sizePx = 40) {
    const safeShape = String(shape || 'circle') === 'rounded' ? 'rounded' : 'circle';
    const safeCover = String(coverDataUrl || '').trim();
    const safeSize = Number.isFinite(Number(sizePx)) ? Math.max(32, Math.min(72, Math.round(Number(sizePx)))) : 40;
    const coverStyle = safeCover
        ? `background-image:url('${escapeHtmlAttr(safeCover)}');`
        : '';
    const stateClass = safeCover ? 'has-cover' : 'no-cover';
    const shapeClass = safeShape === 'circle' ? 'is-circle' : 'is-rounded';
    const textHtml = safeShape === 'circle' || safeCover
        ? ''
        : `<span class="phone-toggle-preview-text">${t("玉子")}</span>`;

    return `
        <div class="phone-toggle-preview-shell">
            <div class="phone-toggle-preview-button ${shapeClass} ${stateClass}"
                style="${coverStyle}--yuzi-phone-toggle-preview-size:${escapeHtmlAttr(safeSize)}px;"
                role="img"
                aria-label="${safeCover ? t("按钮封面预览") : t("毛玻璃按钮预览")}">
                <span class="phone-toggle-preview-icon">${PHONE_ICONS.phone || ''}</span>
                ${textHtml}
            </div>
        </div>
    `;
}

export function buildButtonStylePageHtml({ currentSize, currentShape, currentCover, floatingToggleEnabled = true }) {
    const previewHtml = buildToggleCoverPreviewHtml(currentShape, currentCover, currentSize);

    const bodyHtml = `
        ${buildSettingsSectionHtml({
            title: t("悬浮入口"),
            actionsHtml: `<div class="phone-settings-action phone-settings-action-wrap"><button type="button" class="phone-settings-btn" id="phone-toggle-position-reset-btn">${t`重置位置`}</button></div>`,
            bodyHtml: `<label class="phone-toggle-shape-item" for="phone-floating-toggle-enabled"><span class="phone-toggle-shape-name">${t`显示悬浮按钮`}</span><input type="checkbox" id="phone-floating-toggle-enabled" ${floatingToggleEnabled ? 'checked' : ''}></label><p class="phone-settings-desc">${t`隐藏按钮不影响已打开的手机。`}</p>`,
        })}

        ${buildSettingsSectionHtml({
            title: t("按钮大小"),
            bodyHtml: `
                <div class="phone-settings-toggle-size-row">
                    <input type="range" min="32" max="72" step="1" id="phone-toggle-style-size-range" value="${escapeHtmlAttr(currentSize)}">
                    <input type="number" min="32" max="72" step="1" id="phone-toggle-style-size-input" class="phone-settings-input" value="${escapeHtmlAttr(currentSize)}">
                </div>
                <p class="phone-settings-desc">${t`32–72 px，默认 40。`}</p>
            `,
        })}

        ${buildSettingsSectionHtml({
            title: t("按钮形状"),
            bodyHtml: `
                <div class="phone-toggle-shape-list" id="phone-toggle-shape-list">
                    <label class="phone-toggle-shape-item">
                        <span class="phone-toggle-shape-name">${t`长方形`}</span>
                        <input type="radio" name="phone-toggle-shape" value="rounded" ${currentShape === 'rounded' ? 'checked' : ''}>
                    </label>
                    <label class="phone-toggle-shape-item">
                        <span class="phone-toggle-shape-name">${t`圆形`}</span>
                        <input type="radio" name="phone-toggle-shape" value="circle" ${currentShape === 'circle' ? 'checked' : ''}>
                    </label>
                </div>
            `,
        })}

        ${buildSettingsSectionHtml({
            title: t("按钮封面"),
            desc: t("按按钮形状裁剪。"),
            actionsHtml: `
                <div class="phone-settings-action">
                    <button type="button" class="phone-settings-btn" id="phone-toggle-cover-upload-btn">
                        ${PHONE_ICONS.upload}
                        <span>${t`上传封面`}</span>
                    </button>
                    <button type="button" class="phone-settings-btn phone-settings-btn-danger" id="phone-toggle-cover-clear-btn" ${currentCover ? '' : 'disabled'}>${t`清除封面`}</button>
                </div>
            `,
            bodyHtml: `<div id="phone-toggle-cover-preview" class="phone-settings-preview">${previewHtml}</div>`,
        })}
    `;

    return buildSettingsPageFrame({
        title: t("控件与按钮"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open',
        bodyHtml,
    });
}
