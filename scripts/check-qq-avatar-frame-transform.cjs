const assert = require('node:assert/strict');

(async () => {
    const {
        AVATAR_FRAME_SCALE_MAX,
        AVATAR_FRAME_SCALE_MIN,
        moveAvatarFrameTransform,
        normalizeAvatarFrameTransform,
        scaleAvatarFrameTransform,
    } = await import('../modules/qq-v2/resources/avatar-frame-transform.js');

    assert.deepEqual(normalizeAvatarFrameTransform(), {
        x: 0,
        y: 0,
        scale: 1,
    });

    const minimum = normalizeAvatarFrameTransform({ scale: 0 });
    assert.equal(minimum.scale, AVATAR_FRAME_SCALE_MIN);
    assert.equal(minimum.x, 0);
    assert.equal(minimum.y, 0);

    const zoomed = scaleAvatarFrameTransform({ scale: 1, x: 0, y: 0 }, 1);
    assert.equal(zoomed.scale, 1.1);

    let maximum = minimum;
    for (let index = 0; index < 40; index += 1) {
        maximum = scaleAvatarFrameTransform(maximum, 1);
    }
    assert.equal(maximum.scale, AVATAR_FRAME_SCALE_MAX);

    const moved = moveAvatarFrameTransform({ scale: 1, x: 0, y: 0 }, 1, -1);
    assert.ok(Math.abs(moved.x - 1 / 12) < 1e-12);
    assert.ok(Math.abs(moved.y + 1 / 12) < 1e-12);

    const clamped = moveAvatarFrameTransform({ scale: 1, x: 0, y: 0 }, 1, 1);
    assert.ok(Math.abs(clamped.x - 1 / 12) < 1e-12);
    assert.ok(Math.abs(clamped.y - 1 / 12) < 1e-12);

    console.log('QQ avatar frame transform passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
