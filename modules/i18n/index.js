import english from './en.js';

let language = 'zh-CN';

// 由设置边界同步，只保留运行时语言快照；不拥有存储或宿主监听。
export function applyPhoneLanguage(value) {
    language = value === 'en' ? 'en' : 'zh-CN';
    if (typeof document !== 'undefined') {
        for (const id of ['yuzi-phone-standalone', 'yuzi-phone-settings']) {
            const root = document.getElementById(id);
            if (root && root.getAttribute('lang') !== language) root.setAttribute('lang', language);
        }
    }
}

export function getPhoneLanguage() {
    return language;
}

/** 只在明确的系统文案调用点使用。支持模板插值，不遍历 DOM 或翻译插值内容。 */
export function t(source, ...values) {
    const tagged = Array.isArray(source);
    const key = tagged ? source.reduce((text, part, index) => text + (index ? '{' + (index - 1) + '}' : '') + part, '') : String(source ?? '');
    const template = language === 'en' && Object.hasOwn(english, key) ? english[key] : key;
    return tagged ? template.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match) : template;
}

export function formatPhoneDateTime(value, options = {}) {
    return new Date(value).toLocaleString(language === 'en' ? 'en-GB' : 'zh-CN', { hour12: false, ...options });
}
