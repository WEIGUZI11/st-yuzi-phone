import { t } from '../../i18n/index.js';
export function createBeautifyPageBehavior(params = {}, deps = {}) {
    const { container, runtime, waitForCommittedRefresh, onBack } = params;
    const { contentPresetWorkshopService: service, downloadTextFile, showConfirmDialog, showToast } = deps;
    let busy = false;
    const isDisposed = () => runtime?.isDisposed?.() === true;
    const notify = (message, isError = false) => showToast?.(container, message, isError, runtime);

    const run = async (button, operation, successMessage) => {
        if (busy || isDisposed()) return;
        busy = true;
        if (button) button.disabled = true;
        try {
            await operation();
            if (isDisposed()) return;
            await waitForCommittedRefresh?.();
            if (isDisposed()) return;
            notify(successMessage);
        } catch (error) {
            if (!isDisposed()) notify(error?.message || t("操作失败"), true);
        } finally {
            busy = false;
            if (button?.isConnected) button.disabled = false;
        }
    };

    const confirm = (title, message, confirmText, operation, onCancel) => {
        showConfirmDialog?.(container, title, message, operation, confirmText, t("取消"), runtime, { onCancel });
    };

    const runPopupApplication = async (select, sheetKey, presetId) => {
        if (busy || isDisposed()) return;
        busy = true;
        if (select) select.disabled = true;
        try {
            await service.setPopupActive(sheetKey, presetId);
            if (isDisposed()) return;
            await waitForCommittedRefresh?.();
            if (isDisposed()) return;
            notify(t("已设为当前弹窗美化"));
        } catch (error) {
            if (error?.code === 'CONTENT_PRESET_POPUP_REPLACE_CONFIRMATION_REQUIRED') {
                confirm(
                    t("需要整体替换组合展示"),
                    t("这套弹窗美化会同时应用到关联表。确认后会一起替换关联表当前的弹窗美化，避免组合只生效一半。"),
                    t("确认一起替换"),
                    () => run(
                        select,
                        () => service.setPopupActive(sheetKey, presetId, { replace: true }),
                        t("已设为当前弹窗美化"),
                    ),
                    () => {
                        if (select?.isConnected) select.value = String(select.dataset?.contentPresetCurrentValue || '');
                    },
                );
            } else if (!isDisposed()) {
                notify(error?.message || t("操作失败"), true);
            }
        } finally {
            busy = false;
            if (select?.isConnected) select.disabled = false;
        }
    };

    const importFile = async (button) => {
        if (busy || isDisposed()) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file || isDisposed()) return;
            try {
                const prepared = await service.prepareImport(await file.text());
                if (isDisposed()) return;
                const commit = () => run(button, () => service.importPrepared(prepared, prepared.replacesExisting), prepared.replacesExisting ? t("预设已原子覆盖，旧绑定已清除") : t("预设已导入"));
                const materials = prepared.record.qq?.resources || [];
                const materialSummary = materials.length ? t`将追加保留 ${materials.length} 个 QQ 素材和 ${prepared.record.qq?.outfits?.length || 0} 套装饰；相同素材不重复入库。` : '';
                if (prepared.replacesExisting) {
                    confirm(t("覆盖同 ID 预设？"), t`预设 ${prepared.record.id} 已存在。覆盖会原子清除引用它的表格及 QQ 应用绑定，不删除已收入 QQ 图库的素材。` + materialSummary, t("确认覆盖"), commit);
                } else if (materials.length) {
                    confirm(t('导入 QQ 美化素材？'), materialSummary + '\n' + materials.map(item => item.library + ' / ' + item.id).join('\n'), t('确认导入'), commit);
                } else {
                    await commit();
                }
            } catch (error) {
                if (!isDisposed()) notify(t`导入失败：${error?.message || t("文件无效")}`, true);
            }
        }, { once: true });
        input.click();
    };

    const handleApplicationChange = (select) => {
        const qqKind = select?.dataset?.qqPresetApplication;
        if (qqKind) {
            void run(select, () => service.setQQActive(qqKind, select.value), t('QQ 美化应用已更新'));
            return;
        }
        const application = String(select?.dataset?.contentPresetApplication || '');
        if (application !== 'page' && application !== 'popup') return;
        const sheetKey = String(select?.dataset?.sheetKey || '');
        const selected = select?.selectedOptions?.[0];
        const presetId = String(selected?.dataset?.presetId || '');
        const itemId = String(selected?.dataset?.itemId || '');
        const isPage = application === 'page';
        const setActive = isPage
            ? (service?.setPageActive || service?.setActive)
            : service?.setPopupActive;
        const clearActive = isPage
            ? (service?.clearPageActive || service?.clearActive)
            : service?.clearPopupActive;
        const label = isPage ? t("页面美化") : t("弹窗美化");
        const clearLabel = isPage ? t("该表已恢复默认页面") : t("该表已恢复内置展示");
        if (!sheetKey || typeof (select?.value ? setActive : clearActive) !== 'function') {
            notify(t`${label}暂不可用`, true);
            return;
        }
        if (!select.value) {
            void run(select, () => clearActive(sheetKey), clearLabel);
            return;
        }
        if (!presetId || (!isPage && !presetId) || (isPage && !itemId)) {
            notify(t("所选美化预设无效"), true);
            return;
        }
        if (isPage) {
            void run(select, () => setActive(sheetKey, presetId, itemId), t`已设为当前${label}`);
            return;
        }
        void runPopupApplication(select, sheetKey, presetId);
    };

    const handleAction = (button) => {
        const action = button.dataset.action;
        const { presetId, itemId, sheetKey } = button.dataset;
        if (action === 'import') return void importFile(button);
        if (action === 'export') return void run(button, async () => {
            const result = await service.exportPreset(presetId);
            downloadTextFile(result.filename, result.text, result.mimeType);
        }, t("预设已导出"));
        if (action === 'delete') return confirm(t("删除完整预设？"), t`将删除预设 ${presetId}，并原子清除引用它的表格及 QQ 应用绑定；已收入 QQ 图库的素材仍保留。`, t("确认删除"), () => run(button, () => service.deletePreset(presetId), t("预设已删除")));
        if (action === 'activate') return void run(button, () => service.setActive(sheetKey, presetId, itemId), t("已设为当前美化"));
        if (action === 'clear') return void run(button, () => service.clearActive(sheetKey), t("该表已恢复默认展示"));
        if (action === 'clear-all-page' || action === 'clear-all') return confirm(t("全部恢复页面默认？"), t("将清除全部表格美化应用，但保留弹窗应用和已导入预设。"), t("确认清除"), () => run(button, () => (service.clearAllPageActive || service.clearAllActive)(), t("全部页面已恢复默认展示")));
        if (action === 'clear-all-popup') return confirm(t("全部清空弹窗应用？"), t("将移除全部自定义弹窗应用，但保留页面美化、内置展示和已导入预设。"), t("确认清除"), () => run(button, () => service.clearAllPopupActive(), t("全部弹窗应用已清空")));
    };

        const attachPageInteractions = () => {
        const handleClick = (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('.phone-nav-back')) {
                onBack?.();
                return;
            }
            const button = target.closest('[data-action]');
            if (button instanceof HTMLButtonElement) handleAction(button);
        };
        container?.addEventListener?.('click', handleClick);
        const handleChange = (event) => handleApplicationChange(event?.target);
        container?.addEventListener?.('change', handleChange);
        return () => {
            container?.removeEventListener?.('click', handleClick);
            container?.removeEventListener?.('change', handleChange);
        };
    };

    return { attachPageInteractions };
}
