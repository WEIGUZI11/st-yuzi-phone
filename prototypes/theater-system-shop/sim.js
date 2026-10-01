// 玉子市场原型：模拟 AI 按 updateNode 规则填表。真实环境中这一步由 AI 完成。
(function () {
    'use strict';
    const D = window.SS_DATA;
    const P = window.SS_PARSE;
    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

    function pickRarity(tier) {
        const w = D.ODDS[tier];
        let r = Math.random() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < w.length; i++) {
            r -= w[i];
            if (r < 0) return i;
        }
        return 0;
    }

    // 按称号阶生成 6 件；点数够最低价时保证至少 1 件买得起
    function genShop(tier, points) {
        const used = new Set();
        const out = [];
        for (let n = 0; n < 6; n++) {
            const r = pickRarity(tier);
            let pool = window.SS_ITEMS.filter((it) => it[0] === r && !used.has(it[1]));
            if (!pool.length) pool = window.SS_ITEMS.filter((it) => !used.has(it[1]));
            const it = pool[rand(0, pool.length - 1)];
            used.add(it[1]);
            const [lo, hi] = D.PRICE[it[0]];
            out.push({ r: it[0], name: it[1], desc: it[2], price: rand(lo, hi) });
        }
        const [gLo, gHi] = D.PRICE[0];
        if (!out.some((x) => x.price <= points) && points >= gLo) {
            const g = window.SS_ITEMS.find((it) => it[0] === 0 && !used.has(it[1]));
            const min = Math.min(...out.map((x) => x.price));
            const i = out.findIndex((x) => x.price === min);
            if (g) out[i] = { r: 0, name: g[1], desc: g[2], price: rand(gLo, Math.min(gHi, points)) };
        }
        out.sort((a, b) => a.r - b.r);
        return out.map((x) => `${D.TIERS[x.r].zh}｜${x.name}｜${x.price}点｜${x.desc}`).join(';');
    }

    // outcome：'win' 正文里任务达成，'lose' 明确失败，其余为尚无结果
    function aiTurn(row, outcome) {
        const next = { ...row };
        const notes = [];
        const status = P.parseStatus(row.status);
        const before = P.parseTitle(row.title);

        if (status !== 'active') {
            const pool = D.SAMPLE_TASKS.filter((t) => t !== row.task);
            next.task = pool[rand(0, pool.length - 1)];
            next.status = D.STATUS.active;
            notes.push(`状态为「${D.STATUS[status]}」→ 发布新任务，不加点`);
        } else if (outcome === 'win') {
            const reward = P.parseTask(row.task).reward;
            next.status = D.STATUS.done;
            next.points = String(P.firstInt(row.points, 0) + reward);
            next.title = P.formatTitle(before.count + 1);
            notes.push(`任务达成 → 已完成，点数 +${reward}，累计完成 +1`);
        } else if (outcome === 'lose') {
            next.status = D.STATUS.fail;
            notes.push('任务失败 → 已失败，其余不动');
        } else {
            notes.push('任务尚无结果 → 状态与点数不动');
        }

        // 货架只看刷新状态：已刷新 → 整架换新并改回未刷新；售空不再触发刷新
        const after = P.parseTitle(next.title);
        const shop = P.parseShop(row.shop);
        if (P.parseRefresh(row.refresh) || !shop.length) {
            next.shop = genShop(after.tier, P.firstInt(next.points, 0));
            notes.push(shop.length ? '刷新状态为「已刷新」→ 按当前称号整架换新，改回「未刷新」' : '货架为空 → 进货');
        } else if (shop.some((it) => it.soldOut)) {
            notes.push('有售空但未刷新 → 货架原样保留');
        }
        next.refresh = D.REFRESH.no;
        return { row: next, notes, levelUp: after.tier > before.tier ? after.tier : -1 };
    }

    window.SS_SIM = { genShop, aiTurn };
})();
