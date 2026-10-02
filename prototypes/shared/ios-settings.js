/*
 * 玉子手机 · 设置二级页原型公共脚本（ios-settings.js）
 * 仅用于静态原型，不参与构建。提供 window.YZ：toast / sheet / formSheet / actionSheet / confirm / alert / crop，
 * 以及分段控件、步进器、主题切换、[data-toast] 的自动初始化。用法见 ./README.md。
 */
(() => {
    'use strict';
    const doc = document;
    const root = doc.documentElement;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
    const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    const phone = () => doc.querySelector('.phone') || doc.body;

    // ===== 轻提示：复用 .phone 内已有的 .toast，没有就创建 =====
    let toastTimer = 0;
    const toast = (text) => {
        const host = phone();
        let el = host.querySelector(':scope > .toast');
        if (!el) {
            el = doc.createElement('div');
            el.className = 'toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            host.appendChild(el);
        }
        el.textContent = String(text ?? '');
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
    };

    // ===== 弹层管理：同一时间只开一个；遮罩 / Esc 视为取消；打开期间其余内容 inert；关闭后焦点归还 =====
    let current = null;
    const getScrim = (host) => {
        let scrim = host.querySelector(':scope > .scrim');
        if (!scrim) {
            scrim = doc.createElement('div');
            scrim.className = 'scrim';
            scrim.setAttribute('aria-hidden', 'true');
            host.appendChild(scrim);
        }
        return scrim;
    };
    const closeLayer = (reason = 'close') => {
        const layer = current;
        if (!layer) return;
        current = null;
        layer.el.classList.remove('open');
        layer.scrim.classList.remove('open');
        layer.inerted.forEach((node) => { node.inert = false; });
        setTimeout(() => layer.el.remove(), 320);
        if (layer.opener && layer.opener.isConnected && typeof layer.opener.focus === 'function') {
            layer.opener.focus({ preventScroll: true });
        }
        if (reason === 'dismiss') layer.onDismiss?.();
    };

    // 打开弹层：替换已打开的弹层（不触发 onDismiss），双 rAF 保证过渡动画生效
    const openLayer = (el, { onDismiss, focusSelector } = {}) => {
        if (current) closeLayer('replace');
        const host = phone();
        const scrim = getScrim(host);
        const opener = doc.activeElement;
        host.appendChild(el);
        const inerted = [...host.children].filter((node) => node !== el && node !== scrim
            && !node.classList.contains('toast') && !node.inert);
        inerted.forEach((node) => { node.inert = true; });
        current = { el, scrim, inerted, opener, onDismiss };
        scrim.onclick = () => closeLayer('dismiss');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!el.isConnected) return;
            el.classList.add('open');
            scrim.classList.add('open');
            const target = (focusSelector && el.querySelector(focusSelector))
                || el.querySelector('[aria-selected="true"]')
                || el.querySelector('button:not(:disabled), [tabindex="0"], input, textarea, select');
            target?.focus?.({ preventScroll: true });
        }));
        return current;
    };
    doc.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !current) return;
        event.preventDefault();
        closeLayer('dismiss');
    });

    // 底部面板外壳：抓手条 + 标题（可选副标题）+「完成」+ 可滚动内容
    const sheetShell = ({ title = '', subtitle = '', doneText = '完成' }) => {
        const id = uid('yz-sheet');
        const el = doc.createElement('section');
        el.className = 'sheet';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', id);
        el.innerHTML = `
            <div class="sheet-grabber" aria-hidden="true"></div>
            <header class="sheet-head${subtitle ? ' picker-head' : ''}">
                <div class="picker-titles">
                    <h2 class="sheet-title" id="${id}">${esc(title)}</h2>
                    ${subtitle ? `<p class="picker-sub">${esc(subtitle)}</p>` : ''}
                </div>
                <button type="button" class="sheet-done">${esc(doneText)}</button>
            </header>
            <div class="sheet-body"></div>`;
        return el;
    };


    // ===== 单选面板：分组选项，当前项打勾；点选后约 180ms 收起再回调 =====
    const sheet = ({ title = '', subtitle = '', groups = [], footer = '', onSelect, onDismiss } = {}) => {
        const el = sheetShell({ title, subtitle });
        const body = el.querySelector('.sheet-body');
        const flat = [];
        body.innerHTML = groups.filter((g) => Array.isArray(g?.options) && g.options.length).map((g) => `
            ${g.header ? `<h3 class="group-header">${esc(g.header)}</h3>` : ''}
            <div class="group" role="listbox" aria-label="${esc(g.header || title)}">
                ${g.options.map((o) => {
                    flat.push(o);
                    const i = flat.length - 1;
                    return `<div class="row option${o.thumbHtml ? ' has-thumb' : ''}${o.disabled ? ' disabled-row' : ''}" role="option" tabindex="0" aria-selected="${o.selected ? 'true' : 'false'}" data-index="${i}">
                        ${o.thumbHtml || ''}
                        <span class="row-label">${esc(o.label)}${o.badge ? `<span class="badge">${esc(o.badge)}</span>` : ''}${o.sub ? `<span class="row-sub">${esc(o.sub)}</span>` : ''}</span>
                        <span class="check" aria-hidden="true">✓</span>
                    </div>`;
                }).join('')}
            </div>`).join('') + (footer ? `<p class="group-footer">${esc(footer)}</p>` : '');
        el.querySelector('.sheet-done').onclick = () => closeLayer('dismiss');
        body.addEventListener('click', (event) => {
            const row = event.target.closest('[data-index]');
            if (!row || row.classList.contains('disabled-row')) return;
            const option = flat[Number(row.dataset.index)];
            body.querySelectorAll('[data-index]').forEach((r) => r.setAttribute('aria-selected', String(r === row)));
            setTimeout(() => {
                closeLayer('close');
                if (option && !option.selected) onSelect?.(option.value, option);
            }, 180);
        });
        openLayer(el, { onDismiss });
    };

    // ===== 表单面板：bodyHtml 自定义内容；「完成」调用 onDone(rootEl)，返回 false 则保持打开 =====
    const formSheet = ({ title = '', subtitle = '', bodyHtml = '', doneText = '完成', onMount, onDone, onDismiss } = {}) => {
        const el = sheetShell({ title, subtitle, doneText });
        const body = el.querySelector('.sheet-body');
        body.innerHTML = bodyHtml;
        onMount?.(body);
        el.querySelector('.sheet-done').onclick = () => {
            if (onDone?.(body) === false) return;
            closeLayer('close');
        };
        openLayer(el, { onDismiss, focusSelector: 'input, textarea, select' });
    };

    // ===== 操作菜单：说明 + 一组操作 + 单独「取消」；先收起再执行 onSelect =====
    const actionSheet = ({ title = '', captionHtml = '', actions = [], onDismiss } = {}) => {
        const id = uid('yz-action');
        const items = actions.filter((a) => a && a.label);
        const el = doc.createElement('section');
        el.className = 'action-sheet';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', id);
        el.innerHTML = `
            <div class="action-group">
                <div class="action-caption">${captionHtml}<span id="${id}">${esc(title)}</span></div>
                ${items.map((a, i) => `<button type="button" class="action-btn${a.danger ? ' danger' : ''}" data-index="${i}" ${a.disabled ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}
            </div>
            <div class="action-group"><button type="button" class="action-btn cancel">取消</button></div>`;
        el.addEventListener('click', (event) => {
            if (event.target.closest('.cancel')) { closeLayer('dismiss'); return; }
            const btn = event.target.closest('[data-index]');
            if (!btn || btn.disabled) return;
            closeLayer('close');
            items[Number(btn.dataset.index)]?.onSelect?.();
        });
        openLayer(el, { onDismiss });
    };

    // ===== 居中确认框：默认聚焦「取消」；遮罩 / Esc 视同取消 =====
    const dialogShell = ({ title = '', message = '', buttons = [] }) => {
        const titleId = uid('yz-alert-title');
        const msgId = uid('yz-alert-msg');
        const el = doc.createElement('section');
        el.className = 'alert';
        el.setAttribute('role', 'alertdialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', titleId);
        if (message) el.setAttribute('aria-describedby', msgId);
        el.innerHTML = `
            <div class="alert-text">
                <h2 class="alert-title" id="${titleId}">${esc(title)}</h2>
                ${message ? `<p class="alert-msg" id="${msgId}">${esc(message)}</p>` : ''}
            </div>
            <div class="alert-actions">
                ${buttons.map((b, i) => `<button type="button" class="${b.danger ? 'danger' : ''}" data-index="${i}">${esc(b.label)}</button>`).join('')}
            </div>`;
        el.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-index]');
            if (!btn) return;
            closeLayer('close');
            buttons[Number(btn.dataset.index)]?.onClick?.();
        });
        return el;
    };
    const confirmDialog = ({ title = '确认操作？', message = '', confirmText = '确认', cancelText = '取消', danger = true, onConfirm, onCancel } = {}) => {
        const el = dialogShell({
            title,
            message,
            buttons: [
                { label: cancelText, onClick: onCancel },
                { label: confirmText, danger, onClick: onConfirm },
            ],
        });
        openLayer(el, { onDismiss: onCancel, focusSelector: '[data-index="0"]' });
    };
    const alertDialog = ({ title = '', message = '', confirmText = '知道了', onClose } = {}) => {
        const el = dialogShell({ title, message, buttons: [{ label: confirmText, onClick: onClose }] });
        openLayer(el, { onDismiss: onClose });
    };

    // ===== 裁剪弹窗：居中卡片；8 个手柄缩放、拖动移动、方向键微调（Shift 加速） =====
    const crop = ({ title = '裁剪图片', desc = '拖动裁剪框与边缘圆点，确认后再保存。', aspect = '1 / 1', rect, photo, onConfirm, onCancel } = {}) => {
        const [aw, ah] = String(aspect).split('/').map((n) => Number(String(n).trim()) || 1);
        const longSide = Math.max(aw, ah);
        const natW = Math.round(1440 * aw / longSide);
        const natH = Math.round(1440 * ah / longSide);
        const initial = rect || (aw === ah ? { x: 0.11, y: 0.11, w: 0.78, h: 0.78 } : { x: 0.06, y: 0.08, w: 0.88, h: 0.84 });
        const MIN = 0.15;
        let r = { ...initial };
        const id = uid('yz-crop');
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        const el = doc.createElement('section');
        el.className = 'crop';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', id);
        el.innerHTML = `
            <header class="crop-head">
                <h2 class="crop-title" id="${id}">${esc(title)}</h2>
                ${desc ? `<p class="crop-desc">${esc(desc)}</p>` : ''}
            </header>
            <div class="crop-stage-wrap">
                <div class="crop-stage" style="aspect-ratio:${aw} / ${ah}">
                    <div class="crop-box" tabindex="0" aria-label="裁剪框，方向键移动，按住 Shift 移动更快">
                        <span class="crop-grid" aria-hidden="true"></span>
                        ${handles.map((h) => `<span class="crop-handle" data-handle="${h}" aria-hidden="true"></span>`).join('')}
                    </div>
                </div>
            </div>
            <p class="crop-meta" aria-live="polite"></p>
            <div class="crop-actions">
                <div>
                    <button type="button" class="crop-btn is-ghost" data-crop="reset">重置</button>
                    <button type="button" class="crop-btn is-ghost" data-crop="full">全图</button>
                </div>
                <div>
                    <button type="button" class="crop-btn" data-crop="cancel">取消</button>
                    <button type="button" class="crop-btn is-primary" data-crop="confirm">确认裁剪</button>
                </div>
            </div>`;
        const stage = el.querySelector('.crop-stage');
        const box = el.querySelector('.crop-box');
        const meta = el.querySelector('.crop-meta');
        stage.style.background = photo || 'radial-gradient(circle at 68% 34%, #FFE7B0 0 9%, transparent 10%), linear-gradient(180deg, #F6C8A8 0%, #E79AA8 38%, #6B5B8C 70%, #2B2F4A 100%)';
        const draw = () => {
            box.style.left = `${r.x * 100}%`;
            box.style.top = `${r.y * 100}%`;
            box.style.width = `${r.w * 100}%`;
            box.style.height = `${r.h * 100}%`;
            meta.textContent = `选区 ${Math.round(r.w * natW)} × ${Math.round(r.h * natH)} px`;
        };

        const resetTo = (next) => { r = { ...next }; draw(); };
        // 拖动：选区内部移动，8 个手柄缩放；坐标按舞台尺寸换算成 0–1 比例
        let drag = null;
        box.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const bounds = stage.getBoundingClientRect();
            drag = { type: event.target.dataset?.handle || 'move', sx: event.clientX, sy: event.clientY, bw: bounds.width, bh: bounds.height, start: { ...r } };
            box.classList.add('is-dragging');
            box.setPointerCapture?.(event.pointerId);
        });
        box.addEventListener('pointermove', (event) => {
            if (!drag) return;
            const dx = (event.clientX - drag.sx) / drag.bw;
            const dy = (event.clientY - drag.sy) / drag.bh;
            const s = drag.start;
            if (drag.type === 'move') {
                r = { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
            } else {
                let left = s.x; let top = s.y; let right = s.x + s.w; let bottom = s.y + s.h;
                if (drag.type.includes('w')) left = clamp(s.x + dx, 0, right - MIN);
                if (drag.type.includes('e')) right = clamp(right + dx, left + MIN, 1);
                if (drag.type.includes('n')) top = clamp(s.y + dy, 0, bottom - MIN);
                if (drag.type.includes('s')) bottom = clamp(bottom + dy, top + MIN, 1);
                r = { x: left, y: top, w: right - left, h: bottom - top };
            }
            draw();
        });
        const endDrag = () => { drag = null; box.classList.remove('is-dragging'); };
        box.addEventListener('pointerup', endDrag);
        box.addEventListener('pointercancel', endDrag);
        // 键盘：方向键移动选区，Shift 加速
        box.addEventListener('keydown', (event) => {
            const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (!delta) return;
            event.preventDefault();
            const stepSize = event.shiftKey ? 0.05 : 0.01;
            r = { ...r, x: clamp(r.x + delta[0] * stepSize, 0, 1 - r.w), y: clamp(r.y + delta[1] * stepSize, 0, 1 - r.h) };
            draw();
        });
        el.querySelector('.crop-actions').addEventListener('click', (event) => {
            const act = event.target.closest('[data-crop]')?.dataset.crop;
            if (act === 'reset') resetTo(initial);
            if (act === 'full') resetTo({ x: 0, y: 0, w: 1, h: 1 });
            if (act === 'cancel') closeLayer('dismiss');
            if (act === 'confirm') {
                const result = { ...r, width: Math.round(r.w * natW), height: Math.round(r.h * natH) };
                closeLayer('close');
                onConfirm?.(result);
            }
        });
        draw();
        openLayer(el, { onDismiss: onCancel, focusSelector: '[data-crop="cancel"]' });
        // 原型手机尺寸固定：开窗时按画布的宽、高同时约束，长图也完整等比居中。
        const wrap = el.querySelector('.crop-stage-wrap');
        const padding = getComputedStyle(wrap);
        const maxWidth = wrap.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
        const maxHeight = wrap.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
        const width = Math.min(maxWidth, maxHeight * aw / ah);
        stage.style.width = `${width}px`;
        stage.style.height = `${width * ah / aw}px`;
    };

    // ===== 自动初始化（document 事件委托，动态插入的内容同样生效） =====
    const isDisabled = (el) => !!el.closest('.disabled-row, [aria-disabled="true"]');
    const setTheme = (mode) => {
        root.dataset.theme = mode;
        doc.querySelectorAll('.seg[data-seg="theme"] > button').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.dataset.value === mode));
        });
    };
    const toNum = (value, fallback) => {
        const n = Number(value);
        return value === undefined || value === '' || Number.isNaN(n) ? fallback : n;
    };
    // 步进器：第一个按钮为减、其余为加，按 data-min / data-max 夹取
    const stepOnce = (btn) => {
        const stepper = btn.closest('.stepper');
        const out = stepper.querySelector('output');
        if (!out) return;
        const dir = btn === stepper.querySelector('button') ? -1 : 1;
        const { min, max, step, unit } = stepper.dataset;
        const stepNum = toNum(step, 1);
        const decimals = (String(stepNum).split('.')[1] || '').length;
        const currentValue = parseFloat(out.textContent) || 0;
        const raw = Number((currentValue + dir * stepNum).toFixed(decimals));
        const next = clamp(raw, toNum(min, -Infinity), toNum(max, Infinity));
        out.textContent = `${next.toFixed(decimals)}${unit ?? ''}`;
    };

    doc.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('#toggle-theme')) {
            setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
            return;
        }
        if (isDisabled(target)) return;
        const segBtn = target.closest('.seg > button');
        if (segBtn) {
            const seg = segBtn.parentElement;
            seg.querySelectorAll(':scope > button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn === segBtn)));
            if (seg.dataset.seg === 'theme' && segBtn.dataset.value) setTheme(segBtn.dataset.value);
            const detail = { name: seg.dataset.seg ?? '', value: segBtn.dataset.value ?? segBtn.textContent.trim(), button: segBtn };
            seg.dispatchEvent(new CustomEvent('yz:seg', { bubbles: true, detail }));
        }
        const stepBtn = target.closest('.stepper button');
        if (stepBtn) stepOnce(stepBtn);
        const toastTrigger = target.closest('[data-toast]');
        if (toastTrigger) toast(toastTrigger.dataset.toast);
    });

    // [role=button] / [role=option] 的 Enter / 空格触发 click（原生控件由浏览器处理）
    doc.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target;
        if (!(target instanceof Element) || !target.matches('[role="button"], [role="option"]')) return;
        if (target.matches('button, a[href], input, select, textarea, summary')) return;
        event.preventDefault();
        if (!isDisabled(target)) target.click();
    });

    window.YZ = Object.freeze({
        toast, sheet, formSheet, actionSheet,
        confirm: confirmDialog, alert: alertDialog, crop,
    });
})();

