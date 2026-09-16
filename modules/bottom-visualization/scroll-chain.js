// 覆盖面板不在 #chat 内：只在普通底部区域滚动耗尽后，平滑接续正文。
export function bindBottomScrollChain(scope, surfaces) {
    let chat = null, target = null, direction = 0, releases = [];
    const stop = () => {
        if (target !== null) chat.scrollTo({ top: chat.scrollTop, behavior: 'instant' });
        target = null;
        direction = 0;
    };
    const connect = node => {
        if (chat === node) return;
        stop();
        releases.forEach(release => release());
        chat = node;
        releases = ['wheel', 'pointerdown', 'keydown'].map(type => scope.addEventListener(chat, type, event => {
            // flow 导航在 #chat 内，自己的滚轮不能被当成正文操作打断。
            if (!surfaces.some(surface => surface.contains(event.target))) stop();
        }, { passive: true }));
        releases.push(scope.addEventListener(chat, 'scrollend', () => {
            if (target !== null && Math.abs(chat.scrollTop - target) <= 1) { target = null; direction = 0; }
        }));
    };
    scope.registerCleanup(stop);
    const canScroll = (node, delta) => {
        const max = node.scrollHeight - node.clientHeight;
        return max > 1 && (delta < 0 ? node.scrollTop > 1 : node.scrollTop < max - 1);
    };
    const wheel = event => {
        if (!event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        const surface = event.currentTarget;
        let node = event.target instanceof Element ? event.target : surface;
        // 内部仍能滚就保留浏览器原生滚动，并停止上一次正文接续。
        while (node && surface.contains(node)) {
            if (canScroll(node, event.deltaY) && /^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) { stop(); return; }
            if (node === surface) break;
            node = node.parentElement;
        }
        // 使用布局已经确定的实际区域；窄屏回退到聊天区时仍可正常接续。
        if (['side', 'edge'].includes(surface.dataset.region) || surface.dataset.position === 'edge') {
            stop();
            event.preventDefault();
            return;
        }
        const currentChat = document.querySelector('#chat');
        if (!currentChat) return;
        connect(currentChat);
        event.preventDefault();
        if (!canScroll(chat, event.deltaY)) { stop(); return; }
        const nextDirection = Math.sign(event.deltaY);
        if (direction !== nextDirection) stop();
        const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(chat).lineHeight) || 16
            : event.deltaMode === 2 ? chat.clientHeight : 1;
        // 同向累计目标；反向从当前位置起步。动画交给浏览器，不自建逐帧循环。
        target = Math.max(0, Math.min(chat.scrollHeight - chat.clientHeight, (target ?? chat.scrollTop) + event.deltaY * unit));
        direction = nextDirection;
        chat.scrollTo({ top: target, behavior: 'smooth' });
    };
    for (const surface of surfaces) scope.addEventListener(surface, 'wheel', wheel, { passive: false });
}
