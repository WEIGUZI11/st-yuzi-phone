import { showSettingsOptionSheet } from './settings-layer.js';

// 设置分组列表控件桥：界面只换外观，数据仍走原生 select / input 及其既有监听。
// - 选择行  [data-settings-select="<select id>"]  → 底部单选面板，选中后写回 select 并派发 change
// - 分段控件 .phone-ios-seg[data-settings-seg="<select id>"] → 写回 select 并派发 change
// - 步进器  .phone-ios-stepper[data-settings-stepper="<input id>"] → 写回 input 并派发 input + change
// 规范见 docs/phone-ui-variables.md「设置分组列表」。

function findById(container, id) {
    if (!id) return null;
    return container.querySelector(`#${CSS.escape(id)}`);
}

function dispatch(target, ...types) {
    types.forEach(type => target.dispatchEvent(new Event(type, { bubbles: true })));
}

function readOption(option) {
    return {
        value: option.value,
        label: option.dataset.label || option.textContent.trim(),
        sub: option.dataset.sub || '',
        badge: option.dataset.badge || '',
        selected: option.selected,
    };
}

function collectOptionGroups(selectEl) {
    const groups = [];
    let loose = null;
    [...selectEl.children].forEach((child) => {
        if (child.tagName === 'OPTGROUP') {
            groups.push({ header: child.label, options: [...child.children].map(readOption) });
            return;
        }
        if (child.tagName !== 'OPTION') return;
        if (!loose) {
            loose = { header: '', options: [] };
            groups.push(loose);
        }
        loose.options.push(readOption(child));
    });
    return groups;
}

function syncSelectRow(row, selectEl) {
    const valueEl = row.querySelector('.phone-ios-row-value-text');
    const current = selectEl.selectedOptions?.[0];
    if (valueEl && current) valueEl.textContent = current.dataset.short || current.textContent.trim();
}

function syncSegment(seg, selectEl) {
    seg.querySelectorAll('[data-value]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.value === selectEl.value));
    });
}

function formatStepperValue(value, unit) {
    const rounded = Math.round(Number(value) * 1000) / 1000;
    return `${Number.isFinite(rounded) ? rounded : ''}${unit || ''}`;
}

function syncStepper(stepper, inputEl) {
    const output = stepper.querySelector('.phone-ios-stepper-value');
    if (output) output.textContent = formatStepperValue(inputEl.value, stepper.dataset.unit);
    const value = Number(inputEl.value);
    const [minus, plus] = stepper.querySelectorAll('.phone-ios-stepper-btn');
    if (minus) minus.disabled = value <= Number(inputEl.min);
    if (plus) plus.disabled = value >= Number(inputEl.max);
}

/**
 * 在容器上用事件委托绑定分组列表控件；动态渲染的行同样生效。
 * @returns {Function} cleanup
 */
export function bindSettingsGroupedControls(container, runtime = null) {
    if (!container || typeof container.addEventListener !== 'function') return () => {};

    container.querySelectorAll('.phone-ios-seg[data-settings-seg]').forEach((seg) => {
        const selectEl = findById(container, seg.dataset.settingsSeg);
        if (selectEl) syncSegment(seg, selectEl);
    });
    container.querySelectorAll('.phone-ios-stepper[data-settings-stepper]').forEach((stepper) => {
        const inputEl = findById(container, stepper.dataset.settingsStepper);
        if (inputEl) syncStepper(stepper, inputEl);
    });

    const onClick = (event) => {
        const selectRow = event.target?.closest?.('[data-settings-select]');
        if (selectRow && container.contains(selectRow)) {
            const selectEl = findById(container, selectRow.dataset.settingsSelect);
            if (!selectEl || selectEl.disabled) return;
            showSettingsOptionSheet({
                title: selectRow.dataset.sheetTitle || selectRow.querySelector('.phone-ios-row-label')?.textContent?.trim() || '',
                subtitle: selectRow.dataset.sheetSubtitle || '',
                footer: selectRow.dataset.sheetFooter || '',
                groups: collectOptionGroups(selectEl),
                runtime,
                onSelect: (value) => {
                    selectEl.value = value;
                    syncSelectRow(selectRow, selectEl);
                    dispatch(selectEl, 'change');
                },
            });
            return;
        }

        const segButton = event.target?.closest?.('.phone-ios-seg[data-settings-seg] [data-value]');
        if (segButton && container.contains(segButton)) {
            const seg = segButton.closest('.phone-ios-seg');
            const selectEl = findById(container, seg.dataset.settingsSeg);
            if (!selectEl || selectEl.value === segButton.dataset.value) return;
            selectEl.value = segButton.dataset.value;
            syncSegment(seg, selectEl);
            dispatch(selectEl, 'change');
            return;
        }

        const stepButton = event.target?.closest?.('.phone-ios-stepper[data-settings-stepper] .phone-ios-stepper-btn');
        if (stepButton && container.contains(stepButton) && !stepButton.disabled) {
            const stepper = stepButton.closest('.phone-ios-stepper');
            const inputEl = findById(container, stepper.dataset.settingsStepper);
            if (!inputEl) return;
            const step = Number(stepper.dataset.step) || 1;
            const direction = Number(stepButton.dataset.direction) || 0;
            const next = Math.min(Number(inputEl.max), Math.max(Number(inputEl.min), (Number(inputEl.value) || 0) + direction * step));
            inputEl.value = String(Math.round(next * 1000) / 1000);
            syncStepper(stepper, inputEl);
            dispatch(inputEl, 'input', 'change');
        }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
}
