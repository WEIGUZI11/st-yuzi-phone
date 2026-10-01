import { t } from '../i18n/index.js';
import { escapeHtml, escapeHtmlAttr } from '../utils/dom-escape.js';

export function buildDetailEditControlHtml(pair) {
    const fieldMetadata = pair.fieldMetadata;
    const label = escapeHtmlAttr(pair.key);
    if (fieldMetadata?.type === 'enum' && Array.isArray(fieldMetadata.options) && fieldMetadata.options.length > 0) {
        const value = String(pair.value ?? '');
        const hasCurrentOption = value === '' || fieldMetadata.options.includes(value);
        return `
            <select class="phone-row-detail-input" aria-label="${label}" data-input-col="${escapeHtmlAttr(String(pair.rawColIndex))}" data-input-control="select" ${pair.isLocked ? 'disabled' : ''}>
                <option value="">${t`请选择${escapeHtml(pair.key)}`}</option>
                ${!hasCurrentOption ? `<option value="${escapeHtmlAttr(value)}" selected>${escapeHtml(t`${value}（不在可选项中）`)}</option>` : ''}
                ${fieldMetadata.options.map((option) => `<option value="${escapeHtmlAttr(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
            </select>
        `;
    }

    return `<textarea class="phone-row-detail-input" aria-label="${label}" data-input-col="${escapeHtmlAttr(String(pair.rawColIndex))}" data-input-control="textarea" ${pair.isLocked ? 'disabled' : ''}>${escapeHtml(pair.value)}</textarea>`;
}

export function resizeDetailTextarea(inputEl) {
    if (!(inputEl instanceof HTMLTextAreaElement)) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.max(inputEl.scrollHeight, 32) + 'px';
}
