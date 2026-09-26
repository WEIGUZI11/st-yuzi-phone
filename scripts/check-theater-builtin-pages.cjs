const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), {spawnSync}=require('node:child_process'), {buildSync}=require('esbuild');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yuzi-theater-tests-'));
const test = `
import {createBuiltinImageController} from './modules/phone-theater/builtin/image-controller.js';
import {createBuiltinTheaterImageService} from './modules/phone-theater/builtin/images.js';
import {buildBuiltinTheaterSnapshot} from './modules/phone-theater/builtin/model.js';
import {mountBuiltinTheater} from './modules/phone-theater/builtin/runtime.js';
import {getTheaterSceneDefinition} from './modules/phone-theater/scenes/index.js';
import {showImageViewerDialog} from './modules/settings-app/services/image-viewer-dialog.js';
import {registerPhoneTemporaryLayerHost} from './modules/phone-core/shell-temporary-layer-host.js';
import {mount} from './modules/phone-theater/builtin/square.js';
import {mount as mountLive} from './modules/phone-theater/builtin/live.js';
import {mount as mountDiary} from './modules/phone-theater/builtin/diary.js';
import {getPhoneSettings} from './modules/settings.js';
import {applyAppearanceFontLibrary} from './modules/settings-app/services/appearance-settings/font-library-service.js';
import {mount as mountForum} from './modules/phone-theater/builtin/forum.js';
const fixtureImage=(width,height)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="teal"/></svg>');
function assertImageFrame(frame,ratio,label) {
 const image=frame.querySelector('img'), box=frame.getBoundingClientRect(), picture=image.getBoundingClientRect();
 if(frame.dataset.hasImage!=='true' || image.hidden || Math.abs(box.width/box.height-ratio)>.03 || Math.abs(box.height-picture.height)>1 || getComputedStyle(image).objectFit!=='contain')throw Error(label+'应按原图比例撑开画布，不裁切图片');
}
function assertHomeClearance(root,selector) {
 root.style.setProperty('--yuzi-phone-home-indicator-hit-height','48px');
 if(parseFloat(getComputedStyle(root.querySelector(selector)).paddingBottom)<48)throw Error('小剧场底部应跟随 Home 安全区：'+selector);
 root.style.removeProperty('--yuzi-phone-home-indicator-hit-height');
}
function assertStandardNav(root,label) {
 const nav=[...root.querySelectorAll('.phone-nav-bar')].find(n=>n.getBoundingClientRect().height>0);
 if(!nav)throw Error(label+'应使用标准小手机标题栏');
 const center=nav.querySelector('.phone-nav-center');
 for(const safeTop of [62,70]) {
   root.style.setProperty('--yuzi-phone-app-nav-top-padding',safeTop+'px');
   const y=center.getBoundingClientRect().top-root.getBoundingClientRect().top;
   if(Math.abs(y-safeTop)>1 || Math.abs(center.getBoundingClientRect().height-54)>1)throw Error(label+'标题栏应跟随安全区，不能重复顶部留白：'+y);
 }
 root.style.removeProperty('--yuzi-phone-app-nav-top-padding');
}
(async()=>{try {
 const phone=document.createElement('div');phone.id='yuzi-phone-standalone';document.body.append(phone);
 const shell=document.createElement('div');shell.className='yuzi-phone-shell';phone.append(shell);
 const host={extensionSettings:{}};globalThis.getContext=()=>host;
 const root=document.createElement('div');root.style.cssText='position:relative;width:400px;height:800px';shell.append(root);
 const state={headers:['帖子ID','发帖账号名','图片描述','视频描述'],rows:[['a','阿青','海边','晚霞']],canPrevious:false,canNext:false};
 const controller=new AbortController();
 const dispose=mount({root,getState:()=>state,subscribe:()=>()=>{},signal:controller.signal,theme:{mode:'light'},profile:{get:(_k,d)=>d,set:async()=>{}},userName:'我',presetAssets:{getUrl:async()=>''},mountImages:()=>{},actions:{}});
 assertStandardNav(root,'广场');
 assertHomeClearance(root,'.yuzi-theater-square-content');
 if(root.querySelectorAll('[data-image-canvas]').length!==2) throw Error('广场需要两个独立画布');
 const hostStyle=document.createElement('style');
 hostStyle.textContent='.yuzi-phone-shell p {font-family: monospace !important;}';document.head.append(hostStyle);
 root.classList.add('yuzi-phone-theater-builtin');
 for(const fontId of ['builtin.basic-sans','builtin.modern-sans']) {
   getPhoneSettings().appearanceFontLibrary={activeFontId:fontId,userFonts:[]};applyAppearanceFontLibrary(phone);
   const target=root.querySelector('.yuzi-theater-square-post-copy');
   if(getComputedStyle(target).fontFamily!==getComputedStyle(phone).fontFamily)throw Error('内置小剧场正文应跟随主字体，不能被宿主正文样式覆盖');
 }
 hostStyle.remove();root.classList.remove('yuzi-phone-theater-builtin');
 const avatarImport=root.querySelector('.yuzi-theater-square-avatar-import');
 const backgroundImport=root.querySelector('.yuzi-theater-square-bg-button');
 if(!avatarImport.querySelector('svg') || avatarImport.textContent.trim())throw Error('头像入口应为与背景入口一致的图标按钮');
 const ar=avatarImport.getBoundingClientRect(),br=backgroundImport.getBoundingClientRect();
 if(Math.abs(ar.top-br.top)>1 || ar.right>br.left || ar.width!==br.width || ar.height!==br.height)throw Error('头像与背景入口应同尺寸、同一行并排且不重叠');
 if(root.querySelector('[data-theme-toggle]')) throw Error('不得保留独立主题开关');
 const raw={sheet_test:{name:'广场表',content:[state.headers,...state.rows]}};
 const snapshot=buildBuiltinTheaterSnapshot(raw,'sheet_test','square');
 const config={imageGeneration:{enabled:true,theaterEnabled:{square:true}}}, stored=new Map();
 let finishInitialRead, readCount=0, lastGenerated="";
 const imageService=createBuiltinTheaterImageService({sceneId:'square',getPhoneSettings:()=>config,ownershipStore:{read:async key=>++readCount === 1 ? new Promise(resolve=>{finishInitialRead=resolve;}) : stored.get(key),write:async item=>stored.set(item.key,item)},imageGenerationRuntime:{composeCharacterImagePrompt:async ({description})=>description,generateAndStore:async input=>{lastGenerated=input.prompt;return {ok:true,path:'/user/images/yuzi-phone-generated/test.png'};}}});
 const imageController=createBuiltinImageController({root,sceneId:'square',getSnapshot:()=>snapshot,getChatScope:()=> 'chat:test',getSettings:()=>config,service:imageService,isCurrent:()=>true,signal:controller.signal,notify:message=>{throw Error(message)}});
 root.remove();
 config.imageGeneration.enabled=false;
 imageController.mount();
 if([...root.querySelectorAll('[data-theater-generate]')].some(button=>!button.hidden))throw Error('首次未连接页面：关闭总开关必须隐藏按钮');
 await new Promise(resolve=>setTimeout(resolve,0));
 document.body.append(root);
 imageController.mount();
 if([...root.querySelectorAll('[data-theater-generate]')].some(button=>!button.hidden))throw Error('提交页面后关闭总开关仍必须隐藏按钮');
 config.imageGeneration.enabled=true;
 config.imageGeneration.theaterEnabled.square=false;imageController.updateSettings();
 if([...root.querySelectorAll('[data-theater-generate]')].some(button=>!button.hidden))throw Error('只开总开关不能显示场景按钮');
 config.imageGeneration.theaterEnabled.square=true;imageController.updateSettings();
 await new Promise(resolve=>setTimeout(resolve,0));
 const generate=root.querySelector('[data-theater-generate]'); if(!generate || generate.hidden) throw Error('启用后必须显示生图按钮');
 if(generate.textContent.trim() || !generate.querySelector('.fa-wand-magic-sparkles'))throw Error('生图入口应只有 QQ 魔法棒图标，不显示文字胶囊');
 if(getComputedStyle(generate.firstElementChild).fontSize!=='16px')throw Error('魔法棒图标不应被画布占位文字字号缩小');
 if(getComputedStyle(generate).backgroundColor!=='rgba(0, 0, 0, 0)')throw Error('生图入口背景必须透明');
 generate.click();
 if(generate.getAttribute('aria-busy')!=='true' || !generate.disabled)throw Error('生成期间必须展示忙碌状态并阻止重复点击');
 await new Promise(resolve=>setTimeout(resolve,25));
 const generated=root.querySelector('[data-image-canvas="image"] img');
 if(!generated || generated.hidden || !generated.src.endsWith('/test.png')) throw Error('生图完成后必须在对应画布展示');
 if(!generate.querySelector('.fa-rotate') || generate.getAttribute('aria-busy')!=='false')throw Error('生成后切换重新生成图标并结束忙碌态');
 root.classList.add('yuzi-phone-theater-builtin');
 const squareFrames=[...root.querySelectorAll('.yuzi-theater-square-media-item')];
 if(Math.abs(squareFrames[1].getBoundingClientRect().width/squareFrames[1].getBoundingClientRect().height-2)>.03)throw Error('未生成的广场画布应保留占位比例');
 generated.src=fixtureImage(300,800);await generated.decode();
 assertImageFrame(squareFrames[0],300/800,'广场竖图');
 squareFrames[1].querySelector('[data-theater-generate]').click();await new Promise(resolve=>setTimeout(resolve,25));
 const wide=squareFrames[1].querySelector('img');wide.src=fixtureImage(800,300);await wide.decode();
 generated.src=fixtureImage(300,800);await generated.decode();
 assertImageFrame(squareFrames[1],800/300,'广场横图');
 assertImageFrame(squareFrames[0],300/800,'同帖另一张广场竖图');
 root.classList.remove('yuzi-phone-theater-builtin');
 finishInitialRead(null); await new Promise(resolve=>setTimeout(resolve,0));
 if(generated.hidden)throw Error('晚到的旧图读取不能清掉刚生成的图片');
 config.imageGeneration.theaterEnabled.square=false; imageController.updateSettings();
 if(!generate.hidden || !root.querySelector('[data-image-canvas="image"] img')) throw Error('关闭入口只隐藏按钮不隐藏图片');
 imageController.dispose(); dispose();controller.abort();
 const forumState={headers:['发帖账号名','帖子标题','帖子正文','分区/版面名'],rows:[['网友','<img class="unsafe">','正文','讨论']],canPrevious:false,canNext:false};
 config.imageGeneration.theaterEnabled.forum=true;
 const forumRaw={sheet_forum:{name:'论坛表',content:[forumState.headers,...forumState.rows]}};
 const forumSnapshot=buildBuiltinTheaterSnapshot(forumRaw,'sheet_forum','forum'), forumAbort=new AbortController();
 const forumService=createBuiltinTheaterImageService({sceneId:'forum',getPhoneSettings:()=>config,ownershipStore:{read:async key=>stored.get(key),write:async record=>stored.set(record.key,record)},imageGenerationRuntime:{composeCharacterImagePrompt:async ({description})=>description,generateAndStore:async()=>({ok:true,path:'/user/images/yuzi-phone-generated/forum.png'})}});
 const forumImages=createBuiltinImageController({root,sceneId:'forum',getSnapshot:()=>forumSnapshot,getChatScope:()=> 'chat:test',getSettings:()=>config,service:forumService,isCurrent:()=>true,signal:forumAbort.signal});
 const forumDispose=mountForum({root,getState:()=>forumState,subscribe:()=>()=>{},signal:forumAbort.signal,theme:{mode:'light'},mountImages:()=>forumImages.mount(),actions:{}});
 assertStandardNav(root,'论坛列表');
 const feedTop=root.querySelector('.yuzi-theater-forum-top');
 if(feedTop.textContent.includes('论坛表'))throw Error('论坛列表不应新增论坛表标题行');
 const feedControls=[root.querySelector('[data-action="previousTable"]'),...root.querySelectorAll('[data-feed-tab]'),root.querySelector('[data-action="nextTable"]')];
 const rowY=feedControls[0].getBoundingClientRect().top+feedControls[0].getBoundingClientRect().height/2;
 for(const button of feedControls){const rect=button.getBoundingClientRect();if(Math.abs(rect.top+rect.height/2-rowY)>1)throw Error('发现关注和左右切表箭头必须处于同一行');}
 if(!feedControls.every((button,i)=>!i || button.getBoundingClientRect().left>=feedControls[i-1].getBoundingClientRect().right))throw Error('论坛中间应依次为左箭头、发现、关注、右箭头');
 assertHomeClearance(root,'.yuzi-theater-forum-bottom');
 if(root.querySelector('.unsafe')) throw Error('表格文字不得作为 HTML 执行');
 if(root.querySelector('.yuzi-theater-forum-cover .yuzi-phone-theater-image-note').textContent !== '讨论')throw Error('未生成时保留论坛原来的分区占位，不把正文塞进缩略画布');
 root.querySelector('[data-post-index]').click();
 assertStandardNav(root,'论坛详情');
 const detailBack=root.querySelector('[data-detail-back]').getBoundingClientRect();
 const detailAuthor=root.querySelector('.yuzi-theater-forum-detail-author').getBoundingClientRect();
 if(detailAuthor.left<detailBack.right || detailAuthor.left-detailBack.right>12)throw Error('详情头像和作者应紧邻返回箭头，而非居中');
 assertHomeClearance(root,'.yuzi-theater-forum-detail-bottom');
 if(root.querySelector('#yuzi-theater-forum-detail').hidden) throw Error('点击帖子应进入详情');
 if(root.querySelectorAll('[data-image-canvas="cover"]').length!==2) throw Error('论坛两处画布必须共享帖子');
 const detailBottom=root.querySelector('.yuzi-theater-forum-detail-bottom');
 if(Math.abs(detailBottom.getBoundingClientRect().bottom-root.getBoundingClientRect().bottom)>1)throw Error('短帖详情操作栏应靠底部安全区，不悬在正文之后');
  const hero=root.querySelector('.yuzi-theater-forum-hero');
 if(Math.abs(hero.getBoundingClientRect().width/hero.getBoundingClientRect().height - 1.6)>.02) throw Error('未生成的论坛详情画布应保留占位比例');
  hero.querySelector('[data-theater-generate]').click();await new Promise(resolve=>setTimeout(resolve,25));
  const forumPictures=[...root.querySelectorAll('[data-image-canvas="cover"] img')];
  if(forumPictures.length!==2 || forumPictures.some(img=>img.hidden || !img.src.endsWith('/forum.png')))throw Error('论坛列表和详情必须同步显示生成结果');
 root.classList.add('yuzi-phone-theater-builtin');
 for(const image of forumPictures){image.src=fixtureImage(300,800);await image.decode();}
 assertImageFrame(root.querySelector('.yuzi-theater-forum-cover'),300/800,'论坛列表竖图');
 assertImageFrame(hero,300/800,'论坛详情竖图');
 root.classList.remove('yuzi-phone-theater-builtin');
 root.querySelector('[data-detail-back]').click();
 if(!root.querySelector('#yuzi-theater-forum-detail').hidden || root.querySelector('#yuzi-theater-forum-detail').childElementCount)throw Error('返回列表应释放旧详情画布，不能保留旧记录入口');
 forumImages.dispose(); forumAbort.abort(); forumDispose();
 const diaryState={headers:['日期','角色','内容'],rows:[['今天','阿青','正文 PS:附言'],['昨天','阿青','旧文']],canPrevious:false,canNext:false};
 const diaryDispose=mountDiary({root,getState:()=>diaryState,subscribe:()=>()=>{},signal:new AbortController().signal,theme:{mode:'light'},presetAssets:{getUrl:async()=>''},actions:{}});
 assertStandardNav(root,'小日记');
 const diaryPage=root.querySelector('.yuzi-theater-diary');
 const diaryNav=diaryPage.querySelector('.phone-nav-bar');
 for(const [theme,color] of [['light','rgb(255, 255, 255)'],['dark','rgb(5, 5, 5)']]) {
   diaryPage.dataset.theme=theme;
   const style=getComputedStyle(diaryNav);
   if(style.backgroundColor!==color || style.backdropFilter!=='none' || style.webkitBackdropFilter && style.webkitBackdropFilter!=='none')throw Error('小日记标题栏应使用主题实色且不模糊外壳，避免顶角黑影：'+theme);
 }
 diaryPage.dataset.theme='light';
 assertHomeClearance(root,'.yuzi-theater-diary-content');
 if(root.querySelectorAll('.yuzi-theater-diary-person-group').length!==1) throw Error('同一角色日记应分组');
 const before=root.textContent; root.querySelector('[data-local-action="save"]').click();
 if(root.textContent!==before) throw Error('收藏只当装饰，不得置顶或修改文字');
 if(!root.querySelector('.yuzi-theater-diary-postscript')) throw Error('必须保留附言展示');
 diaryDispose();
 const liveState={headers:['直播间名','剧情舞台概述','剧情弹幕串'],rows:[['直播','场景','']],canPrevious:false,canNext:false};
 const liveActions=[];
 const liveDispose=mountLive({root,getState:()=>liveState,subscribe:()=>()=>{},signal:new AbortController().signal,theme:{mode:'light'},mountImages:()=>{},actions:Object.fromEntries(['back','previousTable','nextTable','editCurrentTable'].map(action=>[action,()=>liveActions.push(action)]))});
 for(const selector of ['.yuzi-theater-live-close','[data-table-action="previousTable"]','[data-table-action="nextTable"]','[data-table-action="editCurrentTable"]'])root.querySelector(selector).click();
 if(liveActions.join(',')!=='back,previousTable,nextTable,editCurrentTable')throw Error('移除直播标题栏后原关闭与底部切表、编辑操作必须仍可用');
 if(root.textContent.includes('2.4w') || root.textContent.includes('1,328') || root.textContent.includes('慧***')) throw Error('直播不能虚构互动数据和弹幕');
 if(!root.querySelector('[data-image-canvas="background"]')) throw Error('直播需要背景画布');
 const pause=root.querySelector('[data-barrage-toggle]'); pause.click();
 if(pause.dataset.paused!=='true') throw Error('弹幕暂停功能必须保留');
 liveDispose();
 const outer=document.createElement('div');document.body.append(outer);
 const cleanup=mountBuiltinTheater(outer,{scene:getTheaterSceneDefinition('square'),sheetKey:'sheet_test',rawData:raw,navigation:{},lifecycle:{isActive:()=>true}}, {getRawData:()=>raw,getSettings:()=>config,getChatScope:()=> 'chat:test',imageService,subscribeSettings:()=>()=>{},subscribeTables:()=>()=>{}});
 if(!outer.querySelector('.yuzi-theater-square')) throw Error('内置页面必须能通过小剧场入口挂载');
 cleanup(); if(outer.querySelector('.yuzi-theater-square')) throw Error('页面退出必须释放挂载内容');
 const liveOuter=document.createElement('div');liveOuter.style.cssText='position:relative;width:400px;height:800px';document.body.append(liveOuter);
 const liveRaw={sheet_live:{name:'直播表',content:[liveState.headers,...liveState.rows]}};
 config.imageGeneration.theaterEnabled.square=true;config.imageGeneration.theaterEnabled.live=true;
 let updateLiveTable;
 const disposeNativeLive=mountBuiltinTheater(liveOuter,{scene:getTheaterSceneDefinition('live'),sheetKey:'sheet_live',rawData:liveRaw,navigation:{},lifecycle:{isActive:()=>true}}, {getRawData:()=>liveRaw,getSettings:()=>config,getChatScope:()=> 'chat:test',imageService,subscribeSettings:()=>()=>{},subscribeTables:callback=>{updateLiveTable=callback;return()=>{};}});
 if(liveOuter.querySelector('.phone-nav-bar'))throw Error('直播不应新增独立标题栏');
 if(liveOuter.querySelector('[data-image-canvas="background"]').getBoundingClientRect().height!==800)throw Error('直播背景必须铺满小手机，不能被通用画布样式改成零高度');
 const liveHost=liveOuter.querySelector('.yuzi-theater-live-topbar');
 if(Math.abs(liveHost.getBoundingClientRect().top-liveOuter.getBoundingClientRect().top-50)>1)throw Error('直播主播栏应恢复原始顶部位置，不能保留已删除标题栏的占位');
 liveOuter.style.height='600px';
 for(const selector of ['[data-theater-generate]','[data-barrage-toggle]']) {
   if(liveOuter.querySelector(selector).getBoundingClientRect().top<liveHost.getBoundingClientRect().bottom)throw Error('较矮手机的右上控件不能遮住主播栏：'+selector);
 }
 liveOuter.style.height='800px';
 const liveGenerateRect=liveOuter.querySelector('[data-theater-generate]').getBoundingClientRect();
 const liveSummaryRect=liveOuter.querySelector('.yuzi-theater-live-stage-summary').getBoundingClientRect();
 if(liveGenerateRect.bottom > liveSummaryRect.top)throw Error('右上生图按钮不能压在剧情概述上');
 liveRaw.sheet_live.content[1][1]='更新后的舞台';updateLiveTable();
 liveOuter.querySelector('[data-theater-generate]').click();await new Promise(resolve=>setTimeout(resolve,25));
 if(!lastGenerated.includes('更新后的舞台'))throw Error('直播表更新后必须使用新提示词，不能保留旧画布事件闭包');
 if(liveOuter.querySelector('.yuzi-theater-live').dataset.hasGeneratedImage!=='true')throw Error('生成后必须切换到背景图展示态');
 disposeNativeLive();
 // Each scene must paint before route commit, with all master/scene combinations.
 for(const [sceneId,rawData,sheetKey] of [['square',raw,'sheet_test'],['forum',forumRaw,'sheet_forum'],['live',liveRaw,'sheet_live']]) {
   for(const [master,local,visible] of [[false,false,false],[false,true,false],[true,false,false],[true,true,true]]) {
     const detached=document.createElement('div');detached.style.cssText='position:relative;width:400px;height:800px';
     const settings={imageGeneration:{enabled:master,theaterEnabled:{[sceneId]:local}}};
     let settingsChanged;
     const stop=mountBuiltinTheater(detached,{scene:getTheaterSceneDefinition(sceneId),sheetKey,rawData,navigation:{},lifecycle:{isActive:()=>true}}, {
       getRawData:()=>rawData,getSettings:()=>settings,getChatScope:()=> 'chat:test',imageService,
       subscribeSettings:callback=>{settingsChanged=callback;return()=>{};},subscribeTables:()=>()=>{},
     });
     const check=()=>{const buttons=[...detached.querySelectorAll('[data-theater-generate]')];if(!buttons.length || buttons.some(button=>button.hidden===visible))throw Error(sceneId+'首次挂载必须遵守总开关和场景开关：'+master+'/'+local);};
     check();await new Promise(resolve=>setTimeout(resolve,20));check();
     document.body.append(detached);check();
     if(sceneId==='forum') {detached.querySelector('[data-post-index]').click();check();detached.querySelector('[data-detail-back]').click();check();}
     settings.imageGeneration.enabled=false;settingsChanged();
     if([...detached.querySelectorAll('[data-theater-generate]')].some(button=>!button.hidden))throw Error('运行中关闭总开关必须立即隐藏入口');
     stop();detached.remove();
   }
 }
 const layerHost=document.createElement('div');layerHost.style.cssText='position:relative;width:400px;height:800px';document.body.append(layerHost);registerPhoneTemporaryLayerHost(layerHost);
 const close=showImageViewerDialog({imagePath:fixtureImage(300,800),altText:'说明',frameless:true});
  if(layerHost.querySelector('.phone-image-viewer-header'))throw Error('广场论坛图片查看不应新增有框标题栏');
 const preview=layerHost.querySelector('.yuzi-qq-image-viewer-image');
 if(!preview)throw Error('图片查看必须复用 QQ 的内容组件');
 await preview.decode();
 const visual=layerHost.querySelector('.yuzi-qq-image-viewer-visual');
 if(preview.getBoundingClientRect().height>visual.getBoundingClientRect().height+1 || getComputedStyle(preview).objectFit!=='contain')throw Error('长图预览不能超过可见区域被裁掉');
 if(getComputedStyle(layerHost.querySelector('.yuzi-qq-image-viewer-description')).display!=='none')throw Error('有图片的广场论坛预览不应显示底部描述');
  close();if(layerHost.children.length)throw Error('关闭预览应释放遮罩');
 const calendar=document.createElement('div');calendar.className='phone-app-page phone-theater-page';calendar.dataset.theaterScene='calendar';document.body.append(calendar);
 document.documentElement.setAttribute('data-yuzi-phone-theme','light');
 if(getComputedStyle(calendar).color!=='rgb(37, 54, 69)')throw Error('日历白天应采用蓝灰文字');
 document.documentElement.setAttribute('data-yuzi-phone-theme','dark');
 calendar.innerHTML='<section class="phone-theater-calendar-detail"><p class="phone-theater-calendar-content">事件正文</p><span class="phone-theater-calendar-status">状态</span><span class="phone-theater-calendar-weather">天气</span></section>';
 const luminance=rgb=>{const channels=rgb.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
 for(const text of calendar.querySelectorAll('p,span')) {
   const lum=luminance(getComputedStyle(text).color);
   if((lum+.05)/(luminance('rgb(37, 46, 56)')+.05)<4.5)throw Error('黑夜日历详情正文、状态和天气必须清晰可读：'+text.className);
 }
 if(getComputedStyle(calendar).color!=='rgb(225, 231, 236)')throw Error('日历应随全局黑夜主题切换');
 document.body.textContent='YUZI_TEST_PASS';
} catch(e) { document.body.textContent='YUZI_TEST_FAIL: '+e.stack; }})();
`;
try {
 const code=buildSync({stdin:{contents:test,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife',define:{'import.meta.url':JSON.stringify(require('node:url').pathToFileURL(path.resolve('dist/yuzi-phone.bundle.js')).href)}}).outputFiles[0].text;
  const baseStyles=['styles/phone-base/00-phone-tokens.css','styles/phone-base/06-layout-nav-core.css','styles/phone-base/07-settings-modern.css','styles/phone-base/12-qq-app.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
  const styles=process.env.YUZI_TEST_STYLES ? fs.readFileSync(process.env.YUZI_TEST_STYLES,'utf8') : baseStyles+['common','square','forum','diary','live'].map(id=>fs.readFileSync('styles/phone-theater/builtin/'+id+'.css','utf8')).join('\n') + fs.readFileSync('styles/phone-theater/calendar.css','utf8');
 fs.writeFileSync(path.join(dir,'test.html'),'<html><head><style>'+styles+'</style></head><body><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>');
 const browser=[process.env.YUZI_TEST_BROWSER,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>file && fs.existsSync(file));
 if(!browser)throw Error('需要 Chromium 浏览器进行真实页面回归；可通过 YUZI_TEST_BROWSER 指定路径');
 const result=spawnSync(browser,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','--virtual-time-budget=3000','file:///'+path.join(dir,'test.html').replaceAll('\\','/')],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
 if(!result.stdout?.includes('YUZI_TEST_PASS</body>'))throw Error(result.stdout?.match(/YUZI_TEST_FAIL:[\s\S]*?<\/body>/)?.[0] || result.error || result.stderr || '浏览器测试未完成');
 console.log('[theater-builtin-pages] passed');
} catch(e) {console.error(e); process.exitCode=1;}
