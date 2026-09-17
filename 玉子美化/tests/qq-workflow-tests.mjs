import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildBundle, validateBundle } from '../tools/lib.mjs';
import { addProjectQQ, checkWorkflowProject, createProject, getProjectStatus } from '../tools/project-lib.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yuzi-qq-workflow-'));
try {
  const created = await createProject({ projectsDir: root, id: 'qq-only', name: '纯 QQ 美化' });
  const projectRoot = path.dirname(created.projectFile);
  await fs.mkdir(path.join(projectRoot, 'qq'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'qq/theme.css'), ':scope { --yuzi-qq-accent: #c05a8a; background-image: url(../assets/decor.png); }');
  await fs.writeFile(path.join(projectRoot, 'qq/theme-dark.css'), ':scope { --yuzi-qq-accent: #f0a9c7; }');
  await fs.writeFile(path.join(projectRoot, 'qq/popup.css'), ':scope { border: 1px solid #c05a8a; }');
  await fs.writeFile(path.join(projectRoot, 'assets/decor.png'), Buffer.from([9, 8, 7]));
  await fs.writeFile(path.join(projectRoot, 'assets/frame.png'), Buffer.from([1, 2, 3]));
  await fs.writeFile(path.join(projectRoot, 'assets/bubble.png'), Buffer.from([4, 5, 6]));

  const result = await addProjectQQ({
    projectFile: created.projectFile,
    theme: { css: 'qq/theme.css', darkCss: 'qq/theme-dark.css' },
    popup: { css: 'qq/popup.css' },
    assets: ['assets/decor.png'],
    resources: [
      { id: 'sakura-frame', library: 'avatar-frame', file: 'assets/frame.png' },
      { id: 'sakura-bubble', library: 'bubble', file: 'assets/bubble.png', bubble: { padding: 12, slice: 18, textColor: '#4a2540' } },
    ],
    outfits: [{ id: 'sakura', avatarFrame: 'sakura-frame', bubble: 'sakura-bubble' }],
  });
  assert.equal(result.qq.outfits[0].id, 'sakura');

  const draft = await checkWorkflowProject(created.projectFile, { mode: 'draft' });
  assert.equal(draft.ok, true, draft.errors.join(' | '));
  const provisional = await checkWorkflowProject(created.projectFile, { mode: 'release', requireConfirmation: false });
  assert.equal(provisional.ok, true, provisional.errors.join(' | '));
  await getProjectStatus({ projectFile: created.projectFile, confirm: true });
  const release = await checkWorkflowProject(created.projectFile, { mode: 'release', requireConfirmation: true });
  assert.equal(release.ok, true, release.errors.join(' | '));

  const bundle = await buildBundle(created.projectFile);
  assert.equal(bundle.formatVersion, 3);
  assert.deepEqual(bundle.manifest.qq.outfits, [{ id: 'sakura', avatarFrame: 'sakura-frame', bubble: 'sakura-bubble' }]);
  assert.equal(bundle.files['assets/frame.png'].encoding, 'base64');
  assert.equal(bundle.files['assets/decor.png'].encoding, 'base64');
  assert.equal(validateBundle(bundle, { strict: true, tables: [] }).ok, true);
  assert.equal(bundle.manifest.items.length, 0);
  assert.deepEqual(bundle.manifest.displays, []);

  const example = await buildBundle(new URL('../examples/qq-beautify/project.json', import.meta.url));
  assert.equal(example.manifest.qq.theme.darkCss, 'qq/theme-dark.css');
  assert.equal(validateBundle(example, { strict: true, tables: [] }).ok, true);
  console.log('[qq-workflow-tests] passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
