import process from 'node:process';
import { addProjectQQ, parseCliArgs, printCliResult, promptForMissing } from './project-lib.mjs';

const options = parseCliArgs(process.argv.slice(2), {
  repeatable: ['asset', 'resource', 'outfit'],
  boolean: ['replace', 'dry-run', 'json'],
});
options.project ||= options._[0];
await promptForMissing(options, [{ key: 'project', label: 'project.json 路径' }]);
function parseJson(values, label) {
  return (values || []).map((value, index) => {
    try { return JSON.parse(value); }
    catch { throw new Error(`--${label}[${index + 1}] 必须是 JSON 对象`); }
  });
}
const theme = options['theme-css'] ? { css: options['theme-css'], ...(options['theme-dark-css'] ? { darkCss: options['theme-dark-css'] } : {}) } : undefined;
const popup = options['popup-css'] ? { css: options['popup-css'], ...(options['popup-dark-css'] ? { darkCss: options['popup-dark-css'] } : {}) } : undefined;
const resources = parseJson(options.resource, 'resource');
const outfits = parseJson(options.outfit, 'outfit');
if (!theme && !popup && resources.length === 0) throw new Error('至少提供 --theme-css、--popup-css 或一个 --resource');
const result = await addProjectQQ({
  projectFile: options.project,
  theme,
  popup,
  ...(options.asset?.length ? { assets: options.asset } : {}),
  ...(resources.length ? { resources } : {}),
  ...(outfits.length ? { outfits } : {}),
  replace: Boolean(options.replace),
  dryRun: Boolean(options['dry-run']),
});
printCliResult({ ...result, message: `${result.dryRun ? '计划登记' : '已登记'} QQ 美化能力` }, { json: options.json });
