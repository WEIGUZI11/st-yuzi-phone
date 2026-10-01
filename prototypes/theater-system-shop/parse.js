// 宽松解析：AI 写得不规范也尽量读出来，读不出就保留原文显示。
(function () {
    'use strict';
    const D = window.SS_DATA;

    function tierIndexByCount(n) {
        let idx = 0;
        D.TIERS.forEach((t, i) => { if (n >= t.min) idx = i; });
        return idx;
    }
    function tierIndexByZh(s) {
        return D.TIERS.findIndex((t) => s.includes(t.zh) || s.includes(t.grade));
    }
    function firstInt(s, fallback) {
        const m = String(s ?? '').match(/-?\d+/);
        return m ? parseInt(m[0], 10) : fallback;
    }
    // 来源世界·效果 → { world, desc }
    function splitWorld(tail) {
        const s = String(tail ?? '').trim();
        const dot = s.search(/[·・]/);
        return dot > 0 ? { world: s.slice(0, dot).trim(), desc: s.slice(dot + 1).trim() } : { world: '', desc: s };
    }

    // 【类型·难度】任务名：任务描述（奖励N点）
    function parseTask(raw) {
        const s = String(raw ?? '').trim();
        const tag = s.match(/^【([^】]*)】/);
        const [type = '', diff = ''] = tag ? tag[1].split(/[·・\/]/) : [];
        const rewards = [...s.matchAll(/(\d+)\s*点/g)];
        const reward = rewards.length ? parseInt(rewards[rewards.length - 1][1], 10) : 0;
        const body = s.replace(/^【[^】]*】/, '').replace(/[（(]\s*奖励\s*\d+\s*点\s*[）)]\s*$/, '').trim();
        const cut = body.search(/[：:]/);
        return {
            raw: s, reward, type: type.trim(), diff: diff.trim(),
            name: cut > 0 ? body.slice(0, cut).trim() : '',
            desc: cut > 0 ? body.slice(cut + 1).trim() : body,
        };
    }

    function parseStatus(raw) {
        const s = String(raw ?? '');
        if (s.includes('已完成')) return 'done';
        if (s.includes('已失败')) return 'fail';
        if (s.includes('已放弃')) return 'abandon';
        return 'active';
    }

    // 刷新状态：只认“已刷新”，其余（含空）都当未刷新
    function parseRefresh(raw) {
        return String(raw ?? '').includes('已刷新');
    }

    // 品级·称号名（累计完成N）。品级以累计完成数为准，AI 写错颜色也不影响显示。
    function parseTitle(raw) {
        const s = String(raw ?? '');
        const count = firstInt((s.match(/累计完成\s*(\d+)/) || [])[1], 0);
        const tier = tierIndexByCount(count);
        const name = s.replace(/[（(][^）)]*[）)]/g, '').split(/[·・]/).pop().trim();
        return { raw: s, count, tier, name: name || D.TIERS[tier].name };
    }
    function formatTitle(count) {
        const t = D.TIERS[tierIndexByCount(count)];
        return `${t.zh}·${t.name}（累计完成${count}）`;
    }

    window.SS_PARSE = {
        tierIndexByCount, tierIndexByZh, firstInt, splitWorld,
        parseTask, parseStatus, parseRefresh, parseTitle, formatTitle,
    };
})();
