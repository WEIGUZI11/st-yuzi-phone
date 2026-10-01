// 临时冒烟测试：只加载纯逻辑脚本（data/items/parse/parse-items/sim），不涉及 DOM。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = path.join(__dirname, 'prototypes', 'theater-system-shop');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['data.js', 'items.js', 'parse.js', 'parse-items.js', 'sim.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
const { SS_DATA: D, SS_PARSE: P, SS_SIM: S } = ctx.window;
let fail = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fail++; };

// 称号
ok('初始称号为绿阶麻糬见习生', P.parseTitle(D.INITIAL.title).name === '麻糬见习生');
ok('累计40为SOS团至高团长', P.formatTitle(40).includes('SOS团至高团长'));
ok('称号品级以累计数为准', P.parseTitle('黑·乱写（累计完成3）').tier === 1);

// 背包保留效果
const shopStr = S.genShop(2, 100);
const items = P.parseShop(shopStr);
ok('货架 6 件', items.length === 6);
ok('至少 1 件买得起', items.some((x) => x.price <= 100));
const it = items[0];
const entry = P.bagEntry(it);
const bag = P.parseBag(P.appendBag('空', entry));
ok('入包后保留名字', bag[0].name === it.name);
ok('入包后保留效果', bag[0].desc === it.desc && bag[0].desc.length > 0);
ok('入包后保留来源世界', bag[0].world === it.world);
ok('入包后保留品级', bag[0].rarity === it.rarity);
const bag2 = P.parseBag(P.appendBag(D.INITIAL.bag, entry));
ok('背包多件追加', bag2.length === 2 && bag2[0].name === '好运硬币');
ok('兼容旧写法 物品名（品级）', P.parseBag('筑基丹（紫）')[0].rarity === 2);

// 刷新状态
ok('刷新状态识别', P.parseRefresh('已刷新') === true && P.parseRefresh('未刷新') === false && P.parseRefresh('') === false);
const sold = items.map((x, i) => ({ ...x, soldOut: i === 0 }));
let row = { ...D.INITIAL, shop: P.serializeShop(sold), refresh: '未刷新' };
let r = S.aiTurn(row, 'none').row;
ok('有售空但未刷新：货架原样保留', r.shop === row.shop);
ok('售空标记可回读', P.parseShop(r.shop)[0].soldOut === true);
row = { ...row, refresh: '已刷新' };
r = S.aiTurn(row, 'none').row;
ok('已刷新：整架换新', r.shop !== row.shop && P.parseShop(r.shop).every((x) => !x.soldOut));
ok('已刷新后改回未刷新', r.refresh === '未刷新');
ok('刷新费用为 10', D.REFRESH_COST === 10);

// 任务与点数
row = { ...D.INITIAL, shop: shopStr };
r = S.aiTurn(row, 'win');
ok('达成 +30 点并升蓝阶', r.row.points === '70' && r.levelUp === 1);
const r2 = S.aiTurn(r.row, 'none').row;
ok('已完成下回合只换任务，不重复加点', r2.points === '70' && r2.status === '进行中' && r2.task !== r.row.task);
ok('背包始终原样保留', r2.bag === row.bag);
const r3 = S.aiTurn(row, 'lose').row;
ok('失败不动点数', r3.points === row.points && r3.status === '已失败');

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);
