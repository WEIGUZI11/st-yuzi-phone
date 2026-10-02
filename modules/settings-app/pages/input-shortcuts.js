import { t } from '../../i18n/index.js';
import { generateUniqueId } from '../../utils/object.js';
import { escapeHtml, escapeHtmlAttr } from '../../utils/dom-escape.js';
import { formatShortcut, shortcutFromEvent } from '../../input-shortcuts/config.js';
import { createScrollPreserver } from '../ui/settings-scroll-binding.js';
import { buildSettingsPageFrame } from '../layout/primitives.js';
import { bindSettingsGroupedControls } from '../ui/settings-controls.js';

function buildTextField(field, label, value, action, rows = 2) {
    const visible = field === 'text' ? action === 'insert' : action === 'wrap';
    return `<label class="phone-ios-row is-block"${visible ? '' : ' hidden'}>
        <span class="phone-ios-field-label">${label}</span>
        <textarea class="phone-settings-textarea phone-ios-field" data-field="${field}" rows="${rows}" spellcheck="false">
${escapeHtml(value || '')}</textarea></label>`;
}

export function buildInputShortcutsPageHtml({ enabled, rules, recordingId = '', dirtyIds = [] }) {
    const intro = `<section class="phone-ios-group yuzi-input-shortcut-intro">
        <label class="phone-ios-row"><span class="phone-ios-row-label">${t`启用`}</span>
            <span class="phone-ios-switch"><input type="checkbox" role="switch" data-field="enabled" aria-label="${t`启用输入快捷键`}"${enabled ? ' checked' : ''}><span class="phone-ios-switch-track"></span></span></label>
        </section>
        <p class="phone-ios-group-footer">${t("在酒馆输入框中，用按键插入文字或包裹选区。")}</p>
        <section class="phone-ios-group yuzi-input-shortcut-toolbar">
            <div class="phone-ios-row"><span class="phone-ios-row-sub">${t`${rules.length} 条规则 · 修改后点击保存`}</span></div>
            <button type="button" class="phone-ios-row is-action" data-action="add">${t`新增规则`}</button>
        </section>`;
    const cards = rules.map((rule, index) => {
        const id = escapeHtmlAttr(rule.id);
        const selectId = `shortcut-action-${id}`;
        return `<div data-rule-id="${id}">
            <h2 class="phone-ios-group-header" id="shortcut-title-${id}">${t`规则 ${index + 1}`}</h2>
            <section class="phone-ios-group" aria-labelledby="shortcut-title-${id}">
                <label class="phone-ios-row"><span class="phone-ios-row-label">${t`启用`}</span>
                    <span class="phone-ios-switch"><input type="checkbox" role="switch" data-field="rule-enabled" aria-label="${t`启用规则 ${index + 1}`}"${rule.enabled ? ' checked' : ''}><span class="phone-ios-switch-track"></span></span></label>
                <div class="phone-ios-row"><span class="phone-ios-row-label">${t`快捷键`}</span>
                    <button type="button" class="phone-ios-mini-btn yuzi-input-shortcut-key${rule.shortcut ? '' : ' is-empty'}" data-action="record" aria-label="${t`录制规则 ${index + 1} 的快捷键`}" aria-pressed="${recordingId === rule.id}">${recordingId === rule.id ? t("请按键…") : escapeHtml(formatShortcut(rule.shortcut))}</button></div>
                <div class="phone-ios-row"><span class="phone-ios-row-label">${t`动作`}</span>
                    <div class="phone-ios-seg" data-settings-seg="${selectId}" role="group" aria-label="${t`规则 ${index + 1} 动作`}">
                        <button type="button" class="phone-ios-seg-item" data-value="insert" aria-pressed="${rule.action === 'insert'}">${t`插入文本`}</button>
                        <button type="button" class="phone-ios-seg-item" data-value="wrap" aria-pressed="${rule.action === 'wrap'}">${t`成对包裹`}</button>
                    </div></div>
                ${buildTextField('text', t("插入内容"), rule.text, rule.action, 3)}
                ${buildTextField('left', t("左侧内容"), rule.left, rule.action)}
                ${buildTextField('right', t("右侧内容"), rule.right, rule.action)}
                <div class="phone-ios-row">
                    <span class="phone-ios-row-label" data-rule-status role="status">${dirtyIds.includes(rule.id) ? t("未保存") : ''}</span>
                    <span class="phone-ios-row-actions">
                        <button type="button" class="phone-ios-mini-btn is-danger" data-action="delete">${t`删除`}</button>
                        <button type="button" class="phone-ios-mini-btn" data-action="save">${t`保存`}</button>
                    </span>
                </div>
                <select id="${selectId}" class="phone-settings-select" data-field="action" hidden>
                    <option value="insert"${rule.action === 'insert' ? ' selected' : ''}>${t`插入文本`}</option>
                    <option value="wrap"${rule.action === 'wrap' ? ' selected' : ''}>${t`成对包裹`}</option>
                </select>
            </section>
        </div>`;
    }).join('');
    return buildSettingsPageFrame({
        title: t("输入快捷键"),
        bodyClass: 'phone-app-body phone-settings-scroll phone-ios-grouped-page yuzi-input-shortcuts',
        bodyHtml: intro + (cards || `<section class="phone-ios-group"><p class="phone-ios-row phone-ios-row-empty">${t("还没有规则，点击「新增规则」开始。")}</p></section>`),
    });
}

export function createInputShortcutsPage(ctx) {
    const { container, state, render, pageRuntime, inputShortcutsSettingsService: service, showToast } = ctx;
    const scroll = createScrollPreserver(container, state, undefined, pageRuntime);
    let rules = service.readConfig().rules;
    const dirtyIds = new Set();
    let recording = null;
    let unbindGrouped = () => {};

    function markDirty(id, card) {
        dirtyIds.add(id);
        const status = card?.querySelector('[data-rule-status]');
        if (status) status.textContent = t("未保存");
    }
    function stopRecording(commit = false) {
        if (!recording) return;
        const { button, rule, candidate } = recording;
        recording = null;
        if (commit && candidate) {
            rule.shortcut = candidate;
            markDirty(rule.id, button.closest('[data-rule-id]'));
        }
        button.textContent = formatShortcut(rule.shortcut);
        button.classList.toggle('is-empty', !rule.shortcut);
        button.setAttribute('aria-pressed', 'false');
    }
    function draw() {
        stopRecording();
        container.innerHTML = buildInputShortcutsPageHtml({
            enabled: service.readConfig().enabled, rules, dirtyIds: [...dirtyIds],
        });
    }
    const redraw = scroll.createRerenderWithScroll('inputShortcutsScrollTop', draw);
    function feedback(result, success = '') {
        if (!result.ok || success) showToast?.(container, result.ok ? success : result.error, !result.ok, pageRuntime);
        return result.ok;
    }
    function locate(target) {
        const card = target.closest('[data-rule-id]');
        return { card, rule: rules.find(item => item.id === card?.dataset.ruleId) };
    }
    function handleClick(event) {
        const button = event.target.closest('button');
        if (!button || !container.contains(button)) return;
        if (button.matches('.phone-nav-back')) {
            stopRecording();
            state.mode = 'home';
            render();
            return;
        }
        const action = button.dataset.action;
        if (action === 'add') {
            const rule = { id: generateUniqueId('shortcut'), enabled: true, shortcut: null, action: 'insert', text: '', left: '', right: '' };
            rules.push(rule);
            dirtyIds.add(rule.id);
            redraw();
            return;
        }
        const { rule } = locate(button);
        if (!rule) return;
        if (action === 'record') {
            const wasRecording = recording?.button === button;
            stopRecording();
            if (wasRecording) return;
            recording = { button, rule, candidate: null };
            button.textContent = t("请按键…");
            button.classList.remove('is-empty');
            button.setAttribute('aria-pressed', 'true');
            button.focus({ preventScroll: true });
        } else if (action === 'save') {
            const result = service.saveRule(rule);
            if (!result.ok) { feedback(result); return; }
            rules = rules.map(item => item.id === rule.id ? result.config.rules.find(saved => saved.id === rule.id) : item);
            dirtyIds.delete(rule.id);
            redraw();
            feedback(result, t("规则已保存"));
        } else if (action === 'delete') {
            const saved = service.readConfig().rules.some(item => item.id === rule.id);
            if (saved && !feedback(service.removeRule(rule.id))) return;
            rules = rules.filter(item => item.id !== rule.id);
            dirtyIds.delete(rule.id);
            redraw();
        }
    }
    function handleChange(event) {
        const target = event.target;
        if (target.dataset.field === 'enabled') {
            const result = service.setEnabled(target.checked);
            redraw();
            feedback(result);
            return;
        }
        const { rule, card } = locate(target);
        if (!rule) return;
        if (target.dataset.field === 'rule-enabled') {
            const saved = service.readConfig().rules.some(item => item.id === rule.id);
            if (saved) {
                const result = service.setRuleEnabled(rule.id, target.checked);
                if (!result.ok) { redraw(); feedback(result); return; }
            }
            rule.enabled = target.checked;
            if (!saved) markDirty(rule.id, card);
            redraw();
        } else if (target.dataset.field === 'action') {
            rule.action = target.value;
            markDirty(rule.id, card);
            redraw();
        }
    }
    function handleRecordingKey(event) {
        if (!recording || event.target !== recording.button || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        if (event.type === 'keydown') recording.candidate = shortcutFromEvent(event);
        else stopRecording(true);
    }
    return {
        mount() {
            draw();
            unbindGrouped = bindSettingsGroupedControls(container, pageRuntime);
            scroll.restoreScroll('inputShortcutsScrollTop');
            pageRuntime.addEventListener(container, 'click', handleClick);
            pageRuntime.addEventListener(container, 'change', handleChange);
            pageRuntime.addEventListener(container, 'input', event => {
                const { rule, card } = locate(event.target);
                const field = event.target.dataset.field;
                if (rule && ['text', 'left', 'right'].includes(field)) {
                    rule[field] = event.target.value;
                    markDirty(rule.id, card);
                }
            });
            pageRuntime.addEventListener(container, 'keydown', handleRecordingKey, true);
            pageRuntime.addEventListener(container, 'keyup', handleRecordingKey, true);
            pageRuntime.addEventListener(container, 'focusout', event => {
                if (event.target === recording?.button) stopRecording();
            });
        },
        dispose() {
            stopRecording();
            unbindGrouped();
            scroll.captureScroll('inputShortcutsScrollTop');
        },
    };
}
