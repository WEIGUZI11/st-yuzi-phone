import { t } from '../../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../../utils/dom-escape.js';
import { QQ_V2_PROMPT_PLACEHOLDER_DEFINITIONS } from '../../qq-v2/prompt/placeholders.js';
import { buildSettingsPageFrame } from '../layout/primitives.js';
import { downloadTextFile } from '../services/media-upload/download.js';
import { showAlertDialog, showConfirmDialog } from '../ui/confirm-dialog.js';
import { bindSettingsGroupedControls } from '../ui/settings-controls.js';
import {
    AI_INSTRUCTION_PROMPT_ROLES,
    createAiInstructionDraft,
    createNewAiInstructionDraft,
    findMisreadControlMessages,
    removeMisreadControlMessages,
} from './ai-instruction-preset-draft.js';

function asText(value) {
    return String(value || '').trim();
}

function getErrorMessage(result, fallback) {
    return asText(result?.error?.message) || fallback;
}

function filenamePart(value) {
    return asText(value).replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-').slice(0, 80) || 'preset';
}

function snapshotDraft(draft) {
    const normalized = createAiInstructionDraft(draft);
    return JSON.stringify({
        name: normalized.name,
        messages: normalized.messages.map(({ name, role, content }) => [name, role, content]),
    });
}

function buildPresetOptions(presets, selectedPresetId) {
    const selectedId = asText(selectedPresetId);
    return [
        selectedId ? '' : `<option value="" selected>${t("新建 AI 指令预设（未保存）")}</option>`,
        ...(Array.isArray(presets) ? presets : []).map((preset) => {
            const presetId = asText(preset?.presetId);
            const suffix = preset?.isBuiltIn === true ? t("（内置）") : '';
            return `<option value="${escapeHtmlAttr(presetId)}" ${presetId === selectedId ? 'selected' : ''}>${escapeHtml(`${preset?.name || t("未命名预设")}${suffix}`)}</option>`;
        }),
    ].join('');
}

function buildRoleOptions(role) {
    return AI_INSTRUCTION_PROMPT_ROLES.map(value => (
        `<option value="${value}" ${value === role ? 'selected' : ''}>${value}</option>`
    )).join('');
}

function buildPlaceholderGuide() {
    const items = QQ_V2_PROMPT_PLACEHOLDER_DEFINITIONS.map(({ token, description }) => `
        <div class="phone-ios-row is-block phone-ai-preset-placeholder-row">
            <code>${escapeHtml(token)}</code>
            <span class="phone-ios-row-sub">${escapeHtml(t(description))}</span>
        </div>
    `).join('');
    return `
        <h2 class="phone-ios-group-header">${t("占位符说明")}</h2>
        <section class="phone-ios-group phone-ai-preset-placeholder-grid">${items}</section>
        <p class="phone-ios-group-footer">${t("把占位符写入任意消息块内容，发起请求时会替换为对应资料。")}</p>
    `;
}

function buildMessageBlocks(messages, disabled) {
    if (messages.length === 0) {
        return `<section class="phone-ios-group"><div class="phone-ios-row phone-ios-row-empty">${t("当前预设没有消息块。")}</div></section>`;
    }
    return messages.map((message, index) => `
        <article class="phone-ios-group phone-ai-preset-segment-card" data-message-index="${index}">
            <div class="phone-ai-preset-segment-toolbar">
                <span class="phone-ai-preset-segment-index">#${index + 1}</span>
                <div class="phone-ai-preset-segment-toolbar-actions">
                    <button type="button" class="phone-ios-mini-btn phone-ai-message-up-btn" data-message-index="${index}" ${index === 0 || disabled ? 'disabled' : ''}>${t`上移`}</button>
                    <button type="button" class="phone-ios-mini-btn phone-ai-message-down-btn" data-message-index="${index}" ${index === messages.length - 1 || disabled ? 'disabled' : ''}>${t`下移`}</button>
                    <button type="button" class="phone-ios-mini-btn is-danger phone-ai-message-delete-btn" data-message-index="${index}" ${disabled}>${t`删除`}</button>
                </div>
            </div>
            <label class="phone-ios-row">
                <span class="phone-ios-row-field-label">${t`消息块名称`}</span>
                <input class="phone-ios-inline-input phone-ai-message-name" maxlength="120" value="${escapeHtmlAttr(message.name)}" ${disabled}>
            </label>
            <div class="phone-ios-row">
                <span class="phone-ios-row-label">${t`角色`}</span>
                <div class="phone-ios-seg" data-settings-seg="phone-ai-message-role-${index}" role="group" aria-label="${t`角色`}">
                    ${AI_INSTRUCTION_PROMPT_ROLES.map(role => `<button type="button" class="phone-ios-seg-item" data-value="${role}" aria-pressed="${role === message.role}" ${disabled}>${role}</button>`).join('')}
                </div>
            </div>
            <label class="phone-ios-row is-block">
                <span class="phone-ios-field-label">${t`内容`}</span>
                <textarea class="phone-ios-field phone-ai-message-content" rows="8" ${disabled}>${escapeHtml(message.content)}</textarea>
            </label>
            <select id="phone-ai-message-role-${index}" class="phone-ai-message-role" hidden ${disabled}>${buildRoleOptions(message.role)}</select>
        </article>
    `).join('');
}

function buildAiInstructionPresetsPageHtml(pageState) {
    const draft = pageState.draft || createNewAiInstructionDraft();
    const disabled = pageState.loading || pageState.busy ? 'disabled' : '';
    const canDelete = draft.presetId && !draft.isBuiltIn && !disabled;
    const canRestoreCurrent = draft.presetId && draft.isBuiltIn && !disabled;
    const suspiciousEmptyCount = findMisreadControlMessages(draft.messages).indexes.length;
    const preset = pageState.presets.find(item => item.presetId === pageState.selectedPresetId);
    const presetLabel = preset
        ? `${preset.name || t("未命名预设")}${preset.isBuiltIn ? t("（内置）") : ''}`
        : t("新建 AI 指令预设（未保存）");
    const isDirty = snapshotDraft(draft) !== pageState.savedSnapshot;
    const status = pageState.error
        ? `<div class="phone-ios-row phone-ios-row-empty is-danger" role="alert">${escapeHtml(pageState.error)}</div>`
        : `<div class="phone-ios-row phone-ios-row-empty" role="status">${t("正在读取 AI 指令预设...")}</div>`;
    const action = (id, label, disabledAttr = disabled, danger = false, hidden = false) => `
        <button type="button" class="phone-ios-row is-action${danger ? ' is-danger' : ''}" id="${id}" ${disabledAttr} ${hidden ? 'hidden' : ''}>${label}</button>`;
    const managementSection = `
        ${pageState.loading || pageState.error ? `<section class="phone-ios-group">${status}</section>` : ''}
        <h2 class="phone-ios-group-header">${t("AI 指令预设")}</h2>
        <section class="phone-ios-group">
            <button type="button" class="phone-ios-row is-tappable" data-settings-select="phone-ai-instruction-preset-select" aria-haspopup="dialog" ${disabled}>
                <span class="phone-ios-row-label">${t`选择预设`}<span class="phone-ios-badge is-danger" id="phone-ai-instruction-dirty-badge"${isDirty ? '' : ' hidden'}>${t`未保存`}</span></span>
                <span class="phone-ios-row-value"><span class="phone-ios-row-value-text">${escapeHtml(presetLabel)}</span><span class="phone-ios-row-chevron" aria-hidden="true">›</span></span>
            </button>
            <label class="phone-ios-row">
                <span class="phone-ios-row-field-label">${t`预设名称`}</span>
                <input id="phone-ai-instruction-preset-name" class="phone-ios-inline-input" maxlength="120" value="${escapeHtmlAttr(draft.name)}" ${disabled}>
            </label>
            ${action('phone-ai-instruction-new-btn', t("新建 AI 指令预设"))}
            <select id="phone-ai-instruction-preset-select" hidden ${disabled}>${buildPresetOptions(pageState.presets, pageState.selectedPresetId)}</select>
        </section>
        <h2 class="phone-ios-group-header">${t("导入、导出与恢复")}</h2>
        <section class="phone-ios-group">
            ${action('phone-ai-instruction-import-btn', t("导入"))}
            ${action('phone-ai-instruction-export-current-btn', t("导出当前"), draft.presetId && !disabled ? '' : 'disabled')}
            ${action('phone-ai-instruction-export-all-btn', t("导出全部"), pageState.presets.length && !disabled ? '' : 'disabled')}
            ${action('phone-ai-instruction-restore-current-btn', t("恢复当前"), canRestoreCurrent ? '' : 'disabled')}
            ${action('phone-ai-instruction-restore-all-btn', t("恢复全部"))}
            <input type="file" id="phone-ai-instruction-import-file" accept="application/json,.json" hidden ${disabled}>
        </section>
        <p class="phone-ios-group-footer">${t("导入 JSON 文件。「恢复当前」仅对内置预设可用；「恢复全部」恢复全部内置预设，自定义预设不会删除。")}</p>
        <h2 class="phone-ios-group-header">${t("保存")}</h2>
        <section class="phone-ios-group">
            ${action('phone-ai-instruction-save-btn', t("保存预设"))}
            ${action('phone-ai-instruction-save-as-btn', t("另存为"))}
            ${action('phone-ai-instruction-delete-btn', t("删除预设"), canDelete ? '' : 'disabled', true)}
            ${action('phone-ai-instruction-cleanup-btn', t`清理疑似异常空块（${suspiciousEmptyCount}）`, disabled, false, suspiciousEmptyCount < 3)}
        </section>
        <p class="phone-ios-group-footer">${t("名称不能与已有预设重复；内置预设不可删除。")}</p>
    `;
    const messagesSection = `
        <h2 class="phone-ios-group-header">${t("消息块")}</h2>
        <div class="phone-ai-preset-segment-stack">
            <section class="phone-ios-group">${action('phone-ai-instruction-add-message-top-btn', `＋ ${t("添加消息块")}`)}</section>
            <div id="phone-ai-instruction-message-stack" class="phone-ai-preset-segment-stack">${buildMessageBlocks(draft.messages, disabled)}</div>
            <section class="phone-ios-group">${action('phone-ai-instruction-add-message-btn', `＋ ${t("添加消息块")}`)}</section>
        </div>
        <p class="phone-ios-group-footer">${t("消息块按顺序拼成请求，可用上移 / 下移调整顺序。")}</p>
    `;
    return buildSettingsPageFrame({
        title: t("AI 指令预设"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-settings-open phone-ios-grouped-page phone-ai-instruction-presets-page',
        bodyHtml: `${managementSection}${messagesSection}${buildPlaceholderGuide()}`,
    });
}

function createAiInstructionPresetSession(ctx) {
    const state = {
        loading: true,
        busy: false,
        error: '',
        presets: [],
        selectedPresetId: '',
        draft: createNewAiInstructionDraft(),
        savedSnapshot: '',
    };
    let active = false;
    let generation = 0;
    const isCurrent = token => active && token === generation;
    const repaint = () => {
        if (!active) return;
        if (typeof ctx.rerenderAiInstructionPresetsKeepScroll === 'function') {
            ctx.rerenderAiInstructionPresetsKeepScroll();
            return;
        }
        ctx.render?.();
    };
    const notify = (message, isError = false) => ctx.showToast?.(ctx.container, message, isError, ctx.pageRuntime);
    const findPreset = id => state.presets.find(preset => asText(preset?.presetId) === asText(id)) || null;
    const hasNameConflict = (name, ignoredPresetId = '') => state.presets.some((preset) => (
        asText(preset?.presetId) !== asText(ignoredPresetId)
        && asText(preset?.name) === asText(name)
    ));
    const showNameConflict = () => showAlertDialog(
        ctx.container,
        t("预设名称重复"),
        t("已经存在同名 AI 指令预设，请修改名称后再保存。"),
        t("知道了"),
        ctx.pageRuntime,
    );

    const load = async (selectedPresetId = state.selectedPresetId, repaintLoading = true) => {
        const token = ++generation;
        state.loading = true;
        state.error = '';
        if (repaintLoading) repaint();
        const result = await ctx.qqV2PresetService.readSharedResources();
        if (!isCurrent(token)) return false;
        state.loading = false;
        if (result?.ok !== true) {
            state.error = getErrorMessage(result, t("读取 AI 指令预设失败"));
            repaint();
            return false;
        }
        state.presets = Array.isArray(result.promptPresets) ? result.promptPresets : [];
        const selected = findPreset(selectedPresetId) || findPreset(state.selectedPresetId) || state.presets[0] || null;
        state.selectedPresetId = asText(selected?.presetId);
        state.draft = selected ? createAiInstructionDraft(selected) : createNewAiInstructionDraft();
        state.savedSnapshot = snapshotDraft(state.draft);
        repaint();
        return true;
    };

    const isDirty = draft => snapshotDraft(draft || state.draft) !== state.savedSnapshot;

    const select = (presetId, force = false) => {
        if (state.busy) return;
        if (!force && isDirty()) return false;
        const selected = findPreset(presetId);
        state.selectedPresetId = asText(selected?.presetId);
        state.draft = selected ? createAiInstructionDraft(selected) : createNewAiInstructionDraft();
        state.savedSnapshot = snapshotDraft(state.draft);
        repaint();
        return true;
    };

    const save = async (draft, saveAs = false) => {
        if (!active || state.busy) return false;
        const nextDraft = createAiInstructionDraft({ ...state.draft, ...draft });
        const ignoredPresetId = saveAs ? '' : nextDraft.presetId;
        if (hasNameConflict(nextDraft.name, ignoredPresetId)) {
            showNameConflict();
            return false;
        }
        state.busy = true;
        state.draft = nextDraft;
        repaint();
        const preset = {
            ...(!saveAs && state.draft.presetId ? { id: state.draft.presetId } : {}),
            name: state.draft.name,
            messages: state.draft.messages,
        };
        const result = await ctx.qqV2PresetService.savePromptPreset({ preset });
        if (!active) return false;
        state.busy = false;
        if (result?.ok !== true) {
            if (result?.error?.code === 'prompt_preset_name_conflict') {
                repaint();
                showNameConflict();
                return false;
            }
            notify(getErrorMessage(result, t("保存 AI 指令预设失败")), true);
            repaint();
            return false;
        }
        notify(saveAs ? t("AI 指令预设已另存为新预设") : t("AI 指令预设已保存"));
        return load(result.promptPreset?.presetId, false);
    };

    const remove = async () => {
        if (!active || state.busy || !state.draft.presetId || state.draft.isBuiltIn) return false;
        state.busy = true;
        repaint();
        const result = await ctx.qqV2PresetService.deletePromptPreset({ promptPresetId: state.draft.presetId });
        if (!active) return false;
        state.busy = false;
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("删除 AI 指令预设失败")), true);
            repaint();
            return false;
        }
        notify(t("AI 指令预设已删除"));
        return load('', false);
    };

    const restoreCurrent = async () => {
        if (!active || state.busy || !state.draft.presetId || !state.draft.isBuiltIn) return false;
        state.busy = true;
        repaint();
        const result = await ctx.qqV2PresetService.restoreBuiltInPromptPreset({ promptPresetId: state.draft.presetId });
        if (!active) return false;
        state.busy = false;
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("恢复内置预设失败")), true);
            repaint();
            return false;
        }
        notify(t("内置预设已恢复"));
        return load(result.promptPreset?.presetId, false);
    };

    const restoreAll = async () => {
        if (!active || state.busy) return false;
        state.busy = true;
        repaint();
        const result = await ctx.qqV2PresetService.restoreAllBuiltInPromptPresets();
        if (!active) return false;
        state.busy = false;
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("恢复全部内置预设失败")), true);
            repaint();
            return false;
        }
        notify(t("五份内置预设已恢复"));
        return load(state.selectedPresetId, false);
    };

    const importFile = async (file) => {
        if (!active || state.busy || !file || typeof file.text !== 'function') return false;
        state.busy = true;
        repaint();
        let source;
        try {
            source = JSON.parse(await file.text());
        } catch {
            state.busy = false;
            notify(t("导入文件不是有效的 JSON"), true);
            repaint();
            return false;
        }
        const result = await ctx.qqV2PresetService.importPromptPresets({ source });
        if (!active) return false;
        state.busy = false;
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("导入 AI 指令预设失败")), true);
            repaint();
            return false;
        }
        const firstId = result.promptPresets?.[0]?.presetId || '';
        notify(t("AI 指令预设已导入"));
        return load(firstId, false);
    };

    const exportCurrent = async () => {
        if (!active || state.busy || !state.draft.presetId) return false;
        const result = await ctx.qqV2PresetService.exportPromptPreset({ promptPresetId: state.draft.presetId });
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("导出当前预设失败")), true);
            return false;
        }
        downloadTextFile(`qq-v2-ai-${filenamePart(result.promptPreset?.name)}.json`, JSON.stringify({ presets: [result.promptPreset] }, null, 2), 'application/json');
        notify(t("当前 AI 指令预设已导出"));
        return true;
    };

    const exportAll = async () => {
        if (!active || state.busy) return false;
        const result = await ctx.qqV2PresetService.exportAllPromptPresets();
        if (result?.ok !== true) {
            notify(getErrorMessage(result, t("导出全部预设失败")), true);
            return false;
        }
        downloadTextFile('qq-v2-ai-presets.json', JSON.stringify({ presets: result.promptPresets }, null, 2), 'application/json');
        notify(t("全部 AI 指令预设已导出"));
        return true;
    };

    return {
        state,
        activate() { active = true; },
        deactivate() { active = false; generation += 1; },
        load,
        select,
        newPreset(force = false) {
            if (state.busy) return;
            if (!force && isDirty()) return false;
            state.selectedPresetId = '';
            state.draft = createNewAiInstructionDraft();
            state.savedSnapshot = snapshotDraft(state.draft);
            repaint();
            return true;
        },
        isDirty,
        save,
        saveAs(draft) { return save(draft, true); },
        remove,
        restoreCurrent,
        restoreAll,
        importFile,
        exportCurrent,
        exportAll,
        addMessage(draft, atStart = false) {
            const message = { id: '', name: '新消息块', role: 'system', content: '' };
            const messages = atStart
                ? [message, ...draft.messages]
                : [...draft.messages, message];
            state.draft = createAiInstructionDraft({ ...state.draft, ...draft, messages });
            repaint();
        },
        moveMessage(draft, fromIndex, toIndex) {
            const messages = [...draft.messages];
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= messages.length || toIndex >= messages.length) return;
            const [message] = messages.splice(fromIndex, 1);
            messages.splice(toIndex, 0, message);
            state.draft = createAiInstructionDraft({ ...state.draft, ...draft, messages });
            repaint();
        },
        deleteMessage(draft, index) {
            state.draft = createAiInstructionDraft({ ...state.draft, ...draft, messages: draft.messages.filter((_, messageIndex) => messageIndex !== index) });
            repaint();
        },
        cleanupMessages(draft) {
            const result = removeMisreadControlMessages(draft.messages);
            state.draft = createAiInstructionDraft({ ...state.draft, ...draft, messages: result.messages });
            repaint();
            return result.removedCount;
        },
    };
}

function bindAiInstructionPresetInteractions(ctx, session) {
    const { container, state, render, pageRuntime } = ctx;
    const addListener = (target, type, listener) => pageRuntime?.addEventListener?.(target, type, listener);
    const readDraft = () => ({
        ...session.state.draft,
        name: asText(container.querySelector('#phone-ai-instruction-preset-name')?.value),
        messages: Array.from(container.querySelectorAll('.phone-ai-preset-segment-card')).map((block, index) => ({
            id: session.state.draft.messages[index]?.id || '',
            name: asText(block.querySelector('.phone-ai-message-name')?.value) || '未命名消息块',
            role: String(block.querySelector('.phone-ai-message-role')?.value || 'system'),
            content: String(block.querySelector('.phone-ai-message-content')?.value || ''),
        })),
    });
    const confirmDiscard = (continueAction) => {
        if (!session.isDirty(readDraft())) {
            continueAction();
            return;
        }
        showConfirmDialog(
            container,
            t("放弃未保存的修改？"),
            t("当前草稿的修改尚未保存，切换后将丢失。"),
            continueAction,
            t("放弃"),
            t("取消"),
            pageRuntime,
        );
    };

    addListener(container.querySelector('.phone-nav-back'), 'click', () => { state.mode = 'home'; render(); });
    addListener(container, 'input', () => {
        session.state.draft = createAiInstructionDraft(readDraft());
        const badge = container.querySelector('#phone-ai-instruction-dirty-badge');
        if (badge) badge.hidden = !session.isDirty(session.state.draft);
    });
    container.querySelectorAll('.phone-ai-preset-segment-card .phone-ios-seg-item').forEach((button) => {
        addListener(button, 'click', () => {
            const badge = container.querySelector('#phone-ai-instruction-dirty-badge');
            if (badge) badge.hidden = false;
        });
    });
    addListener(container.querySelector('#phone-ai-instruction-preset-select'), 'change', (event) => {
        const select = event.currentTarget;
        const nextId = select?.value || '';
        if (!session.isDirty(readDraft())) {
            session.select(nextId);
            return;
        }
        select.value = state.selectedPresetId || '';
        const selectedOption = select.selectedOptions?.[0];
        const valueText = container.querySelector('[data-settings-select="phone-ai-instruction-preset-select"] .phone-ios-row-value-text');
        if (valueText && selectedOption) valueText.textContent = selectedOption.textContent.trim();
        showConfirmDialog(
            container,
            t("放弃未保存的修改？"),
            t("当前草稿的修改尚未保存，切换后将丢失。"),
            () => { session.select(nextId, true); },
            t("放弃"),
            t("取消"),
            pageRuntime,
        );
    });
    addListener(container.querySelector('#phone-ai-instruction-new-btn'), 'click', () => {
        confirmDiscard(() => session.newPreset(true));
    });
    addListener(container.querySelector('#phone-ai-instruction-save-btn'), 'click', () => { void session.save(readDraft()); });
    addListener(container.querySelector('#phone-ai-instruction-save-as-btn'), 'click', () => { void session.saveAs(readDraft()); });
    addListener(container.querySelector('#phone-ai-instruction-add-message-btn'), 'click', () => session.addMessage(readDraft()));
    addListener(container.querySelector('#phone-ai-instruction-add-message-top-btn'), 'click', () => session.addMessage(readDraft(), true));
    addListener(container.querySelector('#phone-ai-instruction-restore-all-btn'), 'click', () => {
        showConfirmDialog(container, t("恢复全部内置预设"), t("将恢复五份内置预设，自定义预设不会删除。"), () => { void session.restoreAll(); }, t("恢复"), t("取消"), pageRuntime);
    });
    addListener(container.querySelector('#phone-ai-instruction-delete-btn'), 'click', () => {
        const draft = readDraft();
        const name = asText(draft.name) || t("当前 AI 指令预设");
        showConfirmDialog(container, t("删除 AI 指令预设"), t`确定删除「${name}」吗？`, () => { void session.remove(); }, t("删除"), t("取消"), pageRuntime);
    });
    addListener(container.querySelector('#phone-ai-instruction-cleanup-btn'), 'click', () => {
        const draft = readDraft();
        const count = findMisreadControlMessages(draft.messages).indexes.length;
        showConfirmDialog(
            container,
            t("清理疑似异常空块"),
            t`将从当前草稿移除 ${count} 个“未命名 / system / 空内容”消息块。清理后请检查并手动保存。`,
            () => { session.cleanupMessages(draft); },
            t("清理"),
            t("取消"),
            pageRuntime,
        );
    });
    const importInput = container.querySelector('#phone-ai-instruction-import-file');
    addListener(container.querySelector('#phone-ai-instruction-import-btn'), 'click', () => importInput?.click());
    addListener(importInput, 'change', () => {
        const file = importInput?.files?.[0];
        if (importInput) importInput.value = '';
        if (file) void session.importFile(file);
    });
    addListener(container.querySelector('#phone-ai-instruction-export-current-btn'), 'click', () => { void session.exportCurrent(); });
    addListener(container.querySelector('#phone-ai-instruction-export-all-btn'), 'click', () => { void session.exportAll(); });
    container.querySelectorAll('.phone-ai-message-up-btn').forEach((button) => addListener(button, 'click', () => {
        const index = Number(button.dataset.messageIndex);
        session.moveMessage(readDraft(), index, index - 1);
    }));
    container.querySelectorAll('.phone-ai-message-down-btn').forEach((button) => addListener(button, 'click', () => {
        const index = Number(button.dataset.messageIndex);
        session.moveMessage(readDraft(), index, index + 1);
    }));
    container.querySelectorAll('.phone-ai-message-delete-btn').forEach((button) => addListener(button, 'click', () => {
        const index = Number(button.dataset.messageIndex);
        const draft = readDraft();
        const message = draft.messages[index];
        showConfirmDialog(
            container,
            t("删除消息块"),
            t`确定删除「${message?.name || t("未命名消息块")}」吗？删除后需保存预设才会生效。`,
            () => session.deleteMessage(draft, index),
            t("删除"),
            t("取消"),
            pageRuntime,
        );
    }));
    addListener(container.querySelector('#phone-ai-instruction-restore-current-btn'), 'click', () => {
        const draft = readDraft();
        showConfirmDialog(
            container,
            t("恢复内置预设"),
            t`将用内置内容覆盖「${draft.name}」，当前修改会丢失。`,
            () => { void session.restoreCurrent(); },
            t("恢复"),
            t("取消"),
            pageRuntime,
        );
    });
    return bindSettingsGroupedControls(container, pageRuntime, () => !state.loading && !state.busy);
}

export function createAiInstructionPresetsPage(ctx) {
    const session = createAiInstructionPresetSession(ctx);
    let unbindGrouped = () => {};
    const paint = () => {
        unbindGrouped();
        ctx.container.innerHTML = buildAiInstructionPresetsPageHtml(session.state);
        unbindGrouped = bindAiInstructionPresetInteractions(ctx, session) || (() => {});
    };
    return {
        mount() {
            session.activate();
            paint();
            void session.load('', false);
        },
        update() { paint(); },
        dispose() {
            unbindGrouped();
            session.deactivate();
        },
    };
}

export function renderAiInstructionPresetsPage(ctx) {
    createAiInstructionPresetsPage(ctx).mount();
}
