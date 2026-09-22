function getChatSurfaceApi(windowRef = globalThis.window) {
    return windowRef?.__TAURITAVERN__?.api?.chatSurface;
}

/**
 * TauriTavern 虚拟聊天模式下，#chat 的子节点由宿主虚拟列表管理。
 * 这里仅做能力探测，不依赖 TauriTavern 的导入，避免影响普通 SillyTavern。
 */
export function isManagedTauriTavernChatSurface(windowRef = globalThis.window) {
    const api = getChatSurfaceApi(windowRef);
    if (typeof api?.isManagedOwnershipRequired !== 'function') return false;
    try {
        return api.isManagedOwnershipRequired() === true;
    } catch {
        return false;
    }
}
