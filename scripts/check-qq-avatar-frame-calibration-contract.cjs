const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(
    path.join(ROOT, 'styles/phone-base/08-image-crop.css'),
    'utf8',
);

function sourceSlice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    return source.slice(start, end < 0 ? source.length : end);
}

function main() {
    const mask = sourceSlice(
        css,
        '.phone-avatar-frame-calibration-mask',
        '.phone-avatar-frame-calibration-guide',
    );
    const guide = sourceSlice(
        css,
        '.phone-avatar-frame-calibration-guide',
        '.phone-avatar-frame-calibration-zoom',
    );

    assert.match(mask, /inset:\s*10%/,
        '头像参考区域应缩小到预览区内部');
    assert.match(mask, /box-shadow:\s*var\(--yuzi-phone-crop-box-overlay-shadow\)/,
        '圆外遮罩应复用共享裁剪遮罩，不在圆内制造填充');
    assert.doesNotMatch(mask, /radial-gradient/,
        '头像校准遮罩不应再用渐变制造额外环形边缘');
    assert.match(guide, /inset:\s*10%/,
        '头像参考线必须与缩小后的参考区域对齐');
    assert.doesNotMatch(guide, /box-shadow/,
        '头像参考线不得再叠加内外环阴影');

    console.log('[qq-avatar-frame-calibration-contract] passed');
}

try {
    main();
} catch (error) {
    console.error('[qq-avatar-frame-calibration-contract] failed');
    console.error(error);
    process.exitCode = 1;
}
