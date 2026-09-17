const assert = require('node:assert/strict');
const { FakeElement } = require('./helpers/qq-ui-fixture.cjs');
(async () => {
  const { decorateQQAvatar, decorateQQBubble } = await import('../modules/qq-v2/ui/appearance.js');
  const avatar = new FakeElement('button'); avatar.style.setProperty = (key, value) => { avatar.style[key] = value; };
  decorateQQAvatar(avatar, 'blob:frame');
  assert.equal(avatar.getAttribute('data-qq-avatar-frame'), '');
  assert.equal(avatar.style['--yuzi-qq-avatar-frame-image'], 'url("blob:frame")');
  assert.equal(avatar.children.length, 0, 'Frame does not replace original avatar children or click target');
  const group = new FakeElement('span'); group.classList.add('yuzi-qq-group-avatar-member');
  decorateQQAvatar(group, 'blob:frame'); assert.equal(group.hasAttribute('data-qq-avatar-frame'), false);
  const bubble = new FakeElement('span');
  decorateQQBubble(bubble, 'blob:bubble', { padding: 12, slice: 20, textColor: '#123456' });
  assert.equal(bubble.style.color, '#123456');
  assert.equal(bubble.style.borderImageSlice, '20 fill');
  assert.equal(bubble.textContent, '', 'Applying material does not touch the message body');
  console.log('QQ personal appearance renderer passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
