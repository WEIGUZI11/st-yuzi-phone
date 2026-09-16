const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuzi-language-browser-'));
const test = fs.readFileSync(path.join(__dirname, 'fixtures/phone-language-browser.js'), 'utf8');
const ciBrowserFlags = process.platform === 'linux' && process.env.CI
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : [];
try {
    const code = buildSync({ stdin: { contents: test, resolveDir: process.cwd(), loader: 'js' }, bundle: true, write: false, format: 'iife', define: { 'import.meta.url': JSON.stringify(require('node:url').pathToFileURL(path.resolve('dist/yuzi-phone.bundle.js')).href) } }).outputFiles[0].text;
    buildSync({ entryPoints: ['style.css'], bundle: true, outfile: path.join(dir, 'style.css'), loader: { '.jpg': 'file' }, logLevel: 'silent' });
    fs.writeFileSync(path.join(dir, 'test.html'), '<html><head><link rel="stylesheet" href="style.css"></head><body><script>window.onerror=function(m){document.body.dataset.error=m;};</script><script>' + code.replace(/<\/script/gi, '<\\/script') + '</script></body></html>');
    const browser = [process.env.YUZI_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && fs.existsSync(p));
    if (!browser) throw Error('需要 Chromium；可设置 YUZI_TEST_BROWSER');
    const runBrowser = (attempt) => spawnSync(browser, [
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        ...ciBrowserFlags,
        ...(process.platform === 'linux' ? ['--disable-dev-shm-usage'] : []),
        '--user-data-dir=' + path.join(dir, `profile-${attempt}`),
        '--dump-dom',
        '--virtual-time-budget=4000',
        require('node:url').pathToFileURL(path.join(dir, 'test.html')).href,
    ], { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const hasPassed = result => result.stdout?.includes('YUZI_LANGUAGE_PASS</body>');
    const getPageFailure = result => result.stdout?.match(/<body[^>]*data-error="[^"]*"[^>]*>/)?.[0] || result.stdout?.match(/YUZI_LANGUAGE_FAIL:[\s\S]*?<\/body>/)?.[0];
    const describeBrowserFailure = result => [
        '浏览器回归未完成：status=' + (result.status ?? 'null') + ' signal=' + (result.signal ?? 'none'),
        result.error?.message || result.error,
        result.stderr?.trim() && 'stderr:\n' + result.stderr.trim(),
        result.stdout?.trim() && 'stdout:\n' + result.stdout.trim().slice(-8000),
    ].filter(Boolean).join('\n');
    let result = runBrowser(1);
    if (!hasPassed(result)) {
        const pageFailure = getPageFailure(result);
        if (pageFailure) throw Error(pageFailure);
        result = runBrowser(2);
    }
    if (!hasPassed(result)) throw Error(getPageFailure(result) || describeBrowserFailure(result) || '浏览器回归未完成');
    console.log('[通过] 语言真实界面：即时切换、草稿与滚动保护、280px 布局、预设保存、QQ 协议值、面板与入口清理');
} catch(error) { console.error(error); process.exitCode = 1; }
finally {
    const target = fs.realpathSync(dir);
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    if (path.dirname(target) !== temporaryRoot || !path.basename(target).startsWith('yuzi-language-browser-')) throw Error('拒绝清理非测试临时目录');
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
