import { createAiInstructionPresetsPage } from './modules/settings-app/pages/ai-instruction-presets.js';
import { createQQV2PresetSettingsService } from './modules/settings-app/services/qq-v2-preset-facade.js';
import { createMemoryQQV2StateStore } from './modules/qq-v2/storage/state-store.js';
import { createQQV2ProductionRuntime } from './modules/qq-v2/application/production-runtime.js';
import { createRuntimeScope } from './modules/runtime-manager.js';
import { createQQApp } from './modules/qq-v2/ui/app.js';
import { createPhoneSettingsPanel, destroyPhoneSettingsPanel } from './modules/settings-panel.js';
import { bindPhoneBootstrapWindowEvents } from './modules/bootstrap/event-registry.js';
import { bindPhoneShellAppControls } from './modules/phone-core/shell-app-controls.js';
import { EventManager } from './modules/utils/event-manager.js';
import { createPhoneToggleButton, disposePhoneToggleInteractions } from './modules/bootstrap/toggle-button.js';
import { createPhoneContainer } from './modules/bootstrap/toggle-button.js';
import { buildPhoneShellHtml } from './modules/phone-core/shell-ui.js';
import { renderSettings } from './modules/settings-app/render.js';
import { getPhoneSettings, savePhoneSetting } from './modules/settings.js';
(async () => { try {
    const host = { extensionSettings: {}, saveSettingsDebounced() {} };
    window.getContext = () => host;
    const phone = createPhoneContainer(); phone.classList.add('visible');
    Object.assign(phone.style, { width: '280px', height: '640px', left: '0px', top: '0px' });
    phone.innerHTML = buildPhoneShellHtml();
    const root = phone.querySelector('.yuzi-phone-screen');
    const draft = document.createElement('textarea'); draft.value = '未发送的草稿'; document.body.append(draft);
    // jQuery 是宿主抽屉边界；手机界面、设置与事件管理均使用真实实现。
    window.$ = () => { const jq = { find:()=>jq, off:()=>jq, on:()=>jq, is:()=>false, slideUp:()=>jq, slideDown:()=>jq, removeClass:()=>jq, addClass:()=>jq }; return jq; };
    const extensions = document.createElement('div'); extensions.id='extensions_settings'; document.body.append(extensions);
    createPhoneSettingsPanel();
    const panel = document.getElementById('yuzi-phone-settings');
    const panelCheckbox = panel.querySelector('#yuzi-phone-enabled');
    const toggle = createPhoneToggleButton();
    const events = new EventManager('language-browser'); bindPhoneBootstrapWindowEvents(events);
    const shellControls = bindPhoneShellAppControls(phone, { getCurrentRoute: () => 'settings' });
    const dispose = renderSettings(root);
    root.querySelector('[data-entry="appearance"]').click();
    const selector = root.querySelector('#phone-language-select');
    if (!selector) throw Error('缺少语言入口');
    const name = root.querySelector('#phone-font-url-name');
    if (!name) throw Error('测试必须找到真实的未保存字体表单');
    name.value = '尚未保存的字体';
    const scroll = root.querySelector('.phone-settings-scroll'); scroll.scrollTop = 120;
    if(scroll.scrollTop !== 120) throw Error('测试页面必须能实际滚动');
    selector.value = 'en'; selector.dispatchEvent(new Event('change'));
    await new Promise(resolve=>setTimeout(resolve, 50));
    if(Math.abs(root.querySelector('.phone-settings-scroll').scrollTop - 120)>1) throw Error('切换语言丢失滚动位置');
    const overflowing = [...root.querySelectorAll('.phone-settings-section, .phone-settings-btn, .phone-settings-layout-item, .phone-settings-action-row')].filter(el=>el.clientWidth>0 && el.scrollWidth>el.clientWidth+2);
    if(overflowing.length) throw Error('280px 英文布局溢出: '+overflowing.map(el=>el.className+': '+el.textContent.trim().slice(0,60)+' ['+el.clientWidth+'/'+el.scrollWidth+']').join('; '));
    if (getPhoneSettings().phoneLanguage !== 'en') throw Error('语言选择未持久化');
    if(panel.querySelector('#yuzi-phone-enabled')!==panelCheckbox || !panel.textContent.includes('Enable Yuzi Phone')) throw Error('扩展面板应原位更新标签，不重建控件');
    if(toggle.title !== 'Drag to move / Click to open' || toggle.querySelector('.yuzi-phone-toggle-text').textContent !== 'Yuzi') throw Error('悬浮入口没有同步英文');
    if(phone.querySelector('[data-yuzi-phone-home-indicator]').getAttribute('aria-label') !== 'Return to phone home') throw Error('主页手势按钮无障碍标签未翻译');
    if (!root.textContent.includes('Theme and background')) throw Error('当前页面未立即更新');
    const systemText = root.textContent.replaceAll('语言 / Language', '').replaceAll('简体中文', '');
    if (/[\u3400-\u9fff]/.test(systemText)) throw Error('外观页仍有未翻译的系统文案: ' + systemText.match(/[\u3400-\u9fff][^<]{0,50}/)?.[0]);
    if (root.querySelector('#phone-font-url-name').value !== '尚未保存的字体') throw Error('外观草稿被语言重绘丢弃');
    if (draft.value !== '未发送的草稿') throw Error('宿主草稿被修改');
    root.querySelector('.phone-nav-back').click();
    if (!root.textContent.includes('Appearance')) throw Error('重新进入系统页面未使用英文');
    dispose();
    const disposeAgain = renderSettings(root);
    if (!root.textContent.includes('Appearance')) throw Error('重新打开设置丢失语言');
    disposeAgain();
    const runtime = createQQV2ProductionRuntime({
        stateStore: createMemoryQQV2StateStore(),
        host: {
            readScope: () => ({ scopeId: 'language-ui', hostType: 'character', hostId: 'test', chatId: 'language-ui', chatFile: 'language-ui' }),
            readUserIdentity: () => ({ name: '保存' }), readStoryTime: () => '2042-05-20 09:30', readStoryMessages: () => [],
        },
        backend: { generate: async () => { throw Error('禁止调用 AI'); }, loadModels: async () => [] },
        worldbookGateway: { getCurrentCharacterBookNames: async () => ({ primary: '', additional: [] }), loadBook: async () => ({ entries: {} }), saveBook: async () => { throw Error('禁止写入世界书'); } },
    });
    await runtime.initialize();
    const facade = runtime.getFacade();
    const waitFor = async (check, description) => {
        for(let i=0;i<100;i++) { if(check()) return; await new Promise(resolve=>setTimeout(resolve, 10)); }
        throw Error('等待失败: '+description);
    };
    const presetScope = createRuntimeScope('language-presets');
    const presetPage = createAiInstructionPresetsPage({
        pageRuntime: presetScope,
        container: root, state: {}, render: () => presetPage.update(),
        qqV2PresetService: createQQV2PresetSettingsService({ getFacade: () => facade }),
    });
    presetPage.mount();
    await waitFor(() => !root.querySelector('#phone-ai-instruction-new-btn')?.disabled, '预设加载');
    const names = (await facade.query.sharedResources()).promptPresets.map(p=>p.name);
    const displayed = Array.from(root.querySelector('#phone-ai-instruction-preset-select').options).map(o=>o.textContent);
    if(!names.every(name=>displayed.some(label=>label.startsWith(name)))) throw Error('预设名称被翻译');
    root.querySelector('#phone-ai-instruction-new-btn').click();
    if(root.querySelector('#phone-ai-instruction-preset-name').value !== '新建 AI 指令预设') throw Error('英文模式改写了新预设默认名称');
    if(root.querySelector('.phone-ai-message-name').value !== '新消息块') throw Error('英文模式改写了消息块默认名称');
    root.querySelector('#phone-ai-instruction-add-message-btn').click();
    if([...root.querySelectorAll('.phone-ai-message-name')].some(n=>n.value !== '新消息块')) throw Error('添加消息块写入了译文');
    root.querySelector('#phone-ai-instruction-preset-name').value = '保存<中文&>';
    root.querySelector('.phone-ai-message-content').value = '删除 & <角色设定> {{user}}';
    root.querySelector('#phone-ai-instruction-save-btn').click();
    await waitFor(()=>!root.querySelector('#phone-ai-instruction-save-btn')?.disabled,'保存预设');
    const savedPreset = (await facade.query.sharedResources()).promptPresets.find(p=>p.name==='保存<中文&>');
    if(!savedPreset || savedPreset.messages[0].content !== '删除 & <角色设定> {{user}}' || savedPreset.messages[0].name !== '新消息块') throw Error('预设保存改变了名称、正文或占位符');
    presetPage.dispose(); presetScope.dispose();
    const person = (await facade.intent.createPrivateConversation({ name: '删除<中文&>' })).result.person;
    const other = (await facade.intent.createPrivateConversation({ name: '保存' })).result.person;
    const group = (await facade.intent.createGroupConversation({ name: '设置', memberIds: [person.personId, other.personId], ownerId: '__self__' })).result;
    const cid = group.conversation.conversationId;
    const qq = createQQApp({ facade, scopeId: 'language-ui', onError: error => { throw error; } });
    qq.mount(root);
    const click = async selector => {
        await waitFor(()=>root.querySelector(selector),selector);
        root.querySelector(selector).click();
    };
    await click('[data-qq-chat="'+cid+'"]');
    await click('[data-qq-conversation-detail="'+cid+'"]');
    await click('[data-qq-group-member-profile="'+person.personId+'"]');
    await click('[data-qq-group-member-edit="'+person.personId+'"]');
    await waitFor(()=>root.querySelector('[data-qq-group-member-action="mute"]'),'群主应仍可禁言');
    if(!root.querySelector('[data-qq-group-member-action="transfer-owner"]')) throw Error('英文标签影响群主权限');
    await click('[data-qq-group-member-action="mute"]');
    await waitFor(()=>root.querySelector('.yuzi-qq-group-mute-duration'),'禁言弹窗');
    const durations = [...root.querySelector('.yuzi-qq-group-mute-duration').options];
    if(durations[0].textContent !== '10 minutes' || durations[0].value !== '10 分钟') throw Error('禁言选项必须英文显示、原协议值提交: '+JSON.stringify(durations.map(o=>[o.textContent,o.value])));
    qq.destroy();
    const transferQQ = createQQApp({ facade, scopeId: 'language-ui' }); transferQQ.mount(root);
    await click('[data-qq-chat="'+cid+'"]');
    await click('[data-qq-tool="transfer"]');
    await waitFor(()=>root.querySelector('[aria-label="Currency"]'),'转账弹窗');
    const currency = root.querySelector('[aria-label="Currency"]');
    if(currency.value !== '人民币' || currency.options[0].textContent !== 'CNY') throw Error('货币只应翻译显示标签: '+currency.outerHTML);
    transferQQ.destroy();
    await runtime.destroy();
    shellControls.dispose(); events.dispose(); disposePhoneToggleInteractions(); destroyPhoneSettingsPanel();
    const oldText = panel.textContent, oldTitle = toggle.title;
    savePhoneSetting('phoneLanguage','zh-CN');
    if(panel.textContent !== oldText || toggle.title !== oldTitle) throw Error('卸载后仍有语言监听写入旧 UI');
    document.body.textContent = 'YUZI_LANGUAGE_PASS';
} catch(error) { document.body.textContent = 'YUZI_LANGUAGE_FAIL: ' + error.stack; } })();