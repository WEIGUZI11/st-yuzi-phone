import { t } from '../../../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';
import { buildSettingsPageFrame } from '../primitives.js';
import { validateReplacementRules } from '../../../table-content-replacement/rules.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asText(value) {
    return String(value ?? '');
}

function asId(value, fallback = '') {
    const normalized = asText(value).trim();
    return normalized || fallback;
}

function isChecked(value) {
    return value === true ? ' checked' : '';
}

function isDisabled(value) {
    return value ? ' disabled' : '';
}

function getRunnableRules(rules) {
    const safeRules = asArray(rules);
    const invalidIndexes = new Set(validateReplacementRules(safeRules).map(error => Number(error?.index)));
    return safeRules.filter((_, index) => !invalidIndexes.has(index));
}

function formatRunningRuleValue(value) {
    const text = asText(value);
    if (text.length === 0) return t("（空白）");
    return text
        .replace(/\r\n|\r|\n/gu, '↵')
        .replace(/\t/gu, '⇥')
        .replace(/ /gu, '·');
}

function buildRunningRuleGroupHtml({ scope = 'global', mappingId = '', label = '', rules = [] } = {}) {
    const safeRules = asArray(rules);
    const mappingAttr = scope === 'table' ? ` data-mapping-id="${escapeHtmlAttr(mappingId)}"` : '';
    return `
        <div class="phone-ios-row is-block" data-running-rule-scope="${escapeHtmlAttr(scope)}"${mappingAttr}>
            <div class="phone-table-content-replacement-running-group-head">
                <span class="phone-ios-row-label">${escapeHtml(label)}</span>
                <span class="phone-ios-row-sub">${t`${safeRules.length} 条`}</span>
            </div>
            <ol class="phone-table-content-replacement-running-list">
                ${safeRules.map((rule, index) => `
                    <li class="phone-table-content-replacement-running-item">
                        <span class="phone-table-content-replacement-running-index">${index + 1}</span>
                        <code class="phone-table-content-replacement-running-value">${escapeHtml(formatRunningRuleValue(rule?.source))}</code>
                        <span class="phone-table-content-replacement-running-arrow" aria-hidden="true">→</span>
                        <code class="phone-table-content-replacement-running-value">${escapeHtml(formatRunningRuleValue(rule?.target))}</code>
                    </li>
                `).join('')}
            </ol>
        </div>
    `;
}

function buildRunningRulesSummaryHtml({ config = {}, resolvedTableRules = [] } = {}) {
    const safeConfig = config && typeof config === 'object' ? config : {};
    const groups = [];
    const global = safeConfig.global && typeof safeConfig.global === 'object' ? safeConfig.global : {};
    const globalRules = global.enabled === true ? getRunnableRules(global.rules) : [];
    if (globalRules.length > 0) {
        groups.push({ scope: 'global', label: t("全局替换"), rules: globalRules });
    }

    asArray(safeConfig.tableRules).forEach((area) => {
        if (area?.enabled !== true) return;
        const rules = getRunnableRules(area.rules);
        if (rules.length === 0) return;
        const resolved = asArray(resolvedTableRules).find(
            item => asId(item?.mappingId) === asId(area?.mappingId),
        );
        const label = asText(
            resolved?.tableName
            || area.tableNameSnapshot
            || area.sheetKey
            || t("未命名表格"),
        ).trim() || t("未命名表格");
        groups.push({
            scope: 'table',
            mappingId: asId(area.mappingId),
            label,
            rules,
        });
    });

    const totalRuleCount = groups.reduce((total, group) => total + group.rules.length, 0);
    const bodyHtml = groups.length > 0
        ? groups.map(buildRunningRuleGroupHtml).join('')
        : `<div class="phone-ios-row"><span class="phone-ios-row-sub">${t("暂无已生效规则。")}</span></div>`;

    return `
        <h2 class="phone-ios-group-header">${t`已生效规则`}</h2>
        <section class="phone-ios-group">
            <div class="phone-ios-row">
                <span class="phone-ios-row-label">${t`合计`}</span>
                <span class="phone-ios-row-value">${t`${totalRuleCount}条`}</span>
            </div>
            ${bodyHtml}
        </section>
    `;
}

function buildRuleErrorHtml(error, id = '') {
    if (Array.isArray(error)) {
        return error.map(buildRuleErrorHtml).join('');
    }
    const message = asText(error?.message || error?.text).trim();
    return message ? `<div class="phone-table-content-replacement-error"${id ? ` id="${escapeHtmlAttr(id)}"` : ''}>${escapeHtml(message)}</div>` : '';
}

function buildRuleHtml({ rule = {}, index = 0, scope = 'global', mappingId = '', disabled = false, error = null } = {}) {
    const safeScope = scope === 'table' ? 'table' : 'global';
    const ruleId = asId(rule.id, `rule_${index + 1}`);
    const actionScope = safeScope === 'table'
        ? ` data-area-scope="table" data-mapping-id="${escapeHtmlAttr(mappingId)}"`
        : '';
    const moveUpDisabled = disabled || index <= 0;
    const moveDownDisabled = disabled;
    const errorId = `replacement-error-${safeScope}-${mappingId}-${ruleId}`;
    const errorHtml = buildRuleErrorHtml(error, errorId);
    const errorAttrs = errorHtml ? ` aria-invalid="true" aria-describedby="${escapeHtmlAttr(errorId)}"` : '';

    return `
        <article class="phone-ios-row is-block phone-table-content-replacement-rule" data-rule-id="${escapeHtmlAttr(ruleId)}" data-rule-index="${index}" data-rule-scope="${safeScope}">
            <div class="phone-table-content-replacement-rule-head">
                <span class="phone-ios-row-label">${t`规则 ${index + 1}`}</span>
                <div class="phone-ios-row-actions">
                    <button type="button" class="phone-ios-mini-btn" data-action="move-rule-up" data-rule-id="${escapeHtmlAttr(ruleId)}"${actionScope}${isDisabled(moveUpDisabled)} aria-label="${t`上移规则`}">↑</button>
                    <button type="button" class="phone-ios-mini-btn" data-action="move-rule-down" data-rule-id="${escapeHtmlAttr(ruleId)}"${actionScope}${isDisabled(moveDownDisabled)} aria-label="${t`下移规则`}">↓</button>
                    <button type="button" class="phone-ios-mini-btn is-danger" data-action="delete-rule" data-rule-id="${escapeHtmlAttr(ruleId)}"${actionScope}${isDisabled(disabled)}>${t`删除`}</button>
                </div>
            </div>
            <div class="phone-table-content-replacement-rule-fields">
                <label class="phone-table-content-replacement-field">
                    <span class="phone-ios-field-label">${t`原词`}</span>
                    <textarea class="phone-ios-field" rows="1" data-action="update-rule" data-field="source" data-rule-id="${escapeHtmlAttr(ruleId)}"${actionScope}${isDisabled(disabled)}${errorAttrs}>
${escapeHtml(asText(rule.source))}</textarea>
                </label>
                <span class="phone-table-content-replacement-running-arrow" aria-hidden="true">→</span>
                <label class="phone-table-content-replacement-field">
                    <span class="phone-ios-field-label">${t`替换为`}</span>
                    <textarea class="phone-ios-field" rows="1" data-action="update-rule" data-field="target" data-rule-id="${escapeHtmlAttr(ruleId)}"${actionScope}${isDisabled(disabled)}${errorAttrs}>
${escapeHtml(asText(rule.target))}</textarea>
                </label>
            </div>
            ${errorHtml}
        </article>
    `;
}

function buildRulesEditorHtml({ rules = [], scope = 'global', mappingId = '', errors = [], disabled = false } = {}) {
    const safeRules = asArray(rules);
    const safeErrors = asArray(errors);
    const errorByIndex = new Map(safeErrors.map((error) => [Number(error?.index), error]));
    const rulesHtml = safeRules.length > 0
        ? safeRules.map((rule, index) => buildRuleHtml({
            rule,
            index,
            scope,
            mappingId,
            disabled,
            error: errorByIndex.get(index),
        })).join('')
        : `<div class="phone-ios-row"><span class="phone-ios-row-sub">${t("暂无规则。")}</span></div>`;
    const addAction = scope === 'table' ? 'add-table-rule' : 'add-global-rule';
    const scopeAttr = scope === 'table'
        ? ` data-area-scope="table" data-mapping-id="${escapeHtmlAttr(mappingId)}"`
        : '';

    return `
        ${rulesHtml}
        <button type="button" class="phone-ios-row is-action" data-action="${addAction}"${scopeAttr}${isDisabled(disabled)}>${t`添加规则`}</button>
    `;
}

function buildAreaSwitchHtml({ id, enabled, scope, mappingId = '', disabled = false, sub = '' } = {}) {
    const safeScope = scope === 'table' ? 'table' : 'global';
    const action = safeScope === 'table' ? 'toggle-table' : 'toggle-global';
    const label = safeScope === 'table' ? t("启用此表替换") : t("启用全局替换");
    const scopeAttr = safeScope === 'table'
        ? ` data-area-scope="table" data-mapping-id="${escapeHtmlAttr(mappingId)}"`
        : '';
    return `
        <label class="phone-ios-row"${id ? ` for="${escapeHtmlAttr(id)}"` : ''}>
            <span class="phone-ios-row-label">${escapeHtml(label)}${sub ? `<span class="phone-ios-row-sub">${escapeHtml(sub)}</span>` : ''}</span>
            <span class="phone-ios-switch">
                <input type="checkbox" role="switch" id="${escapeHtmlAttr(id || `${safeScope}-enabled`)}" class="${safeScope === 'table' ? 'phone-table-content-replacement-mapping-enabled' : 'phone-table-content-replacement-global-enabled'}" data-action="${action}"${scopeAttr}${isChecked(enabled)}${isDisabled(disabled)}>
                <span class="phone-ios-switch-track" aria-hidden="true"></span>
            </span>
        </label>
    `;
}

function buildTableOptionsHtml(tables, selectedSheetKey = '') {
    const safeSelected = asId(selectedSheetKey);
    return asArray(tables)
        .filter(table => asId(table?.sheetKey))
        .map((table) => {
            const sheetKey = asId(table.sheetKey);
            const tableName = asText(table.tableName || table.name || sheetKey).trim() || sheetKey;
            const status = asId(table.status, 'available');
            const available = status === 'available';
            return `<option value="${escapeHtmlAttr(sheetKey)}"${sheetKey === safeSelected ? ' selected' : ''}${available ? '' : ' disabled'}>${escapeHtml(tableName)}${available ? '' : t("（当前不可用）")}</option>`;
        })
        .join('');
}

function buildTableAreaHtml({ area = {}, table = null, errors = {}, busy = false } = {}) {
    const mappingId = asId(area.mappingId, 'mapping_1');
    const tableNameSnapshot = asText(area.tableNameSnapshot || area.tableName).trim();
    const tableName = asText(table?.tableName || table?.name || tableNameSnapshot || area.sheetKey || t("未命名表格")).trim();
    const status = asId(table?.status, table ? 'available' : 'missing');
    const unavailable = status !== 'available';
    const title = asText(table?.tableName).trim() || tableNameSnapshot || tableName || t("未命名表格");
    const errorList = asArray(errors?.rules);
    return `
        <h2 class="phone-ios-group-header">${escapeHtml(title)}${unavailable ? `<span class="phone-ios-badge is-danger">${t("当前不可用")}</span>` : ''}</h2>
        <section class="phone-ios-group" data-mapping-id="${escapeHtmlAttr(mappingId)}">
            ${buildAreaSwitchHtml({
                id: `phone-table-content-replacement-mapping-enabled-${mappingId}`,
                enabled: area.enabled === true,
                scope: 'table',
                mappingId,
                disabled: busy,
            })}
            ${buildRulesEditorHtml({ rules: area.rules, scope: 'table', mappingId, errors: errorList, disabled: busy })}
            <button type="button" class="phone-ios-row is-action" data-action="save-table" data-mapping-id="${escapeHtmlAttr(mappingId)}"${isDisabled(busy)}>${t`保存并应用`}</button>
            <button type="button" class="phone-ios-row is-action is-danger" data-action="delete-table" data-mapping-id="${escapeHtmlAttr(mappingId)}"${isDisabled(busy)}>${t`移除配置`}</button>
        </section>
        ${unavailable ? `<p class="phone-ios-group-footer">${t("表格暂不可用，规则保留，恢复后继续生效。")}</p>` : ''}
    `;
}

export function buildTableContentReplacementPageHtml(viewModel = {}) {
    const config = viewModel?.config && typeof viewModel.config === 'object' ? viewModel.config : {};
    const activeConfig = viewModel?.activeConfig && typeof viewModel.activeConfig === 'object'
        ? viewModel.activeConfig
        : config;
    const global = config.global && typeof config.global === 'object' ? config.global : {};
    const tables = asArray(viewModel.tables);
    const configuredTableRules = asArray(config.tableRules);
    const resolvedTableRules = asArray(viewModel.tableRules);
    const tableRules = configuredTableRules.map((area) => {
        const resolved = resolvedTableRules.find(item => asId(item?.mappingId) === asId(area?.mappingId));
        return resolved
            ? {
                ...area,
                tableName: resolved.tableName,
                status: resolved.status,
                headers: resolved.headers,
                rowCount: resolved.rowCount,
            }
            : area;
    });
    const errors = viewModel?.errors && typeof viewModel.errors === 'object' ? viewModel.errors : {};
    const busy = viewModel.busy === true;
    const status = asId(viewModel.status, 'ready');
    const mappedSheetKeys = new Set(tableRules.map(area => asId(area?.sheetKey)).filter(Boolean));
    const availableTables = tables.filter(table => !mappedSheetKeys.has(asId(table?.sheetKey)));
    const tableAreasHtml = tableRules.length > 0
        ? tableRules.map((area) => buildTableAreaHtml({
            area,
            table: tables.find(table => asId(table?.sheetKey) === asId(area?.sheetKey)) || null,
            errors: errors.mappings?.[area.mappingId] || {},
            busy,
        })).join('')
        : `<section class="phone-ios-group"><div class="phone-ios-row"><span class="phone-ios-row-sub">${t("暂无单表配置。")}</span></div></section>`;
    const statusHtml = status === 'loading'
        ? `<p class="phone-ios-group-footer" role="status">${t("正在读取表格目录…")}</p>`
        : status === 'error'
            ? `<p class="phone-ios-group-footer phone-table-content-replacement-error" role="alert">${t("当前无法读取表格目录；已保存的规则仍会保留。")}</p>`
            : '';
    const selectDisabled = availableTables.length === 0;
    const globalErrors = Array.isArray(errors.global) ? errors.global : [];
    const globalErrorHtml = buildRuleErrorHtml(
        globalErrors.filter(error => !Number.isInteger(Number(error?.index))),
    );
    const globalBodyHtml = `
        <h2 class="phone-ios-group-header">${t("全局替换")}</h2>
        <section class="phone-ios-group" id="phone-table-content-replacement-global-section">
            ${buildAreaSwitchHtml({
                id: 'phone-table-content-replacement-global-enabled',
                enabled: global.enabled === true,
                scope: 'global',
                disabled: busy,
                sub: t("适用于当前及后续可用的普通数据表，先于单表规则执行。"),
            })}
            ${globalErrorHtml}
            ${buildRulesEditorHtml({ rules: global.rules, scope: 'global', errors: globalErrors, disabled: busy })}
            <button type="button" class="phone-ios-row is-action" data-action="save-global"${isDisabled(busy)}>${t`保存并应用`}</button>
        </section>
        <p class="phone-ios-group-footer">${t`按普通文字匹配；修改后需点击「保存并应用」。`}</p>
    `;
    const addTableHtml = `
        <h2 class="phone-ios-group-header">${t("单表替换")}</h2>
        <section class="phone-ios-group" id="phone-table-content-replacement-table-section">
            <button type="button" class="phone-ios-row is-tappable" data-settings-select="phone-table-content-replacement-table-select" aria-haspopup="dialog"${isDisabled(selectDisabled || busy)}>
                <span class="phone-ios-row-label">${t`选择表格`}</span>
                <span class="phone-ios-row-value"><span class="phone-ios-row-value-text">${selectDisabled ? t("没有可添加的表格") : t("请选择一张表")}</span><span class="phone-ios-row-chevron" aria-hidden="true">›</span></span>
            </button>
            <button type="button" class="phone-ios-row is-action" data-action="add-table" disabled>${t`添加表格`}</button>
            <select id="phone-table-content-replacement-table-select" class="phone-settings-select"${isDisabled(selectDisabled || busy)} hidden>
                <option value="">${selectDisabled ? t("没有可添加的表格") : t("请选择一张表")}</option>
                ${buildTableOptionsHtml(availableTables)}
            </select>
        </section>
        <p class="phone-ios-group-footer">${t("仅作用于指定表格。")}</p>
    `;
    const runningRulesSummaryHtml = buildRunningRulesSummaryHtml({
        config: activeConfig,
        resolvedTableRules,
    });
    const bodyHtml = `${statusHtml}
        ${runningRulesSummaryHtml}
        ${globalBodyHtml}
        ${addTableHtml}
        ${tableAreasHtml}`;

    return buildSettingsPageFrame({
        title: t("表格内容词汇替换"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open phone-ios-grouped-page phone-table-content-replacement-page',
        bodyHtml,
    });
}
