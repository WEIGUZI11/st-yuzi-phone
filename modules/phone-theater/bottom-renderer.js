import { createRuntimeScope } from '../runtime-manager.js';
import { createContentPresetActions } from '../content-presets/runtime-actions.js';
import { getTheaterSceneDefinition } from './config.js';
import { renderTheaterScene } from './render.js';

/** Reuse native scenes with a bottom-owned lifecycle, never a phone route owner. */
export function mountBottomTheater(container, sheetKey, sceneId, rawData, options) {
    const scene = getTheaterSceneDefinition(sceneId);
    let runtime = null, disposed = false;
    const isCurrent = () => !disposed && options.isCurrent();
    const render = raw => {
        runtime?.dispose();
        runtime = createRuntimeScope('bottom-theater');
        const lifecycle = {
            runtime,
            isActive: isCurrent,
            isDisposed: () => !isCurrent(),
            addEventListener: runtime.addEventListener,
            setTimeout: runtime.setTimeout,
            registerCleanup: runtime.registerCleanup,
        };
        renderTheaterScene(container, sceneId, {
            navigationSheetKey: sheetKey, initialTableData: raw,
            lifecycle, readOnly: true,
            actions: createContentPresetActions({ disabled: true, isCurrent, getRoute: () => `table:${sheetKey}` }),
            isVisible: isCurrent,
            subscribeActivity: () => () => {},
        });
    };
    try { render(rawData); } catch (error) { runtime?.dispose(); container.__yuziBuiltinDispose?.(); throw error; }
    return {
        update(raw) { if (isCurrent() && !scene.mountBuiltin) render(raw); },
        dispose() {
            if (disposed) return;
            disposed = true;
            container.__yuziBuiltinDispose?.();
            runtime?.dispose();
            container.replaceChildren();
        },
    };
}
