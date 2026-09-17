import { normalizeBubbleStyle } from '../resources/appearance-contract.js';

export function decorateQQAvatar(element, url) {
    if (!url || element.classList.contains('yuzi-qq-group-avatar') || element.classList.contains('yuzi-qq-group-avatar-member')) return;
    element.style.setProperty('--yuzi-qq-avatar-frame-image', 'url(' + JSON.stringify(url) + ')');
    element.setAttribute('data-qq-avatar-frame', '');
}
export function decorateQQBubble(element, url, parameters) {
    if (!url) return;
    const style = normalizeBubbleStyle(parameters) || {};
    element.setAttribute('data-qq-bubble', '');
    element.style.backgroundColor = 'transparent';
    element.style.padding = (style.padding ?? 12) + 'px';
    if (style.textColor) element.style.color = style.textColor;
    if (style.radius !== undefined) element.style.borderRadius = style.radius + 'px';
    if (style.slice > 0) {
        element.style.borderStyle = 'solid';
        element.style.borderWidth = Math.min(style.slice, 24) + 'px';
        element.style.borderImageSource = 'url(' + JSON.stringify(url) + ')';
        element.style.borderImageSlice = style.slice + ' fill';
        element.style.borderImageRepeat = 'stretch';
    } else {
        element.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
        element.style.backgroundSize = '100% 100%';
        element.style.backgroundRepeat = 'no-repeat';
    }
}
