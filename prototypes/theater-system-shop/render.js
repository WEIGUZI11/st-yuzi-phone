// 系统商店原型：头部（称号、点数、晋升进度）与任务卡渲染。只读 row，不写回。
(function () {
    'use strict';
    const D = window.SS_DATA;
    const P = window.SS_PARSE;
    const $ = (id) => document.getElementById(id);
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
    }
    const tierCls = (i) => `tier-${D.TIERS[i].key}`;

    function renderHead(row) {
        const t = P.parseTitle(row.title);
        const tier = D.TIERS[t.tier];
        $('title').innerHTML = `<span class="ss-badge ${tierCls(t.tier)}" title="${esc(t.raw)}">`
            + `<span class="ss-badge-grade">${tier.zh}</span><span class="ss-badge-name">${esc(t.name)}</span></span>`;
        $('points').innerHTML = `<b>${P.firstInt(row.points, 0)}</b><small>点</small>`;

        const next = D.TIERS[t.tier + 1];
        const pct = next ? Math.max(0, Math.min(100, ((t.count - tier.min) / (next.min - tier.min)) * 100)) : 100;
        const tip = next ? `距「${next.zh}·${next.name}」还差 ${next.min - t.count} 次` : '已登顶，万界唯一';
        $('rank').className = `ss-rank ${tierCls(t.tier)}`;
        $('rank').innerHTML = `<div class="ss-rank-info"><span>累计完成 ${t.count} 次</span><span>${tip}</span></div>`
            + `<div class="ss-bar" role="progressbar" aria-label="晋升进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>`;
        return t;
    }

    function renderTask(row) {
        const k = P.parseStatus(row.status);
        const task = P.parseTask(row.task);
        const stars = '★'.repeat(D.DIFF_STARS[task.diff] || 0);
        const active = k === 'active';
        $('task').innerHTML = `<article class="ss-task is-${k}">`
            + '<div class="ss-task-top">'
            + (task.type ? `<span class="ss-chip">${esc(task.type)}</span>` : '')
            + (task.diff ? `<span class="ss-diff">${stars} ${esc(task.diff)}</span>` : '')
            + `<span class="ss-pill is-${k}">${D.STATUS[k]}</span></div>`
            + (active ? '' : `<span class="ss-stamp" aria-hidden="true">${D.STATUS[k]}</span>`)
            + `<h3 class="ss-task-name">${esc(task.name || '系统任务')}</h3>`
            + `<p class="ss-task-desc">${esc(task.desc || '（系统还没有发布任务）')}</p>`
            + `<div class="ss-task-foot"><span class="ss-reward">奖励 +${task.reward} 点</span>`
            + (active
                ? '<button type="button" class="ss-btn ghost" data-act="abandon">放弃任务</button>'
                : '<span class="ss-hint">下回合系统将发布新任务</span>')
            + '</div></article>';
    }

    window.SS_RENDER = { esc, tierCls, renderHead, renderTask };
})();
