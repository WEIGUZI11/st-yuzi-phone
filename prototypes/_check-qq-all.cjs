// 临时校验：QQ 原型的内联脚本语法、标签配对、id 唯一、</html> 收尾、<style> 无写死颜色。用完即删。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = __dirname;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const files = fs.readdirSync(dir).filter((f) => /^qq-.*\.html$/.test(f)).sort();
let ok = true;
for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const errs = [];
    if (!/<\/html>\s*$/.test(src)) errs.push('未以 </html> 收尾');
    const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (!scripts.length) errs.push('无内联脚本');
    scripts.forEach((code, i) => { try { new vm.Script(code); } catch (e) { errs.push(`脚本#${i + 1} ${e.message}`); } });
    const html = src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
        const tag = m[2].toLowerCase();
        if (VOID.has(tag) || m[3]) continue;
        if (!m[1]) { stack.push(tag); continue; }
        if (stack[stack.length - 1] === tag) stack.pop(); else { errs.push(`标签错配 </${tag}>`); break; }
    }
    if (stack.length) errs.push(`未闭合: ${stack.join(',')}`);
    const ids = [...html.matchAll(/\sid="([^"$]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) errs.push(`重复 id: ${[...new Set(dup)].join(',')}`);
    const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    const lit = styles.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g);
    if (lit) errs.push(`style 写死颜色 ${lit.length} 处: ${[...new Set(lit)].slice(0, 4).join(' ')}`);
    const lines = src.split('\n').length;
    if (errs.length) ok = false;
    console.log(`${errs.length ? 'FAIL' : 'OK  '} ${f} (${lines} 行)${errs.length ? ' -> ' + errs.join(' | ') : ''}`);
}
console.log(`共 ${files.length} 个`);
process.exit(ok ? 0 : 1);
