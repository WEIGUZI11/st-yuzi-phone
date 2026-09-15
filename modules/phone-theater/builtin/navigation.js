import { buildPhoneBackButton, buildPhoneSwitchButton, buildPhoneNavTitleSwitcher, buildPhoneNavBar } from '../../phone-core/navigation-ui.js';

/** Built-in pages retain their actions, but share the phone's navigation geometry. */
export function buildBuiltinTheaterNav(sceneId, title) {
    const switchButton = (direction, action, suffix, label) => buildPhoneSwitchButton(direction, {
        action, label, attributes: { id: `yuzi-theater-${sceneId}-${suffix}` },
    });
    return buildPhoneNavBar({
        className: 'yuzi-phone-theater-nav',
        leadingHtml: buildPhoneBackButton({ action: 'back', label: '返回上一层' }),
        centerHtml: buildPhoneNavTitleSwitcher({
            title,
            previousHtml: switchButton('previous', 'previousTable', 'prev', '上一张表'),
            nextHtml: switchButton('next', 'nextTable', 'next', '下一张表'),
        }),
        trailingHtml: '<button type="button" class="phone-nav-icon-button" data-action="editCurrentTable" aria-label="编辑当前表" title="编辑当前表"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20H5a1 1 0 0 1-1-1v-7 M16.5 3.5a2.1 2.1 0 0 1 3 3L10 16l-6 1 1-4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>',
    });
}
