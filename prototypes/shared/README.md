# 设置二级页原型公共件

静态原型专用，不参与构建。样式来自已验收的 `../appearance-ios-grouped.html`，类名保持一致。每个二级页原型只写自己的内容，外壳、配色、控件和弹层都从这里引用。

## 引用方式

```html
<link rel="stylesheet" href="./shared/ios-settings.css">
<!-- 页面内容…… -->
<script src="./shared/ios-settings.js"></script>
<script>/* 本页交互，调用 window.YZ */</script>
```

## 页面骨架

```html
<div class="toolbar"><span>原型预览：</span><button type="button" id="toggle-theme">切换白天 / 夜间</button></div>
<div class="phone">
    <div class="island" aria-hidden="true"></div>
    <div class="status" aria-hidden="true"><span>12:55</span><span class="status-icons">▂▄▆ ◔ ▭</span></div>
    <header class="nav">
        <button type="button" class="nav-back" aria-label="返回设置">‹ 设置</button>
        <h1 class="nav-title" style="margin:0">页面标题</h1>
    </header>
    <main class="scroll">
        <h2 class="group-header">分组标题</h2>
        <section class="group">……</section>
        <p class="group-footer">分组说明</p>
    </main>
    <div class="home-bar" aria-hidden="true"></div>
</div>
```

自动生效（无需写脚本）：`#toggle-theme` 切换白天 / 夜间；`.seg` 分段控件单选（并派发 `yz:seg` 事件）；`.stepper` 步进器按 `data-min / data-max / data-step / data-unit` 加减；`[data-toast]` 点击弹出轻提示；`.disabled-row` 或 `aria-disabled="true"` 内的点击被忽略。


## API（window.YZ）

弹层统一挂在 `.phone` 内，同一时间只开一个；点遮罩、按 Esc、点取消都会关闭，关闭后焦点回到触发元素，打开期间 `.phone` 内其他内容设为 `inert`。标题、选项等文本会转义，只有 `thumbHtml` / `captionHtml` / `bodyHtml` 原样插入，请只放可信内容。

```js
YZ.toast('已保存');

YZ.sheet({
    title: '选择语言',
    groups: [{ header: '常用', options: [
        { value: 'zh', label: '简体中文', selected: true },
        { value: 'en', label: 'English', sub: '英语', badge: '测试' },
    ] }],
    footer: '切换后立即生效。',
    onSelect: (value, option) => YZ.toast(`已切换为 ${option.label}`),
});

YZ.formSheet({
    title: '编辑名称',
    bodyHtml: '<div class="group"><div class="row block"><span class="field-label">名称</span><textarea class="field" name="name"></textarea></div></div>',
    onMount: (rootEl) => { rootEl.querySelector('[name=name]').value = '玉子'; },
    onDone: (rootEl) => {
        const value = rootEl.querySelector('[name=name]').value.trim();
        if (!value) { YZ.toast('名称不能为空'); return false; } // 返回 false 保持打开
        YZ.toast(`已保存：${value}`);
    },
});

YZ.actionSheet({
    title: '「QQ」图标',
    captionHtml: '<i style="background:#5B7A6A">Q</i>',
    actions: [
        { label: '从相册选择', onSelect: () => YZ.crop({ title: '裁剪 QQ', aspect: '1 / 1', onConfirm: () => YZ.toast('图标已更新') }) },
        { label: '从美化包选择', disabled: true },
        { label: '恢复默认图标', danger: true, onSelect: () => YZ.toast('已恢复') },
    ],
});

YZ.confirm({ title: '清除背景？', message: '清除后恢复默认壁纸。', confirmText: '清除', onConfirm: () => YZ.toast('背景已清除') });

YZ.alert({ title: '导入失败', message: '文件格式不正确。' });

YZ.crop({
    title: '裁剪背景图',
    desc: '可自由调整背景可见区域，确认后再保存。',
    aspect: '3 / 4',
    onConfirm: ({ x, y, w, h, width, height }) => YZ.toast(`选区 ${width} × ${height} px`),
});
```

- `sheet`：点选后立即打勾，约 180ms 自动收起，再回调 `onSelect(value, option)`。
- `formSheet`：`rootEl` 是承载 `bodyHtml` 的 `.sheet-body`；`onDone` 返回 `false` 时不关闭。
- `actionSheet`：先收起再执行 `onSelect`，回调里可直接打开下一个弹层。
- `confirm`：`danger` 默认 `true`（确认按钮红色）；默认聚焦「取消」；遮罩 / Esc 关闭视同取消（触发 `onCancel`）。
- `crop`：`aspect` 是模拟图片比例，选区自由调整（与原型一致）；`onConfirm` 收到 0–1 比例的 `x / y / w / h` 与按模拟原图换算的 `width / height`。

## 补充组件类名

`.row.block` `.field-label` `textarea.field(.mono)` `.row select.inline` `.row-actions` `.mini-btn(.primary/.danger)` `.search-row` `.empty` `.status-line(.error)` `.chip-list` `.chip` `.preview-box(.mono)` `.image-preview` `.card-title-row` `.kbd` `.disabled-row`
