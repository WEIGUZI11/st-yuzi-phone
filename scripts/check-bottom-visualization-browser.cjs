const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuzi-bottom-browser-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ciBrowserFlags = process.platform === 'linux' && process.env.CI
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : [];

async function runBrowser(browser, width) {
    const profile = path.join(dir, `profile-${width}`);
    const child = spawn(browser, ['--headless', `--window-size=${width},1000`, '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        ...ciBrowserFlags, '--remote-debugging-pipe', '--user-data-dir=' + profile,
        ...(process.platform === 'linux' ? ['--disable-dev-shm-usage'] : []), 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','ignore','pipe','pipe'] });
    let sequence = 0, buffer = '';
    const pending = new Map();
    const sendRoot = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 10000);
        pending.set(id, {resolve,reject,timer}); child.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0');
    });
    const rejectPending = error => { for (const task of pending.values()) { clearTimeout(task.timer); task.reject(error); } pending.clear(); };
    child.on('error', rejectPending);
    child.stdio[3].on('error', rejectPending);
    child.stdio[4].setEncoding('utf8');
    child.stdio[4].on('data', data => {
        buffer += data;
        let end;
        while ((end=buffer.indexOf('\0'))>=0) {
            const message=JSON.parse(buffer.slice(0,end)); buffer=buffer.slice(end+1);
            const request=pending.get(message.id); if (!request) continue;
            pending.delete(message.id); clearTimeout(request.timer);
            if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result);
        }
    });
    try {
        const deadline = Date.now() + 30000;
        const {targetId}=await sendRoot('Target.createTarget',{url:'about:blank'});
        const {sessionId}=await sendRoot('Target.attachToTarget',{targetId,flatten:true});
        const send=(method,params={})=>sendRoot(method,params,sessionId);
        await send('Performance.enable');
        let baselineLayouts=0;
        // 实时浏览器帧，而不是虚拟时钟；否则 ResizeObserver / RAF 会被跳过。
        await send('Page.navigate', { url: pathToFileURL(path.join(dir, 'test.html')).href + (process.env.YUZI_BOTTOM_SCREENSHOTS_DIR ? '?capture' : '') });
        while (Date.now() < deadline) {
            const result = await send('Runtime.evaluate', {expression: '({text:document.body?.textContent,error:document.body?.dataset.error,capture:window.__bottomCapture,gesture:window.__bottomGesture,metrics:window.__bottomMetrics,wheel:window.__bottomWheel})',returnByValue:true});
            const state = result.result?.value;
            if (state?.metrics) {
                const metrics=await send('Performance.getMetrics');
                const count=metrics.metrics.find(item=>item.name==='LayoutCount').value;
                if(state.metrics==='start') baselineLayouts=count;
                else console.log('[布局检查] 35 帧滚动，LayoutCount = '+(count-baselineLayouts));
                await send('Runtime.evaluate',{expression:'window.__bottomLayoutCount='+String(count-baselineLayouts)+';window.__bottomMetrics=null'});
            }
            if (state?.wheel) {
                await send('Input.dispatchMouseEvent',{type:'mouseWheel',...state.wheel});
                await sleep(220);
                await send('Runtime.evaluate',{expression:'window.__bottomWheel=null'});
            }
            if (state?.gesture) {
                const {x,y,hold,dy}=state.gesture;
                await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
                await sleep(hold);
                await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:y+dy,button:'left',buttons:1});
                await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y:y+dy,button:'left',buttons:0,clickCount:1});
                await send('Runtime.evaluate',{expression:'window.__bottomGesture=null'});
            }
            if (state?.capture && process.env.YUZI_BOTTOM_SCREENSHOTS_DIR) {
                const image=await send('Page.captureScreenshot',{format:'png'});
                const output=path.resolve(process.env.YUZI_BOTTOM_SCREENSHOTS_DIR); fs.mkdirSync(output,{recursive:true});
                fs.writeFileSync(path.join(output,state.capture+'.png'),Buffer.from(image.data,'base64'));
                await send('Runtime.evaluate',{expression:'window.__bottomCapture=""'});
            }
            if (state?.error) throw Error(state.error);
            if (state?.text?.startsWith('YUZI_BOTTOM_FAIL:')) throw Error(state.text);
            if (state?.text === 'YUZI_BOTTOM_PASS') { console.log(`[通过] 底部可视化真实界面与生命周期 (${width}px)`); return; }
            await sleep(100);
        }
        throw Error('底部可视化浏览器回归超时');
    } finally {
        if (child.exitCode === null) await sendRoot('Browser.close').catch(() => {});
        rejectPending(Error('测试浏览器已关闭')); 
        if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2000)]);
        if (child.exitCode === null) child.kill();
    }
}
async function main() {
    try {
        const test = fs.readFileSync(path.join(__dirname, 'fixtures/bottom-visualization-browser.js'), 'utf8');
        const code = buildSync({ stdin:{ contents:test, resolveDir:process.cwd(), loader:'js' }, bundle:true, write:false, format:'iife', define:{'import.meta.url':JSON.stringify(pathToFileURL(path.resolve('dist/yuzi-phone.bundle.js')).href)} }).outputFiles[0].text;
        buildSync({entryPoints:['style.css'],bundle:true,outfile:path.join(dir,'style.css'),loader:{'.jpg':'file'},logLevel:'silent'});
        fs.writeFileSync(path.join(dir,'test.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"></head><body><script>window.onerror=function(m){document.body.dataset.error=m;};</script><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>');
        const browser = [process.env.YUZI_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
        if (!browser) throw Error('需要 Chromium；可设置 YUZI_TEST_BROWSER');
        await runBrowser(browser, 1440);
        await runBrowser(browser, 500);
    } finally {
        const target = fs.realpathSync(dir), temporaryRoot = fs.realpathSync(os.tmpdir());
        if (path.dirname(target) !== temporaryRoot || !path.basename(target).startsWith('yuzi-bottom-browser-')) throw Error('拒绝清理非测试临时目录');
        fs.rmSync(target,{recursive:true,force:true,maxRetries:10,retryDelay:200});
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
