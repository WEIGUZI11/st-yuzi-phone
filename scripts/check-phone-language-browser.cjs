const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuzi-language-browser-'));
const test = fs.readFileSync(path.join(__dirname, 'fixtures/phone-language-browser.js'), 'utf8');
try {
    const code = buildSync({ stdin: { contents: test, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', define: { 'import.meta.url': JSON.stringify(require('node:url').pathToFileURL(path.resolve('dist/yuzi-phone.bundle.js')).href) } }).outputFiles[0].text;
    buildSync({ entryPoints: ['style.css'], bundle: true, outfile: path.join(dir, 'style.css'), loader: { '.jpg': 'file' }, logLevel: 'silent' });
    fs.writeFileSync(path.join(dir, 'test.html'), '<html><head><link rel="stylesheet" href="style.css"></head><body><script>window.onerror=function(m){document.body.dataset.error=m;};</script><script>' + code.replace(/<\/script/gi, '<\\/script') + '</script></body></html>');
    const browser = [process.env.YUZI_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && fs.existsSync(p));
    if (!browser) throw Error('需要 Chromium；可设置 YUZI_TEST_BROWSER');
    const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + path.join(dir, 'profile'), '--dump-dom', '--virtual-time-budget=4000', require('node:url').pathToFileURL(path.join(dir, 'test.html')).href], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    if (!result.stdout?.includes('YUZI_LANGUAGE_PASS</body>')) throw Error(result.stdout?.match(/<body[^>]*data-error="[^"]*"[^>]*>/)?.[0] || result.stdout?.match(/YUZI_LANGUAGE_FAIL:[\s\S]*?<\/body>/)?.[0] || result.error || result.stderr || '浏览器回归未完成');
    console.log('[通过] 语言真实界面：即时切换、草稿与滚动保护、280px 布局、预设保存、QQ 协议值、面板与入口清理');
} catch(error) { console.error(error); process.exitCode = 1; }
finally {
    const target = fs.realpathSync(dir);
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    if (path.dirname(target) !== temporaryRoot || !path.basename(target).startsWith('yuzi-language-browser-')) throw Error('拒绝清理非测试临时目录');
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
