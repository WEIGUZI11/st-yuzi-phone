// 货架与背包的宽松解析与序列化。
(function () {
    'use strict';
    const D = window.SS_DATA;
    const P = window.SS_PARSE;
    const SOLD = '【已售空】';
    const SPLIT = /[;；\n]+/;
    const BAR = /[｜|]/;
    const split = (raw) => String(raw ?? '').split(SPLIT).map((x) => x.trim()).filter(Boolean);
    const rarityOf = (s) => Math.max(0, P.tierIndexByZh(s));

    // 货架：品级｜物品名｜N点｜来源世界·效果；售空由前端在最前面加【已售空】
    function parseItem(seg) {
        const soldOut = seg.includes('已售空');
        const s = seg.replace(/【?已售空】?/g, '').trim();
        const p = s.split(BAR).map((x) => x.trim());
        if (p.length < 3) return { raw: s, soldOut, rarity: 0, name: s, price: P.firstInt(s, 0), world: '', desc: '' };
        return { raw: s, soldOut, rarity: rarityOf(p[0]), name: p[1], price: P.firstInt(p[2], 0), ...P.splitWorld(p.slice(3).join('｜')) };
    }
    const parseShop = (raw) => split(raw).map(parseItem);
    const serializeShop = (items) => items.map((it) => (it.soldOut ? SOLD : '') + it.raw).join(';');

    // 背包：品级｜物品名｜来源世界·效果。只由前端写，保留效果说明
    function parseBagItem(seg) {
        const p = seg.split(BAR).map((x) => x.trim());
        if (p.length >= 2) return { raw: seg, rarity: rarityOf(p[0]), name: p[1], ...P.splitWorld(p.slice(2).join('｜')) };
        // 兼容旧写法：物品名（品级）
        const m = seg.match(/^(.*?)[（(]([^）)]*)[）)]\s*$/);
        const r = m ? P.tierIndexByZh(m[2]) : -1;
        return { raw: seg, rarity: Math.max(0, r), name: m && r >= 0 ? m[1].trim() : seg, world: '', desc: '' };
    }
    function parseBag(raw) {
        const s = String(raw ?? '').trim();
        return !s || s === '空' ? [] : split(s).map(parseBagItem);
    }
    function bagEntry(it) {
        return `${D.TIERS[it.rarity].zh}｜${it.name}｜${it.world ? `${it.world}·` : ''}${it.desc}`;
    }
    function appendBag(raw, entry) {
        const s = String(raw ?? '').trim();
        return !s || s === '空' ? entry : `${s.replace(/[;；\s]+$/, '')};${entry}`;
    }

    Object.assign(P, { parseShop, serializeShop, parseBag, bagEntry, appendBag });
})();
