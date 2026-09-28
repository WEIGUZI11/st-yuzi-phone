export const QQ_MESSAGE_TEXT_COLORS = Object.freeze({
    white: 'white',
    black: 'black',
});

export function normalizeMessageTextColor(value, fallback = QQ_MESSAGE_TEXT_COLORS.black) {
    return value === QQ_MESSAGE_TEXT_COLORS.white || value === QQ_MESSAGE_TEXT_COLORS.black
        ? value
        : fallback;
}

export function messageTextColorCssValue(value) {
    return normalizeMessageTextColor(value) === QQ_MESSAGE_TEXT_COLORS.white ? '#fff' : '#000';
}
