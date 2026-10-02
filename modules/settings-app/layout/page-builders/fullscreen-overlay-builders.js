import { t } from '../../../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';
import { buildSettingsPageFrame } from '../primitives.js';
import {
    MAX_FULLSCREEN_OVERLAY_PALETTE_SIZE,
    buildFullscreenOverlayColorRowsHtml,
    buildFullscreenOverlaySingleColorHtml,
} from '../../ui/color-control.js';
import {
    SCROLLING_BARRAGE_MODEL_ID,
    TABLE_POPUP_MODEL_ID,
    INLINE_TABLE_POPUP_MODEL_ID,
} from '../../../fullscreen-overlay/settings.js';

const MODEL_LABELS = Object.freeze({
    [SCROLLING_BARRAGE_MODEL_ID]: '横向滚动弹幕',
    [TABLE_POPUP_MODEL_ID]: '普通表格浮窗',
    [INLINE_TABLE_POPUP_MODEL_ID]: '插入正文',
});

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function checked(value) {
    return value === true ? ' checked' : '';
}

function selected(value) {
    return value ? ' selected' : '';
}

function disabled(value) {
    return value ? ' disabled' : '';
}

function valueAttr(value) {
    return escapeHtmlAttr(String(value ?? ''));
}

function modelLabel(modelId, labels = {}) {
    return labels?.[modelId] || t(MODEL_LABELS[modelId]) || modelId || t("未知模型");
}

function modelOptionsHtml(modelIds, selectedModelId, labels = {}) {
    return asArray(modelIds).map(optionModelId => `
        <option value="${escapeHtmlAttr(optionModelId)}"${selected(selectedModelId === optionModelId)}>
            ${escapeHtml(modelLabel(optionModelId, labels))}
        </option>
    `).join('');
}

function buildSourceRowHtml(table, index, tableCount) {
    const isAvailable = table?.availability === 'available';
    const sheetKey = String(table?.sheetKey || '').trim();
    const tableName = String(table?.tableName || sheetKey || t("未命名表格"));
    const statusLabel = String(table?.statusLabel || (
        table?.availability === 'format_mismatch' ? t("格式不匹配") : t("暂未适配")
    ));
    const modelIds = asArray(table?.modelIds);
    const selectedModelId = String(table?.modelId || modelIds[0] || '');
    const modelControl = isAvailable && modelIds.length > 0
        ? `
            <button type="button"
                class="phone-fullscreen-overlay-source-model"
                data-settings-select="phone-fullscreen-overlay-source-model-${escapeHtmlAttr(sheetKey)}"
                data-sheet-title="${escapeHtmlAttr(t`播放模型`)}"
                data-sheet-subtitle="${escapeHtmlAttr(tableName)}"
                aria-haspopup="dialog"${disabled(modelIds.length <= 1)}>
                <span class="phone-ios-row-value-text phone-fullscreen-overlay-source-model-label">${escapeHtml(modelLabel(selectedModelId, table?.modelLabels))}</span>
                ${modelIds.length > 1 ? '<span aria-hidden="true">›</span>' : ''}
            </button>
            <select id="phone-fullscreen-overlay-source-model-${escapeHtmlAttr(sheetKey)}"
                class="phone-settings-select phone-fullscreen-overlay-source-model-select"
                data-fullscreen-overlay-source-model="${escapeHtmlAttr(sheetKey)}"
                aria-label="${t`${escapeHtmlAttr(tableName)}播放模型`}"${disabled(modelIds.length <= 1)} hidden>
                ${modelOptionsHtml(modelIds, selectedModelId, table?.modelLabels)}
            </select>
        `
        : `
            <span class="phone-fullscreen-overlay-source-status is-${escapeHtmlAttr(table?.availability || 'unsupported')}">
                ${escapeHtml(statusLabel)}
            </span>
        `;
    return `
        <article class="phone-ios-row phone-fullscreen-overlay-source-row${isAvailable ? ' is-available' : ' is-disabled'}"
            data-fullscreen-overlay-source-row="${escapeHtmlAttr(sheetKey)}">
            <div class="phone-fullscreen-overlay-source-toggle">
                <label class="phone-ios-switch">
                    <input type="checkbox"
                        class="phone-settings-switch"
                        data-fullscreen-overlay-source="${escapeHtmlAttr(sheetKey)}"${disabled(!isAvailable)}${checked(table?.enabled)}>
                    <span class="phone-ios-switch-track" aria-hidden="true"></span>
                </label>
                <span class="phone-fullscreen-overlay-source-copy">
                    <span class="phone-fullscreen-overlay-source-name">${escapeHtml(tableName)}</span>
                    <span class="phone-fullscreen-overlay-source-meta">${modelControl}</span>
                </span>
            </div>
            <div class="phone-fullscreen-overlay-source-side">
                <span class="phone-fullscreen-overlay-order-actions">
                    <button type="button"
                        class="phone-ios-mini-btn phone-fullscreen-overlay-icon-btn"
                        data-fullscreen-overlay-move="up"
                        data-sheet-key="${escapeHtmlAttr(sheetKey)}"
                        aria-label="${t`上移 ${escapeHtmlAttr(tableName)}`}"${disabled(index <= 0)}>↑</button>
                    <button type="button"
                        class="phone-ios-mini-btn phone-fullscreen-overlay-icon-btn"
                        data-fullscreen-overlay-move="down"
                        data-sheet-key="${escapeHtmlAttr(sheetKey)}"
                        aria-label="${t`下移 ${escapeHtmlAttr(tableName)}`}"${disabled(index >= tableCount - 1)}>↓</button>
                </span>
            </div>
        </article>
    `;
}

function buildParameterField({
    id,
    label,
    value,
    min,
    max,
    step,
    suffix,
    description,
    isDisabled = false,
}) {
    const precision = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    const displayValue = Number.isFinite(Number(value)) ? Number(value).toFixed(precision) : value;
    return `
        <div class="phone-ios-row phone-fullscreen-overlay-parameter-row"
            title="${escapeHtmlAttr(description)}">
            <span class="phone-fullscreen-overlay-parameter-label">${escapeHtml(label)}</span>
            <span class="phone-fullscreen-overlay-parameter-control">
                <span class="phone-ios-stepper"
                    data-settings-stepper="${escapeHtmlAttr(id)}"
                    data-step="${valueAttr(step)}"
                    data-unit="">
                    <button type="button" class="phone-ios-stepper-btn" data-direction="-1"
                        aria-label="${escapeHtmlAttr(t`减少${label}`)}"${disabled(isDisabled)}>−</button>
                    <button type="button" class="phone-ios-stepper-value is-editable"
                        data-fullscreen-overlay-precise="${escapeHtmlAttr(id)}"
                        aria-label="${escapeHtmlAttr(t`${label}，点按输入精确值`)}"
                        aria-haspopup="dialog"${disabled(isDisabled)}>${escapeHtml(String(displayValue))}</button>
                    <button type="button" class="phone-ios-stepper-btn" data-direction="1"
                        aria-label="${escapeHtmlAttr(t`增加${label}`)}"${disabled(isDisabled)}>+</button>
                </span>
                ${suffix ? `<span class="phone-fullscreen-overlay-parameter-unit">${escapeHtml(suffix)}</span>` : ''}
            </span>
            <input type="number"
                    id="${escapeHtmlAttr(id)}"
                    class="phone-fullscreen-overlay-parameter-input"
                    value="${valueAttr(value)}"
                    min="${valueAttr(min)}"
                    max="${valueAttr(max)}"
                    step="${valueAttr(step)}"${disabled(isDisabled)}>
        </div>
    `;
}

function buildSelectParameterField({ id, label, value, options, description }) {
    return `
        <div class="phone-ios-row phone-fullscreen-overlay-inline-segment-row"
            title="${escapeHtml(description)}">
            <span class="phone-ios-row-label">${escapeHtml(label)}</span>
            <div class="phone-ios-seg" data-settings-seg="${escapeHtmlAttr(id)}" role="group" aria-label="${escapeHtmlAttr(label)}">
                ${options.map(option => `
                    <button type="button" class="phone-ios-seg-item"
                        data-value="${escapeHtmlAttr(option.value)}"
                        aria-pressed="${value === option.value ? 'true' : 'false'}">
                        ${escapeHtml(option.label)}
                    </button>
                `).join('')}
            </div>
            <select id="${escapeHtmlAttr(id)}" class="phone-settings-select" hidden>
                ${options.map(option => `
                    <option value="${escapeHtmlAttr(option.value)}"${selected(value === option.value)}>
                        ${escapeHtml(option.label)}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

function buildVerticalSegmentField({ id, label, value, options, description = '' }) {
    return `
        <div class="phone-ios-row is-block phone-fullscreen-overlay-segment-row"
            title="${escapeHtml(description)}">
            <span class="phone-ios-field-label">${escapeHtml(label)}</span>
            <div class="phone-ios-seg" data-settings-seg="${escapeHtmlAttr(id)}" role="group" aria-label="${escapeHtmlAttr(label)}">
                ${options.map(option => `
                    <button type="button" class="phone-ios-seg-item"
                        data-value="${escapeHtmlAttr(option.value)}"
                        aria-pressed="${String(value) === String(option.value) ? 'true' : 'false'}">
                        ${escapeHtml(option.label)}
                    </button>
                `).join('')}
            </div>
            <select id="${escapeHtmlAttr(id)}" class="phone-settings-select" hidden>
                ${options.map(option => `
                    <option value="${escapeHtmlAttr(option.value)}"${selected(String(value) === String(option.value))}>
                        ${escapeHtml(option.label)}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

function buildBarrageModelHtml(barrage) {
    const areaPercent = [25, 50, 75, 100].includes(Number(barrage.areaPercent))
        ? Number(barrage.areaPercent)
        : 75;
    return `
        ${buildVerticalSegmentField({
            id: 'phone-fullscreen-overlay-area',
            label: t("弹幕区域"),
            value: areaPercent,
            options: [
                { value: '25', label: t("上方 25%") },
                { value: '50', label: t("上方 50%") },
                { value: '75', label: t("上方 75%") },
                { value: '100', label: t("全屏") },
            ],
        })}
        <label class="phone-ios-row phone-fullscreen-overlay-master-switch" for="phone-fullscreen-overlay-eternal">
            <span>
                <strong>${t`永恒弹幕`}</strong>
                <small>${t`循环播放，新内容到达后替换。`}</small>
            </span>
            <span class="phone-ios-switch">
                <input type="checkbox"
                    id="phone-fullscreen-overlay-eternal"
                    class="phone-settings-switch"${checked(barrage.eternalEnabled)}>
                <span class="phone-ios-switch-track" aria-hidden="true"></span>
            </span>
        </label>
        <div class="phone-fullscreen-overlay-parameter-list">
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-density',
                label: t("密度"),
                value: barrage.maxConcurrent,
                min: 1,
                max: 6,
                step: 1,
                suffix: t("条"),
                description: t("控制垂直轨道数量与视觉密度（1–6）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-interval',
                label: t("间隔"),
                value: Number(barrage.intervalMs) / 1000,
                min: 0.5,
                max: 10,
                step: 0.1,
                suffix: t("秒"),
                description: t("相邻两条弹幕发射的最短时间（0.5–10 秒）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-duration',
                label: t("速度"),
                value: Number(barrage.durationMs) / 1000,
                min: 4,
                max: 20,
                step: 0.5,
                suffix: t("秒"),
                description: t("数字越小移动越快（4–20 秒穿屏）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-font-size',
                label: t("字号"),
                value: barrage.fontSizePx,
                min: 12,
                max: 28,
                step: 1,
                suffix: 'px',
                description: t("弹幕文字大小（12–28px）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-opacity',
                label: t("透明度"),
                value: barrage.opacity,
                min: 0.3,
                max: 1,
                step: 0.01,
                suffix: '',
                description: t("只改变弹幕文字透明度，不增加全屏滤镜。"),
            })}
        </div>
    `;
}

function buildPopupModelHtml(popup, inline = false) {
    const areaPercent = [25, 50, 75, 100].includes(Number(popup.areaPercent))
        ? Number(popup.areaPercent)
        : 75;
    const placementMode = popup.placementMode === 'center' ? 'center' : 'random';
    const centered = placementMode === 'center';
    return `
        ${inline ? '' : `
        ${buildSelectParameterField({
            id: 'phone-fullscreen-overlay-popup-placement',
            label: t("弹窗位置"),
            value: placementMode,
            options: [
                { value: 'random', label: t("随机") },
                { value: 'center', label: t("居中") },
            ],
        })}
        ${buildVerticalSegmentField({
            id: 'phone-fullscreen-overlay-popup-area',
            label: t("弹窗区域"),
            value: areaPercent,
            options: [
                { value: '25', label: t("上方 25%") },
                { value: '50', label: t("上方 50%") },
                { value: '75', label: t("上方 75%") },
                { value: '100', label: t("全屏") },
            ],
        })}
        `}
        <div class="phone-fullscreen-overlay-parameter-list">
            ${inline ? '' : `
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-popup-max-concurrent',
                label: t("同时显示"),
                value: centered ? 1 : popup.maxConcurrent,
                min: 1,
                max: 6,
                step: 1,
                suffix: t("张"),
                description: centered
                    ? t("居中模式固定一次显示 1 张，后续弹窗仍会依次出现。")
                    : t("最多同时显示的普通表格弹窗数量（1–6）。"),
                isDisabled: centered,
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-popup-interval',
                label: t("交接间隔"),
                value: Number(popup.intervalMs) / 1000,
                min: 0,
                max: 2,
                step: 0.1,
                suffix: t("秒"),
                description: t("同一来源相邻弹窗的发射间隔（0–2 秒）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-popup-duration',
                label: t("停留时长"),
                value: Number(popup.durationMs) / 1000,
                min: 1,
                max: 15,
                step: 0.5,
                suffix: t("秒"),
                description: t("每张弹窗从淡入到淡出的显示时长（1–15 秒）。"),
            })}
            `}
            ${buildSelectParameterField({
                id: 'phone-fullscreen-overlay-popup-column-count',
                label: t("网格列数"),
                value: String(popup.columnCount),
                options: [
                    { value: '1', label: t("1 列") },
                    { value: '2', label: t("2 列") },
                    { value: '3', label: t("3 列") },
                ],
                description: t("固定使用用户选择的 1、2 或 3 列，不自动降列。"),
            })}
            ${buildSelectParameterField({
                id: 'phone-fullscreen-overlay-popup-size',
                label: t("弹窗大小"),
                value: String(popup.sizePreset),
                options: [
                    { value: 'compact', label: t("紧凑") },
                    { value: 'normal', label: t("正常") },
                    { value: 'large', label: t("放大") },
                ],
                description: t("同步调整卡片、字号、间距和圆角。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-popup-radius',
                label: t("圆角"),
                value: popup.borderRadiusPx,
                min: 8,
                max: 32,
                step: 1,
                suffix: 'px',
                description: t("普通表格弹窗圆角（8–32px）。"),
            })}
            ${buildParameterField({
                id: 'phone-fullscreen-overlay-popup-opacity',
                label: t("背景透明度"),
                value: popup.opacity,
                min: 0.72,
                max: 1,
                step: 0.01,
                suffix: '',
                description: t("只调整弹窗背景透明度，文字保持清晰。"),
            })}
        </div>
    `;
}

function buildLoadingBody() {
    return `
        <h2 class="phone-ios-group-header">${t("正在读取表格")}</h2>
        <section class="phone-ios-group">
            <div class="phone-ios-row phone-ios-row-empty">${t("请稍候……")}</div>
        </section>
        <p class="phone-ios-group-footer">${t("正在通过共享表格目录识别可用内容源。")}</p>
    `;
}

function buildErrorBody(viewModel) {
    return `
        <h2 class="phone-ios-group-header">${t("暂时无法读取表格")}</h2>
        <section class="phone-ios-group">
            <div class="phone-ios-row phone-ios-row-empty is-danger">${t("弹幕设置没有修改任何现有配置。")}</div>
        </section>
        <p class="phone-ios-group-footer">${escapeHtml(String(viewModel?.error?.message || t("当前表格目录不可用，请稍后重试。")))}</p>
    `;
}

export function buildFullscreenOverlayPageHtml(viewModel = {}) {
    const config = viewModel?.config && typeof viewModel.config === 'object' ? viewModel.config : {};
    const barrage = config?.models?.[SCROLLING_BARRAGE_MODEL_ID]
        && typeof config.models[SCROLLING_BARRAGE_MODEL_ID] === 'object'
        ? config.models[SCROLLING_BARRAGE_MODEL_ID]
        : {};
    const tables = asArray(viewModel.tables);
    const eyeDropperSupported = viewModel.eyeDropperSupported === true;
    const palette = asArray(barrage.palette);
    const selectedModelId = [TABLE_POPUP_MODEL_ID, INLINE_TABLE_POPUP_MODEL_ID].includes(viewModel.selectedModelId)
        ? viewModel.selectedModelId : SCROLLING_BARRAGE_MODEL_ID;
    const editingPopup = selectedModelId !== SCROLLING_BARRAGE_MODEL_ID;
    const popup = config.models?.[selectedModelId] || {};

    const group = (title, body, desc = '') => `
        <h2 class="phone-ios-group-header">${escapeHtml(title)}</h2>
        <section class="phone-ios-group">${body}</section>
        ${desc ? `<p class="phone-ios-group-footer">${escapeHtml(desc)}</p>` : ''}
    `;
    let bodyHtml = '';
    if (viewModel.status === 'loading') {
        bodyHtml = buildLoadingBody();
    } else if (viewModel.status === 'error') {
        bodyHtml = buildErrorBody(viewModel);
    } else {
        const sourceRows = tables.length > 0
            ? tables.map((table, index) => buildSourceRowHtml(table, index, tables.length)).join('')
            : `<div class="phone-ios-row phone-ios-row-empty">${t("当前数据库没有可显示的物理表格。")}</div>`;
        bodyHtml = `
            ${group(t("播放开关"), `
                <label class="phone-ios-row phone-fullscreen-overlay-master-switch" for="phone-fullscreen-overlay-enabled">
                    <span>
                        <strong>${t`启用弹幕与卡片`}</strong>
                        <small>${t`自动播放已勾选来源的更新内容。`}</small>
                    </span>
                    <span class="phone-ios-switch">
                        <input type="checkbox" id="phone-fullscreen-overlay-enabled"
                            class="phone-settings-switch"${checked(config.enabled)}>
                        <span class="phone-ios-switch-track" aria-hidden="true"></span>
                    </span>
                </label>
            `, t("关闭后停止播放与测试；关闭手机不会停止播放。"))}

            ${group(t("播放来源"), sourceRows, t("选择播放方式，按列表顺序播放。"))}

            ${group(t("播放参数"), `
                ${buildSelectParameterField({
                    id: 'phone-fullscreen-overlay-playback-model',
                    label: t("编辑类型"),
                    value: selectedModelId,
                    options: [
                        { value: SCROLLING_BARRAGE_MODEL_ID, label: t("弹幕") },
                        { value: TABLE_POPUP_MODEL_ID, label: t("浮窗") },
                        { value: INLINE_TABLE_POPUP_MODEL_ID, label: t("正文") },
                    ],
                    description: t("仅切换参数编辑，来源的播放方式在上方选择。"),
                })}
                ${editingPopup
                    ? buildPopupModelHtml(popup, selectedModelId === INLINE_TABLE_POPUP_MODEL_ID)
                    : buildBarrageModelHtml(barrage)}
            `, t("仅切换参数编辑，来源的播放方式在上方选择。"))}

            ${editingPopup
                ? group(t("弹窗背景色"), `
                    <div class="phone-fullscreen-overlay-color-list">
                        ${buildFullscreenOverlaySingleColorHtml(popup.backgroundColor, { eyeDropperSupported })}
                    </div>
                `, `${t("文字颜色自动适配。")}${eyeDropperSupported ? '' : ` ${t("不支持吸管，可用选色器或 HEX。")}`}`)
                : group(t("弹幕调色板"), `
                    <div class="phone-fullscreen-overlay-color-list">
                        ${buildFullscreenOverlayColorRowsHtml(palette, { eyeDropperSupported })}
                    </div>
                    <div class="phone-fullscreen-overlay-palette-actions">
                        <button type="button" class="phone-ios-row is-action" id="phone-fullscreen-overlay-add-color"
                            ${disabled(palette.length >= MAX_FULLSCREEN_OVERLAY_PALETTE_SIZE)}>${t`添加颜色`}</button>
                        <button type="button" class="phone-ios-row is-action" id="phone-fullscreen-overlay-reset-palette">${t`恢复默认`}</button>
                    </div>
                `, `${t`随机取色，最多 ${MAX_FULLSCREEN_OVERLAY_PALETTE_SIZE} 种。`}${eyeDropperSupported ? '' : ` ${t("不支持吸管，可用选色器或 HEX。")}`}`)}

            ${group(t("测试与清空"), `
                <button type="button" class="phone-ios-row is-action" id="phone-fullscreen-overlay-test"
                    ${disabled(config.enabled !== true)}>${t`测试已勾选来源`}</button>
                <button type="button" class="phone-ios-row is-action is-danger"
                    id="phone-fullscreen-overlay-clear">${t`清空当前内容`}</button>
            `, t("测试已勾选来源：弹幕播放完整内容，弹窗每表取首条。需先开启播放。"))}
        `;
    }

    return buildSettingsPageFrame({
        title: t("弹幕设置"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open phone-ios-grouped-page phone-fullscreen-overlay-settings-page',
        bodyHtml,
    });
}
