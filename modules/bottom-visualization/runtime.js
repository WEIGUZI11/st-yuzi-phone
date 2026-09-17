import { t } from '../i18n/index.js';
import { getPhoneSettings } from '../settings.js';
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
    let active = '', lastEdge = 'review', descending = false, collapsed = false;
    let raw = null, config;
    document.body.append(root);
    scope.registerCleanup(() => root.remove());
    const options = createBottomOptions(scope);
    bindBottomScrollChain(scope, [panel, dock]);
    const layout = createBottomLayout(scope, root, () => { active = ''; descending = false; render(); }, () => render(true));
    function render(preserveScroll = false) {
        if (!config) return;
        const scroll = preserveScroll ? { top: content.scrollTop, left: content.scrollLeft, cards: new Map([...content.querySelectorAll('[data-row]')].map(node => [node.dataset.row, node.scrollTop])) } : null;
        const edge = config.position === 'edge';
        const table = active && active !== 'review' ? buildTableContent(raw, active, descending) : null;
        if (active && active !== 'review' && !table) active = '';
        if (lastEdge !== 'review' && !raw?.[lastEdge]) lastEdge = 'review';
        nav.hidden = edge ? !active : collapsed;
        bar.hidden = edge || !collapsed;
        launch.hidden = !edge || !!active;
        const railTop = preserveScroll ? nav.querySelector('.yuzi-bottom-tabs')?.scrollTop || 0 : 0;
        nav.innerHTML = `<div class="yuzi-bottom-tabs">${buildNavigation(raw, active)}</div><div class="yuzi-bottom-controls">${controls()}</div>`;
        nav.querySelector('.yuzi-bottom-tabs').scrollTop = railTop;
        panel.hidden = !active;
        const area = layout.region();
        content.dataset.review = String(active === 'review');
        const resize = ['edge', 'side'].includes(area) ? '' : iconButton('resize', t('长按调整高度'), 'M8 9h8M8 15h8');
        panel.querySelector('header').innerHTML = `<div><strong>${html(table?.title || t('审核'))}</strong>${table ? `<small>${t`共 ${table.count} 项`}</small>` : ''}</div><div class="yuzi-bottom-controls">${table ? iconButton('sort', descending ? t('倒序') : t('正序'), 'M7 20V4m-4 4 4-4 4 4M17 4v16m-4-4 4 4 4-4') : ''}${resize}${iconButton('close', t('关闭'), 'm6 6 12 12M6 18 18 6')}</div>`;
        content.innerHTML = table ? table.html : active === 'review' ? `<div class="yuzi-bottom-review tur-page tur-content">${buildTableUpdateReviewContentHtml(getReviewState(), { readOnly: true })}</div>` : '';
        layout.update(config);
        content.scrollTop = scroll?.top || 0; content.scrollLeft = scroll?.left || 0;
        if (scroll) content.querySelectorAll('[data-row]').forEach(node => { node.scrollTop = scroll.cards.get(node.dataset.row) || 0; });
    }
    function refresh() {
        const settings = getPhoneSettings();
        if (config && config.position !== settings.bottomVisualization.position) { active = ''; descending = false; collapsed = false; }
        config = settings.bottomVisualization;
        raw = getTableData();
        applyPhoneThemeMode(settings.phoneThemeMode);
        applyAppearanceFontLibrary();
        for (const surface of [root, dock]) {
            surface.style.fontFamily = getAppearanceFontFamily();
            surface.style.fontSize = `${13 * settings.phoneReadableTextScalePercent / 100}px`;
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
    }
    const handleClick = event => {
        const button = event.target.closest('button');
        if (!button || !event.currentTarget.contains(button)) return;
        if (button.dataset.action === 'resize') return;
        if (button.dataset.action === 'settings') { openBottomSettings(scope); return; }
        if (button.dataset.sheet) { active = active === button.dataset.sheet ? '' : button.dataset.sheet; descending = false; if (active && config.position === 'edge') lastEdge = active; }
        if (button.dataset.action === 'sort') descending = !descending;
        if (button.dataset.action === 'close') { active = ''; descending = false; }
        if (button.dataset.action === 'collapse') { active = ''; descending = false; collapsed = true; }
        if (button.dataset.action === 'expand') collapsed = false;
        if (button.dataset.action === 'launch') { active = lastEdge; descending = false; }
        render();
    };
    for (const surface of [panel, dock, launch]) scope.addEventListener(surface, 'click', handleClick);
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

