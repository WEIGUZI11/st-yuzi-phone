import { savePhoneSetting, getPhoneSettings } from '../settings.js';

// 导航与覆盖面板分开：flow 导航留在文档流，面板永远不参与聊天高度。
export function createBottomLayout(scope, root, close, refreshRegion) {
    const panel = root.querySelector('.yuzi-bottom-panel');
    const dock = root.querySelector('.yuzi-bottom-dock');
    const nav = dock.querySelector('.yuzi-bottom-nav');
    const content = panel.querySelector('.yuzi-bottom-content');
    const anchor = document.createElement('div');
    anchor.className = 'yuzi-bottom-anchor';
    scope.registerCleanup(() => { dock.remove(); anchor.remove(); });
    let config, pending = false, flow = null, releaseScroll = null, observedMessage = null;
    const set = (node, property, value) => { if (node.style[property] !== value) node.style[property] = value; };
    const data = (node, key, value) => { if (node.dataset[key] !== value) node.dataset[key] = value; };
    const box = (node, x, y, w, h) => {
        set(node, 'left', `${x}px`); set(node, 'top', `${y}px`);
        set(node, 'width', `${Math.max(0, w)}px`); set(node, 'height', `${Math.max(0, h)}px`);
    };
    function region() {
        if (config.position === 'edge') return 'edge';
        if (innerWidth < 768) return 'chat';
        const rect = document.querySelector('#sheld')?.getBoundingClientRect();
        if (config.region === 'side' && (!rect || (config.side === 'left' ? rect.left : innerWidth - rect.right) < 220)) return 'chat';
        return config.region;
    }
    // 滚动热路径只读 scrollTop，写合成位移/裁切；不量尺寸、不改正文、不重建 DOM。
    function followScroll() {
        if (!flow) return;
        const delta = flow.chat.scrollTop - flow.scrollTop;
        const y = flow.y - delta;
        set(panel, 'transform', `translateY(${-delta}px)`);
        set(panel, 'clipPath', `inset(${Math.max(0, flow.min - y)}px 0 ${Math.max(0, y + flow.height - flow.max)}px 0)`);
    }
    function measure() {
        pending = false;
        if (!config || scope.isDisposed()) return;
        const chat = document.querySelector('#chat');
        if (!chat) { root.hidden = true; dock.hidden = true; return; }
        root.hidden = false; dock.hidden = config.position === 'edge' && nav.hidden;
        if (anchor.parentElement !== chat || chat.lastElementChild !== anchor) chat.append(anchor);
        const isFlow = config.position === 'flow';
        const parent = isFlow ? anchor : root;
        if (dock.parentElement !== parent) parent.append(dock);
        for (const surface of [root, dock]) {
            data(surface, 'position', config.position);
            data(surface, 'side', config.position === 'edge' ? config.edgeSide : config.side);
            data(surface, 'desktopNav', config.desktopNav);
        }
        if (isFlow) {
            set(dock, 'left', ''); set(dock, 'top', ''); set(dock, 'bottom', '');
            set(dock, 'width', ''); set(dock, 'height', ''); set(anchor, 'height', 'auto');
        }
        const view = window.visualViewport;
        const top = Math.max(view?.offsetTop || 0, document.querySelector('#top-bar')?.getBoundingClientRect().bottom || 0);
        const bottom = (view?.offsetTop || 0) + (view?.height || innerHeight);
        const width = document.documentElement.clientWidth || innerWidth;
        const rect = (document.querySelector('#sheld') || chat).getBoundingClientRect();
        const chatRect = chat.getBoundingClientRect();
        const area = region();
        const regionChanged = panel.dataset.region && panel.dataset.region !== area;
        data(panel, 'region', area);
        panel.querySelector('[data-action="resize"]')?.toggleAttribute('hidden', area === 'side' || area === 'edge');
        const horizontal = content.dataset.review !== 'true' && config.layout === 'horizontal';
        content.classList.toggle('is-horizontal', horizontal);
        content.classList.toggle('is-vertical', !horizontal);
        releaseScroll?.(); releaseScroll = null; flow = null;
        set(panel, 'transform', ''); set(panel, 'clipPath', '');
        if (config.position === 'edge') {
            set(anchor, 'height', '0px');
            const rail = Math.min(112, Math.max(72, width * .12));
            const left = config.edgeSide === 'left', h = Math.max(0, bottom - top - 8);
            set(dock, 'bottom', 'auto');
            box(dock, left ? 0 : width - rail, top, rail, h);
            box(panel, left ? rail : 8, top, width - rail - 8, h);
            const count = nav.querySelectorAll('[data-sheet]').length;
            data(dock, 'density', count * 34 > h - 82 ? (count * 28 > h - 82 ? 'tiny' : 'compact') : 'normal');
        } else {
            const composerTop = document.querySelector('#form_sheld')?.getBoundingClientRect().top || chatRect.bottom;
            const base = Math.min(bottom, composerTop, chatRect.bottom);
            if (!isFlow) {
                set(dock, 'left', `${rect.left}px`); set(dock, 'width', `${rect.width}px`);
                set(dock, 'top', 'auto'); set(dock, 'bottom', `${innerHeight - base + 4}px`); set(dock, 'height', 'auto');
            }
            const dockRect = dock.getBoundingClientRect();
            // 固定导航只给自身留空间；面板开关和调高不改变它。
            if (!isFlow) set(anchor, 'height', `${dockRect.height + 8}px`);
            if (area === 'side') {
                const left = config.side === 'left';
                box(panel, left ? 0 : rect.right, top, left ? rect.left : width - rect.right, bottom - top - 8);
            } else if (!panel.hidden) {
                const min = Math.max(top, chatRect.top);
                const requested = innerHeight * config.height / 100;
                const above = Math.max(0, dockRect.top - min - 8), below = Math.max(0, base - dockRect.bottom - 8);
                // 短正文上方没有空间时向下覆盖，不能压住导航或把标题/关闭按钮裁掉。
                const downward = isFlow && above < Math.min(requested, 160) && below > above;
                const height = Math.min(requested, downward ? below : above);
                const y = downward ? dockRect.bottom + 8 : Math.max(min, dockRect.top - height - 8);
                box(panel, area === 'viewport' ? 0 : rect.left, y, area === 'viewport' ? width : rect.width, height);
                if (isFlow) {
                    flow = { chat, scrollTop: chat.scrollTop, y, height, min, max: base };
                    releaseScroll = scope.addEventListener(chat, 'scroll', followScroll, { passive: true });
                    followScroll();
                }
            }
        }
        // 流式回复增高最后一条消息也会移动导航；不观察整个消息树的每次文本变更。
        const message = anchor.previousElementSibling;
        if (message !== observedMessage) {
            if (observedMessage) resize.unobserve(observedMessage);
            observedMessage = message;
            if (message) resize.observe(message);
        }
        if (regionChanged) refreshRegion();
    }
    function schedule() { if (!pending) { pending = true; scope.requestAnimationFrame(measure); } }
    scope.addEventListener(window, 'resize', schedule);
    if (window.visualViewport) {
        scope.addEventListener(window.visualViewport, 'resize', schedule);
        scope.addEventListener(window.visualViewport, 'scroll', schedule);
    }
    const resize = new ResizeObserver(schedule);
    for (const node of [dock, document.querySelector('#sheld'), document.querySelector('#chat'), document.querySelector('#form_sheld')]) if (node) resize.observe(node);
    scope.registerCleanup(() => { releaseScroll?.(); resize.disconnect(); });
    const observer = new MutationObserver(schedule);
    for (const node of document.querySelectorAll('#chat, #sheld')) observer.observe(node, { childList: true });
    const sheld = document.querySelector('#sheld');
    if (sheld) observer.observe(sheld, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
    scope.registerCleanup(() => observer.disconnect());
    const drawers = new MutationObserver(records => {
        if (records.some(record => record.target.classList.contains('openDrawer'))) close();
    });
    for (const node of document.querySelectorAll('.drawer-content, #left-nav-panel, #right-nav-panel')) drawers.observe(node, { attributes: true, attributeFilter: ['class'] });
    scope.registerCleanup(() => drawers.disconnect());
    let hold = null, drag = null;
    scope.addEventListener(panel, 'pointerdown', event => {
        const handle = event.target.closest('[data-action="resize"]');
        if (!handle || handle.hidden || event.button !== 0) return;
        const y = event.clientY, height = config.height;
        handle.setPointerCapture(event.pointerId);
        hold = scope.setTimeout(() => { drag = { y, height }; root.classList.add('is-resizing'); }, 350);
    });
    scope.addEventListener(panel, 'pointermove', event => {
        if (!drag) return;
        config = { ...config, height: Math.max(25, Math.min(85, Math.round(drag.height + (drag.y - event.clientY) / innerHeight * 100))) };
        measure();
    });
    const release = () => {
        scope.clearTimeout(hold); hold = null;
        if (drag) { drag = null; savePhoneSetting('bottomVisualization', { ...getPhoneSettings().bottomVisualization, height: config.height }); }
        root.classList.remove('is-resizing');
    };
    scope.addEventListener(panel, 'pointerup', release);
    scope.addEventListener(panel, 'pointercancel', release);
    scope.addEventListener(panel, 'keydown', event => {
        if (!event.target.matches('[data-action="resize"]') || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        savePhoneSetting('bottomVisualization', { ...config, height: config.height + (event.key === 'ArrowUp' ? 5 : -5) });
    });
    return { update(value) { config = value; measure(); }, region };
}
