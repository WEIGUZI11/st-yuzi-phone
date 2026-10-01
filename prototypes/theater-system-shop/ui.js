// 玉子市场原型：小手机内弹层与轻提示。弹层限制在手机壳内，同一时间只开一个。
(function () {
    'use strict';
    const D = window.SS_DATA;
    const { esc, tierCls } = window.SS_RENDER;
    const phone = document.getElementById('phone');
    const layer = document.getElementById('layer');
    const toastEl = document.getElementById('toast');
    const backdrop = () => phone.querySelectorAll('.phone-nav-bar, .ss-scroll');
    let lastFocus = null;
    let toastTimer = 0;

    function close() {
        layer.hidden = true;
        layer.innerHTML = '';
        layer.onclick = null;
        backdrop().forEach((el) => { el.inert = false; });
        if (lastFocus && lastFocus.isConnected) lastFocus.focus();
        lastFocus = null;
    }

    function open(html, onBtn) {
        lastFocus = document.activeElement;
        layer.innerHTML = html;
        layer.hidden = false;
        backdrop().forEach((el) => { el.inert = true; });
        layer.onclick = (e) => {
            if (e.target === layer) return close();
            const b = e.target.closest('[data-btn]');
            if (b) onBtn(b.dataset.btn);
        };
        const btns = layer.querySelectorAll('button');
        if (btns.length) btns[btns.length - 1].focus();
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !layer.hidden) close();
    });

    function confirm({ title, message, confirmText = '确定', danger = false, onConfirm }) {
        open('<div class="ss-dialog" role="dialog" aria-modal="true" aria-labelledby="ss-dlg-t">'
            + `<h3 id="ss-dlg-t">${esc(title)}</h3><p>${esc(message)}</p><div class="ss-dialog-btns">`
            + '<button type="button" class="ss-btn ghost" data-btn="cancel">取消</button>'
            + `<button type="button" class="ss-btn ${danger ? 'danger' : 'primary'}" data-btn="ok">${esc(confirmText)}</button>`
            + '</div></div>', (k) => {
            close();
            if (k === 'ok') onConfirm();
        });
    }

    // 背包物品详情：品级、来源世界、效果；「使用」交给调用方写入酒馆输入框
    function itemDetail(item, onUse) {
        const t = D.TIERS[item.rarity];
        open(`<div class="ss-dialog ss-detail ${tierCls(item.rarity)}" role="dialog" aria-modal="true" aria-labelledby="ss-dlg-t">`
            + `<div class="ss-detail-meta"><span class="ss-item-grade">${t.zh}·${t.grade}</span>`
            + (item.world ? `<span class="ss-detail-world">${esc(item.world)}</span>` : '') + '</div>'
            + `<h3 id="ss-dlg-t" class="ss-detail-name">${esc(item.name)}</h3>`
            + '<div class="ss-detail-label">道具效果</div>'
            + `<p class="ss-detail-desc">${esc(item.desc || '（没有记录效果）')}</p>`
            + '<div class="ss-dialog-btns">'
            + '<button type="button" class="ss-btn ghost" data-btn="cancel">收起来</button>'
            + '<button type="button" class="ss-btn primary" data-btn="use">使用</button>'
            + '</div></div>', (k) => {
            close();
            if (k === 'use') onUse(item);
        });
    }

    function levelUp(tier) {
        const t = D.TIERS[tier];
        open(`<div class="ss-dialog ss-levelup ${tierCls(tier)}" role="dialog" aria-modal="true" aria-labelledby="ss-dlg-t">`
            + '<h3 id="ss-dlg-t">称号晋升</h3>'
            + `<div class="ss-levelup-name">${esc(t.name)}</div>`
            + `<p>玉子市场为你解锁了更多「${t.grade}」级商品</p>`
            + '<div class="ss-dialog-btns" style="justify-content:center"><button type="button" class="ss-btn primary" data-btn="ok">收下这份荣耀</button></div>'
            + '</div>', close);
    }

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
    }

    window.SS_UI = { confirm, itemDetail, levelUp, toast, close };
})();
