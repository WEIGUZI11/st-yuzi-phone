import { t } from '../../../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../../../utils/dom-escape.js';
import { buildSettingsPageFrame } from '../primitives.js';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function selected(active, candidate, application) {
    return application === 'popup'
        ? active?.presetId === candidate?.presetId
        : active?.presetId === candidate?.presetId && active?.itemId === candidate?.itemId;
}

function buildSelectRow(selectId, label, value, title = label) {
    return `<button type="button" class="phone-ios-row is-tappable"
        data-settings-select="${escapeHtmlAttr(selectId)}" data-settings-defer-sync
        data-sheet-title="${escapeHtmlAttr(title)}" aria-haspopup="dialog" aria-label="${escapeHtmlAttr(title)}">
        <span class="phone-ios-row-label">${escapeHtml(label)}</span>
        <span class="phone-ios-row-value"><span class="phone-ios-row-value-text">${escapeHtml(value)}</span><span class="phone-ios-row-chevron" aria-hidden="true">›</span></span>
    </button>`;
}

function buildApplicationSelect({
    application,
    label,
    emptyLabel,
    sheetKey,
    candidates,
    active,
    builtinSceneId = '',
    tableName = sheetKey,
}) {
    const isPopup = application === 'popup';
    const availableCandidates = asArray(candidates);
    const activeCandidate = availableCandidates.find(candidate => selected(active, candidate, application));
    const builtinSelected = builtinSceneId && active?.kind === 'builtin' && active.sceneId === builtinSceneId;
    const currentValue = builtinSelected ? `builtin:${builtinSceneId}` : activeCandidate
        ? (isPopup ? activeCandidate.presetId : `${activeCandidate.presetId}:${activeCandidate.itemId}`)
        : '';
    const candidateLabel = (candidate) => {
        const itemId = isPopup ? '' : candidate.itemId;
        const displayCount = isPopup ? asArray(candidate.displays).length : 0;
        const itemName = isPopup
            ? (displayCount > 1 ? t`${displayCount} 款展示样式` : (candidate.item?.name || t("自定义展示")))
            : (candidate.item?.name || itemId);
        return `${candidate.preset?.name || candidate.presetId} / ${itemName}`;
    };
    const options = availableCandidates.map((candidate) => `
        <option value="${escapeHtmlAttr(isPopup ? candidate.presetId : `${candidate.presetId}:${candidate.itemId}`)}"
            data-preset-id="${escapeHtmlAttr(candidate.presetId)}"
            ${isPopup ? '' : `data-item-id="${escapeHtmlAttr(candidate.itemId)}"`}${selected(active, candidate, application) ? ' selected' : ''}>
            ${escapeHtml(candidateLabel(candidate))}
        </option>
    `).join('');
    const selectId = `phone-beautify-${application}-${sheetKey}`;
    const valueText = builtinSelected ? t("内置美化") : activeCandidate ? candidateLabel(activeCandidate) : emptyLabel;
    return {
        row: buildSelectRow(selectId, label, valueText, `${tableName} · ${label}`),
        control: `<select id="${escapeHtmlAttr(selectId)}" class="phone-settings-select" hidden
            data-content-preset-application="${escapeHtmlAttr(application)}"
            data-sheet-key="${escapeHtmlAttr(sheetKey)}" data-content-preset-current-value="${escapeHtmlAttr(currentValue)}"
            aria-label="${escapeHtmlAttr(label)}">
            <option value=""${activeCandidate || builtinSelected ? '' : ' selected'}>${escapeHtml(emptyLabel)}</option>
            ${builtinSceneId ? `<option value="builtin:${escapeHtmlAttr(builtinSceneId)}" data-builtin-scene="${escapeHtmlAttr(builtinSceneId)}"${builtinSelected ? ' selected' : ''}>${t("内置美化")}</option>` : ''}
            ${options}
        </select>`,
    };
}

export function buildBeautifyTemplatePageHtml(viewModel = {}) {
    const presets = Array.isArray(viewModel.presets) ? viewModel.presets : [];
    const tables = Array.isArray(viewModel.tables) ? viewModel.tables : [];
    const status = String(viewModel.status || 'loading');
    const statusHtml = status === 'loading'
        ? `<p class="phone-ios-group-footer" role="status">${t("正在读取模板仓库…")}</p>`
        : status === 'unavailable' || status === 'error'
            ? `<p class="phone-ios-group-footer" role="alert">${t`模板仓库不可用：${escapeHtml(viewModel.error?.message || t("未知错误"))}`}</p>`
            : '';
    const presetCardsHtml = presets.length > 0
        ? presets.map((preset) => {
            const issues = Array.isArray(preset.issues) ? preset.issues : [];
            return `<div class="phone-ios-row">
                <div class="phone-ios-row-label"><span class="phone-ios-row-title" title="${escapeHtmlAttr(preset.name || preset.id)}">${escapeHtml(preset.name || preset.id)}</span>
                    <span class="phone-ios-row-sub">${t`${Number(preset.items?.length || 0)}个模板项`} · ${escapeHtml(preset.id)}</span>
                    ${issues.length > 0 ? `<ul class="phone-ios-row-issues">${issues.map((issue) => `<li><strong>${escapeHtml(issue.code || 'issue')}</strong>：${escapeHtml(issue.message || '')}</li>`).join('')}</ul>` : ''}
                </div>
                <div class="phone-ios-row-actions">
                    <button type="button" class="phone-ios-mini-btn" data-action="export" data-preset-id="${escapeHtmlAttr(preset.id)}">${t`导出`}</button>
                    <button type="button" class="phone-ios-mini-btn" data-action="apply-preset" data-preset-id="${escapeHtmlAttr(preset.id)}">${t`一键应用`}</button>
                    <button type="button" class="phone-ios-mini-btn is-danger" data-action="delete" data-preset-id="${escapeHtmlAttr(preset.id)}" aria-haspopup="dialog">${t`删除`}</button>
                </div>
            </div>`;
        }).join('')
        : `<div class="phone-ios-row phone-ios-row-empty">${t("尚未导入玉子美化预设。")}</div>`;
    const tableCardsHtml = tables.length > 0
        ? tables.map((table) => {
            const pageCandidates = asArray(table.pageCandidates ?? table.candidates);
            const pageActive = table.pageActive ?? table.active;
            const popupCandidates = asArray(table.popupCandidates);
            const popupActive = table.popupActive;
            const applications = [buildApplicationSelect({
                application: 'page',
                label: t("表格美化应用"),
                emptyLabel: t("默认页面"),
                sheetKey: table.sheetKey,
                candidates: pageCandidates,
                active: pageActive,
                tableName: table.tableName,
            }), buildApplicationSelect({
                application: 'popup',
                label: t("弹窗应用"),
                emptyLabel: t("内置展示"),
                sheetKey: table.sheetKey,
                candidates: popupCandidates,
                active: popupActive,
                tableName: table.tableName,
            }), buildApplicationSelect({
                application: 'bottom',
                label: t("底部可视化美化"),
                emptyLabel: t("默认"),
                sheetKey: table.sheetKey,
                candidates: pageCandidates,
                active: table.bottomActive,
                builtinSceneId: table.presentation === 'theater' ? table.sceneId : '',
                tableName: table.tableName,
            })];
            return `<section class="phone-ios-group">
                <div class="phone-ios-row"><strong class="phone-ios-row-label">${escapeHtml(table.tableName || table.sheetKey)}</strong></div>
                ${applications.map(application => application.row).join('')}
                ${applications.map(application => application.control).join('')}
            </section>`;
        }).join('')
        : `<section class="phone-ios-group"><div class="phone-ios-row phone-ios-row-empty">${t("没有可配置的真实表。")}</div></section>`;
    const qq = viewModel.qq || { bindings: {}, presets: [] };
    const qqApplications = ['theme', 'popup'].map(kind => {
        const label = kind === 'theme' ? t('主题应用') : t('弹窗应用');
        const fallback = kind === 'theme' ? t('默认主题（保留个人装饰）') : t('内置通知样式');
        const candidates = asArray(qq.presets).filter(preset => preset.qq?.[kind]);
        const active = candidates.find(preset => qq.bindings?.[kind] === preset.id);
        const options = candidates.map(preset => `<option value="${escapeHtmlAttr(preset.id)}"${active === preset ? ' selected' : ''}>${escapeHtml(preset.name || preset.id)}</option>`).join('');
        const selectId = `phone-beautify-qq-${kind}`;
        return {
            row: buildSelectRow(selectId, label, active?.name || active?.id || fallback, `QQ · ${label}`),
            control: `<select id="${selectId}" class="phone-settings-select" hidden data-qq-preset-application="${kind}"
                data-content-preset-current-value="${escapeHtmlAttr(active?.id || '')}" aria-label="QQ ${label}">
                <option value=""${active ? '' : ' selected'}>${fallback}</option>${options}
            </select>`,
        };
    });
    const bodyHtml = `${statusHtml}
        <h2 class="phone-ios-group-header">${t("完整预设")}</h2>
        <section class="phone-ios-group"><button type="button" class="phone-ios-row is-action" data-action="import">${t`导入预设`}</button></section>
        <section class="phone-ios-group">${presetCardsHtml}</section>
        <p class="phone-ios-group-footer">${t("可一键应用预设，也可在下方分别选择美化；未涉及的应用保持不变。")}</p>
        <h2 class="phone-ios-group-header">${t("表格应用")}</h2>
        ${tableCardsHtml}
        <section class="phone-ios-group">
            <div class="phone-ios-row"><strong class="phone-ios-row-label">QQ</strong></div>
            ${qqApplications.map(application => application.row).join('')}
            ${qqApplications.map(application => application.control).join('')}
        </section>
        <p class="phone-ios-group-footer">${t('主题与通知独立应用；恢复默认不清除个人装饰。')}</p>
        <section class="phone-ios-group">
            <button type="button" class="phone-ios-row is-action is-danger" data-action="clear-all-page" aria-haspopup="dialog">${t`全部恢复页面默认`}</button>
            <button type="button" class="phone-ios-row is-action is-danger" data-action="clear-all-popup" aria-haspopup="dialog">${t`全部清空弹窗应用`}</button>
            <button type="button" class="phone-ios-row is-action is-danger" data-action="clear-all-bottom" aria-haspopup="dialog">${t`全部恢复底部默认`}</button>
        </section>
        <p class="phone-ios-group-footer">${t("底部可视化美化独立选择，重开面板后生效。")}</p>`;
    return buildSettingsPageFrame({
        title: t("模板工坊"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open phone-ios-grouped-page',
        bodyHtml,
    });
}
