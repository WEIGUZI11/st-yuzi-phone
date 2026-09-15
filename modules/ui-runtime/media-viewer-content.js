import { t } from '../i18n/index.js';
/** Shared by QQ and native table canvases. Text stays text; image paths are host-owned. */
export function createMediaViewerContent({imagePath='', description='', type='image'} = {}, doc=document) {
    const element=(tag,className)=>{const node=doc.createElement(tag);node.className=className;return node;};
    const viewer=element('div','yuzi-qq-image-viewer' + (imagePath ? '' : ' is-description-only'));
    if(imagePath) {
        const visual=element('div','yuzi-qq-image-viewer-visual has-image');
        const image=element('img','yuzi-qq-image-viewer-image');image.src=imagePath;image.alt=description || t("图片消息");
        visual.append(image);viewer.append(visual);
    }
    const copy=element('p','yuzi-qq-image-viewer-description');copy.textContent=description || (type === 'video' ? t("视频消息"):t("图片消息"));
    viewer.append(copy);return viewer;
}
