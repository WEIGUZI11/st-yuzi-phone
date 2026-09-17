import { prepareQQSkin } from './qq-skin.js';
import { getQQV2Facade } from '../qq-v2/runtime/default-runtime.js';
import { decorateQQAvatar } from '../qq-v2/ui/appearance.js';

export async function prepareQQNotificationAppearance(item) {
    if (item.kind !== 'message-notification' || item.sourceId !== 'qq') return null;
    const skin = await prepareQQSkin('popup');
    const facade = getQQV2Facade();
    let frame = null;
    try {
        if (item.avatarFrameAssetId) frame = await facade?.query?.mediaRender({ assetId: item.avatarFrameAssetId });
        return {
            apply(element, avatar) {
                skin?.apply(element);
                if (avatar && frame?.ok && frame.render?.url) decorateQQAvatar(avatar, frame.render.url);
            },
            dispose() {
                skin?.dispose();
                if (frame?.render?.leaseId) void facade?.intent?.releaseMediaRender({ leaseId: frame.render.leaseId });
            },
        };
    } catch (error) { skin?.dispose(); throw error; }
}
