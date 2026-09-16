import { Logger } from '../error-handler.js';

// 只保存观察到的更新锚点，不复制数据库逐表历史，也不按事件次数累加。
const KEY = 'yuziTableUpdateReviewAnchor';
const isAi = message => !!message && message.is_user !== true && message.is_system !== true;
const stamp = message => String(message?.send_date ?? '');
const swipe = message => Number(message?.swipe_id) || 0;

export function readUnupdatedFloorCount(context) {
    const chat = context?.chat;
    const anchor = context?.chatMetadata?.[KEY];
    if (!Array.isArray(chat) || !Number.isInteger(anchor?.floorId) || anchor.floorId < 0) return null;
    const message = chat[anchor.floorId];
    // 删除/换分支使锚点失效时显示未知，不把另一条回复误认为已更新。
    if (!isAi(message) || stamp(message) !== anchor.sendDate || swipe(message) !== anchor.swipeId) return null;
    let count = 0;
    for (let index = anchor.floorId + 1; index < chat.length; index++) {
        if (isAi(chat[index])) count++;
    }
    return count;
}

export function recordTableUpdateFloor(context, floorId) {
    const message = context?.chat?.[floorId];
    const metadata = context?.chatMetadata;
    if (!Number.isInteger(floorId) || floorId < 0 || !isAi(message) || !metadata || typeof metadata !== 'object') return;
    const anchor = { floorId, sendDate: stamp(message), swipeId: swipe(message) };
    const previous = metadata[KEY];
    if (previous?.floorId === anchor.floorId && previous.sendDate === anchor.sendDate && previous.swipeId === anchor.swipeId) return;
    metadata[KEY] = anchor;
    // 复用宿主的聊天元数据保存；存储失败不能打断审核数据链。
    const failed = error => Logger.warn('[玉子手机] 保存审核更新楼层记录失败:', error);
    try { Promise.resolve(context.saveMetadataDebounced?.()).catch(failed); } catch (error) { failed(error); }
    return true;
}
