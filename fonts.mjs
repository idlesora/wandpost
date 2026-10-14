#!/usr/bin/env node
// 检测这台电脑上有哪些推荐字体（清单在 fonts.json），排版前先跑一次。
//
// 用法：node fonts.mjs            看哪些推荐字体可用，以及可以直接抄的 CSS 字体栈
//       node fonts.mjs --json     输出 JSON
//
// 判断方法：在 Chromium 里用 canvas 量同一段文字的宽度，和后备字体对比，宽度不同说明这款字体存在。
// 所以结果就是渲染时真正能用到的字体，系统字体和 fonts/ 目录里的都算。

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listLocalFonts, localFontCss } from './fontlib.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(await fs.readFile(path.join(root, 'fonts.json'), 'utf8'));
const groups = Object.entries(catalog).filter(([, v]) => Array.isArray(v));
const asJson = process.argv.includes('--json');
const local = await listLocalFonts();

const browser = await chromium.launch();
const page = await browser.newPage();
// about:blank 不能加载 file:// 的字体，所以先打开一个本地文件
await page.goto(pathToFileURL(path.join(root, 'fonts.json')).href);
const localCss = await localFontCss();
if (localCss) await page.addStyleTag({ content: localCss });
await Promise.all(local.map((f) => page.evaluate((n) => document.fonts.load(`16px "${n}"`), f.family)));

const names = [...new Set(groups.flatMap(([, v]) => v).flatMap((f) => [f.family, ...f.probe]).concat(local.map((f) => f.family)))];
const found = await page.evaluate((names) => {
  const ctx = document.createElement('canvas').getContext('2d');
  const text = 'Hamburgefonstiv 0123 字体排版测试';
  const width = (font) => { ctx.font = `72px ${font}`; return ctx.measureText(text).width; };
  const bases = ['monospace', 'serif', 'sans-serif'];
  const baseW = Object.fromEntries(bases.map((b) => [b, width(b)]));
  return names.filter((n) => bases.some((b) => width(`"${n}", ${b}`) !== baseW[b]));
}, names);
await browser.close();

const localNames = new Set(local.map((f) => f.family));
const result = {};
for (const [lang, list] of groups) {
  result[lang] = list.map((f) => {
    const hit = [f.family, ...f.probe].find((n) => found.includes(n));
    return { ...f, available: Boolean(hit), source: !hit ? null : localNames.has(hit) ? 'fonts/' : '系统' };
  });
}
const extra = local.filter((f) => !Object.values(result).flat().some((r) => r.family === f.family));

if (asJson) {
  console.log(JSON.stringify({ ...result, localOnly: extra.map((f) => f.family) }, null, 2));
} else {
  const title = { zh: '中文', ja: '日文', ko: '韩文', en: '英文（含法语、西语、德语等拉丁字母语言）' };
  for (const [lang, list] of Object.entries(result)) {
    console.log(`\n${title[lang] ?? lang}`);
    for (const f of list) {
      console.log(`${f.available ? '✓' : '✗'} ${f.label}（${f.role}，${f.vibe}；适合 ${f.themes.join('/')}）${f.available ? ` [${f.source}]` : ` 获取：${f.get}`}`);
      if (f.available) console.log(`    ${f.stack}`);
    }
  }
  if (extra.length) console.log(`\nfonts/ 里的其他字体：${extra.map((f) => f.family).join('、')}（文件名就是 font-family 名）`);
  console.log('\n没有的字体不用装也能出图，排版时保持主题默认字体即可。');
}
