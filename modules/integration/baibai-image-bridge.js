import { t } from '../i18n/index.js';

/**
 * 将柏宝绘 API v1 适配为共享存图服务使用的 requestImage 合同。
 * 只取图片数据；提示词与图片归属仍由小手机管理。
 */
export function createBaiBaiImageBridge(options = {}) {
    const getApi = options.getApi || (() => globalThis.STBaiBaiImage);
    const setTimeoutImpl = options.setTimeoutImpl || globalThis.setTimeout;
    const clearTimeoutImpl = options.clearTimeoutImpl || globalThis.clearTimeout;
    const pending = new Set();
    let disposed = false;

    async function requestImage(input = {}, requestOptions = {}) {
        const requestId = String(input.id ?? '');
        const failure = (status, code, message) => ({
            ok: false,
            status,
            requestId,
            error: { code, ...(message ? { message } : {}) },
        });
        if (disposed) return failure('disposed', 'bridge-disposed');

        const api = getApi();
        if (!api) {
            return failure('unavailable', 'baibai-unavailable', t("柏宝绘未加载，请先启用柏宝绘插件。"));
        }
        if (api.apiVersion !== 1 || typeof api.generate !== 'function' || typeof api.getBackendStatus !== 'function') {
            return failure('unavailable', 'baibai-incompatible', t("柏宝绘接口版本不兼容，请更新柏宝绘插件。"));
        }
        try {
            const status = api.getBackendStatus();
            if (!status?.configured) {
                return failure('unavailable', 'not_configured', status?.reason
                    || t("柏宝绘尚未配置生图后端，请先在柏宝绘中完成配置。"));
            }
        } catch (error) {
            return failure('failed', error?.code || 'backend_error', error?.message || t("柏宝绘图片生成失败"));
        }

        const controller = new AbortController();
        const timeoutMs = Number.isFinite(Number(requestOptions.timeoutMs)) && Number(requestOptions.timeoutMs) >= 0
            ? Number(requestOptions.timeoutMs)
            : 300_000;
        return new Promise((resolve) => {
            let settled = false;
            let timeoutId = null;
            const finish = (result) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) clearTimeoutImpl(timeoutId);
                pending.delete(cancel);
                resolve(result);
            };
            const cancel = () => {
                finish(failure('disposed', 'bridge-disposed'));
                controller.abort();
            };
            pending.add(cancel);
            timeoutId = setTimeoutImpl(() => {
                finish(failure('timeout', 'generation-timeout', t("柏宝绘图片生成超时，已请求取消。")));
                controller.abort();
            }, timeoutMs);

            Promise.resolve().then(() => {
                if (settled) return null;
                return api.generate({
                    prompt: typeof input.prompt === 'string' ? input.prompt : '',
                    ...(input.negative_prompt ? { negative: input.negative_prompt } : {}),
                    save: false,
                }, { signal: controller.signal });
            }).then((result) => {
                if (settled) return;
                if (typeof result?.dataUrl !== 'string' || !result.dataUrl.trim()) {
                    finish(failure('invalid-response', 'missing-image-data', t("柏宝绘没有返回可显示的图片")));
                    return;
                }
                finish({
                    ok: true,
                    status: 'generated',
                    requestId,
                    imageData: result.dataUrl,
                    format: typeof result.format === 'string' ? result.format : '',
                });
            }, (error) => {
                finish(error?.code === 'aborted'
                    ? failure('cancelled', 'generation-cancelled', t("柏宝绘图片生成已取消"))
                    : failure('failed', error?.code || 'backend_error', error?.message || t("柏宝绘图片生成失败")));
            });
        });
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        for (const cancel of pending) cancel();
    }

    return Object.freeze({ requestImage, dispose });
}
