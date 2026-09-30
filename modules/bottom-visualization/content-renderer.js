import { getContentPresetIndexSnapshot, subscribeContentPresetIndex } from '../content-presets/index-state.js';
import { tryRenderContentPreset } from '../content-presets/renderer.js';
import { resolveTableNavigationTarget } from '../table-navigation/catalog.js';
import { mountBottomTheater } from '../phone-theater/bottom-renderer.js';

/**
 * Owns one open bottom content surface. A saved selection is read only on open;
 * package replacement/deletion is the sole index mutation that retires a live page.
 */
export function createBottomContentRenderer(container, options = {}) {
    let openedSheet = '', binding = null, rawData = null;
    let instance = null, theater = null, epoch = 0;
    let custom = false, waitingForIndex = false, disposed = false;
    const setCustom = value => { custom = value; container.dataset.beautified = String(value); };
    const release = () => {
        ++epoch;
        instance?.dispose(); instance = null;
        theater?.dispose(); theater = null;
        container.replaceChildren();
        setCustom(false);
    };
    const fallback = () => {
        binding = null;
        release();
        options.onChange?.();
    };
    const update = (sheetKey, raw) => {
        if (disposed) return false;
        rawData = raw;
        const key = sheetKey === 'review' ? '' : String(sheetKey || '');
        if (key === openedSheet) {
            if (theater) {
                if (resolveTableNavigationTarget(raw, key)?.sceneId !== binding.sceneId) fallback();
                else { try { theater.update(raw); } catch { fallback(); } }
            }
            return custom;
        }
        release();
        openedSheet = key; binding = null; waitingForIndex = false;
        if (!key) return false;
        const index = getContentPresetIndexSnapshot();
        waitingForIndex = index.status === 'loading';
        binding = index.status === 'ready' ? index.bottomByTable.get(key) : null;
        if (!binding) return false;
        const request = epoch;
        const isCurrent = () => !disposed && request === epoch && container.isConnected;
        setCustom(true);
        if (binding.kind === 'builtin') {
            if (resolveTableNavigationTarget(raw, key)?.sceneId !== binding.sceneId) { fallback(); return false; }
            try { theater = mountBottomTheater(container, key, binding.sceneId, raw, { isCurrent }); }
            catch { fallback(); }
        } else {
            void tryRenderContentPreset(container, { sheetKey: key, route: `table:${key}` }, {
                surface: 'bottom', binding, initialTableData: raw, isCurrent,
                importModule: options.importModule,
                onInstance: value => { instance = value; },
                originalRenderer: () => { if (isCurrent()) fallback(); },
            }).then(handled => { if (!handled && isCurrent()) fallback(); })
                .catch(() => { if (isCurrent()) fallback(); });
        }
        return custom;
    };
    const unsubscribe = subscribeContentPresetIndex(index => {
        if (disposed || !openedSheet) return;
        if (binding?.presetId && index.changedPresetIds.includes(binding.presetId)) { fallback(); return; }
        if (waitingForIndex && index.status === 'ready') {
            const key = openedSheet; openedSheet = '';
            update(key, rawData);
            options.onChange?.();
        }
    });
    return {
        update,
        dispose() {
            if (disposed) return;
            disposed = true; unsubscribe(); release();
        },
    };
}
