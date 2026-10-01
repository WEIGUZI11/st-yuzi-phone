import { t } from '../i18n/index.js';
import { getPhoneSettings, savePhoneSetting } from '../settings.js';
import { getTableData } from '../phone-core/data-api.js';
import { subscribeTableUpdate } from '../phone-core/callbacks.js';
import { createRuntimeScope } from '../runtime-manager.js';
import { getAppearanceFontFamily, applyAppearanceFontLibrary } from '../settings-app/services/appearance-settings/font-library-service.js';
import { applyPhoneThemeMode } from '../settings-app/services/appearance-settings/theme-settings.js';
import { getReviewState, subscribeReviewState } from '../table-update-review/store.js';
import { buildTableUpdateReviewContentHtml } from '../table-update-review/templates.js';
import { buildNavigation, buildTableContent, controls, iconButton } from './view.js';
import { createBottomOptions } from './options.js';
import { openBottomSettings } from './settings-dialog.js';
import { bindBottomScrollChain } from './scroll-chain.js';
import { createBottomLayout } from './layout.js';
import { createBottomContentRenderer } from './content-renderer.js';
import { createBottomEditSession } from './edit-session.js';
import { resizeDetailTextarea } from '../table-viewer/detail-edit-field.js';
import { showInlineToast } from '../table-viewer/shared-ui.js';
import { escapeHtml as html } from '../utils/dom-escape.js';

export function createBottomVisualization() {
    const scope = createRuntimeScope('bottom-visualization');
    const root = document.createElement('div');
    root.className = 'yuzi-bottom-root';
    root.innerHTML = `<div class="yuzi-bottom-edge-background" aria-hidden="true" hidden></div><section class="yuzi-bottom-panel" hidden><header class="yuzi-bottom-heading"></header><div class="yuzi-bottom-content"></div></section><div class="yuzi-bottom-dock"><nav class="yuzi-bottom-nav"></nav><button type="button" class="yuzi-bottom-bar" data-action="expand" hidden>玉子 <span aria-hidden="true">⌃</span></button></div><button type="button" class="yuzi-bottom-launch" data-action="launch" aria-label="${t('展开')}" hidden>Y</button>`;
    const edgeBackground = root.querySelector('.yuzi-bottom-edge-background');
    const panel = root.querySelector('.yuzi-bottom-panel');
    const dock = root.querySelector('.yuzi-bottom-dock');
    const nav = root.querySelector('.yuzi-bottom-nav');
    const content = root.querySelector('.yuzi-bottom-content');
    const bar = root.querySelector('.yuzi-bottom-bar');
    const launch = root.querySelector('.yuzi-bottom-launch');
    let active = '', lastEdge = 'review', collapsed = false;
    let raw = null, config;
    let renderedSheet = '', renderedEditing = false;
    const scrolls = new Map();
    const editor = createBottomEditSession(() => !scope.isDisposed());
    scope.registerCleanup(editor.cancel);
    document.body.append(root);
    scope.registerCleanup(() => root.remove());
    const options = createBottomOptions(scope);
    bindBottomScrollChain(scope, [panel, dock]);
    const closePanel = () => { active = ''; editor.cancel(); };
    const layout = createBottomLayout(scope, root, () => { closePanel(); render(); }, () => render(true));
    const beautify = createBottomContentRenderer(content, { onChange: () => render(true) });
    scope.registerCleanup(() => beautify.dispose());
    function captureScroll() {
        return { top: content.scrollTop, left: content.scrollLeft, cards: new Map([...content.querySelectorAll('[data-row]')].map(node => [node.dataset.row, node.scrollTop])) };
    }
    function render(preserveScroll = false) {
        if (!config) return;
        scrolls.set(`${renderedSheet}:${renderedEditing}`, captureScroll());
        const scroll = preserveScroll || active !== renderedSheet || editor.active !== renderedEditing
            ? scrolls.get(`${active}:${editor.active}`) : null;
        const descending = config.sortDescendingBySheet[active] === true;
        const edge = config.position === 'edge';
        const table = active && active !== 'review' ? buildTableContent(raw, active, descending, editor) : null;
        if (active && active !== 'review' && !table) closePanel();
        const beautified = beautify.update(editor.active ? '' : active, raw);
        if (lastEdge !== 'review' && !raw?.[lastEdge]) lastEdge = 'review';
        nav.hidden = edge ? !active : collapsed;
        bar.hidden = edge || !collapsed;
        launch.hidden = !edge || !!active;
        const railTop = preserveScroll ? nav.querySelector('.yuzi-bottom-tabs')?.scrollTop || 0 : 0;
        nav.innerHTML = `<div class="yuzi-bottom-tabs">${buildNavigation(raw, active)}</div><div class="yuzi-bottom-controls">${controls()}</div>`;
        nav.querySelectorAll('[data-sheet]').forEach(button => { button.disabled = editor.saving; });
        nav.querySelector('.yuzi-bottom-tabs').scrollTop = railTop;
        panel.hidden = !active;
        const area = layout.region();
        content.dataset.review = String(active === 'review');
        content.dataset.editing = String(editor.active);
        panel.setAttribute('aria-busy', String(editor.saving));
        const resize = ['edge', 'side'].includes(area) ? '' : iconButton('resize', t('长按调整高度'), 'M8 9h8M8 15h8');
        const editButtons = editor.active
            ? `<div class="yuzi-bottom-edit-actions">${iconButton('save', editor.saving ? t('保存中...') : t('保存所有修改'), 'm5 12 4 4L19 6', editor.saving)}${iconButton('cancel-edit', t('退出编辑'), 'm6 6 12 12M6 18 18 6')}</div>`
            : table ? iconButton('edit', t('进入编辑'), 'm16 3 5 5-12 12-6 1 1-6L16 3M14 5l5 5') : '';
        panel.querySelector('header').innerHTML = `<div><strong>${html(table?.title || t('审核'))}</strong>${table ? `<small>${t`共 ${table.count} 项`}${editor.active ? ` · ${t('编辑中')}` : ''}</small>` : ''}</div><div class="yuzi-bottom-controls">${table && !beautified ? iconButton('sort', descending ? t('倒序') : t('正序'), 'M7 20V4m-4 4 4-4 4 4M17 4v16m-4-4 4 4 4-4', editor.saving) : ''}${editButtons}${resize}${iconButton('close', t('关闭'), 'm6 6 12 12M6 18 18 6')}</div>`;
        if (!beautified) content.innerHTML = table ? table.html : active === 'review' ? `<div class="yuzi-bottom-review tur-page tur-content">${buildTableUpdateReviewContentHtml(getReviewState(), { readOnly: true })}</div>` : '';
        layout.update(config);
        content.querySelectorAll('textarea[data-input-col]').forEach(resizeDetailTextarea);
        content.scrollTop = scroll?.top || 0; content.scrollLeft = scroll?.left || 0;
        if (scroll) content.querySelectorAll('[data-row]').forEach(node => { node.scrollTop = scroll.cards.get(node.dataset.row) || 0; });
        renderedSheet = active; renderedEditing = editor.active;
    }
    function refresh() {
        const settings = getPhoneSettings();
        if (config && config.position !== settings.bottomVisualization.position) { closePanel(); collapsed = false; }
        config = settings.bottomVisualization;
        raw = getTableData();
        const interrupted = editor.sync(raw);
        applyPhoneThemeMode(settings.phoneThemeMode);
        applyAppearanceFontLibrary();
        for (const surface of [root, dock]) {
            surface.style.fontFamily = getAppearanceFontFamily();
            surface.style.fontSize = `${13 * settings.phoneReadableTextScalePercent / 100}px`;
            surface.style.setProperty('--yuzi-phone-readable-text-scale', settings.phoneReadableTextScalePercent / 100);
            surface.style.setProperty('--yuzi-phone-bottom-opacity', config.opacity / 100);
            surface.lang = settings.phoneLanguage;
        }
        launch.setAttribute('aria-label', t('展开'));
        root.style.setProperty('--yuzi-phone-bottom-card-width', `${config.cardWidth}px`);
        const background = value => typeof value === 'string' && /^data:image\//i.test(value) ? 'url(' + JSON.stringify(value) + ')' : '';
        const panelBackground = background(settings.bottomVisualizationPanelImage);
        root.dataset.edgeBackground = config.position === 'edge' && panelBackground ? 'true' : 'false';
        edgeBackground.style.backgroundImage = config.position === 'edge' ? panelBackground : '';
        nav.style.backgroundImage = config.position === 'edge' ? '' : background(settings.bottomVisualizationNavImage);
        bar.style.backgroundImage = background(settings.bottomVisualizationNavImage);
        panel.style.backgroundImage = config.position === 'edge' ? '' : panelBackground;
        layout.update(config);
        render(true);
        options.update(raw, settings);
        if (interrupted && active) showInlineToast(panel, t('表格已更新，已退出编辑'), true);
    }
    const handleClick = async event => {
        const button = event.target.closest('button');
        if (!button || !event.currentTarget.contains(button)) return;
        if (content.contains(button)) return;
        if (button.dataset.action === 'resize') return;
        if (button.dataset.action === 'settings') { openBottomSettings(scope); return; }
        if (button.disabled) return;
        if (button.dataset.sheet) {
            if (editor.saving) return;
            active = active === button.dataset.sheet ? '' : button.dataset.sheet;
            if (!active) editor.cancel();
            if (active && config.position === 'edge') lastEdge = active;
        }
        if (button.dataset.action === 'edit') editor.begin(raw);
        if (button.dataset.action === 'cancel-edit') { editor.cancel(); raw = getTableData(); }
        if (button.dataset.action === 'save') {
            const promise = editor.save();
            render(true);
            const result = await promise;
            if (scope.isDisposed()) return;
            raw = getTableData();
            render(true);
            if (result.status === 'failed') showInlineToast(panel, t`保存失败：${result.message}（已保存 ${result.saved} 行，其余修改保留）`, true);
            if (result.status === 'updated') showInlineToast(panel, t('表格已更新，已退出编辑'), true);
            if (result.status === 'saved' && result.saved) showInlineToast(panel, t('保存成功'));
            return;
        }
        if (button.dataset.action === 'sort') {
            savePhoneSetting('bottomVisualization', { ...config, sortDescendingBySheet: { ...config.sortDescendingBySheet, [active]: !config.sortDescendingBySheet[active] } });
            return;
        }
        if (button.dataset.action === 'close') closePanel();
        if (button.dataset.action === 'collapse') { closePanel(); collapsed = true; }
        if (button.dataset.action === 'expand') collapsed = false;
        if (button.dataset.action === 'launch') active = lastEdge;
        render();
    };
    for (const surface of [panel, dock, launch]) scope.addEventListener(surface, 'click', handleClick);
    scope.addEventListener(content, 'input', event => {
        const input = event.target;
        if (!(input instanceof HTMLTextAreaElement) || !input.matches('[data-input-col]')) return;
        const card = input.closest('.yuzi-bottom-edit-card');
        if (!card || !content.contains(card)) return;
        editor.change(card.dataset.sheet, Number(card.dataset.rowIndex), Number(input.dataset.inputCol), input.value);
        resizeDetailTextarea(input);
    });
    function connect(attempt = 0) {
        if (scope.isDisposed()) return;
        const unsubscribe = subscribeTableUpdate(refresh);
        if (unsubscribe) { scope.registerCleanup(unsubscribe); if (attempt) refresh(); }
        else if (attempt < 20) scope.setTimeout(() => connect(attempt + 1), 500);
    }
    connect();
    scope.registerCleanup(subscribeReviewState(() => { if (active === 'review') render(true); }));
    refresh();
    return { refresh, dispose: () => scope.dispose() };
}

