#!/usr/bin/env node
// 把 posts/ 下的 HTML 渲染成图片（以及可选的 PDF）。
//
// 用法：
//   node render.mjs posts/2026-10-14-demo/xhs.html [更多 html...] [--pdf] [--guides] [--scale=2]
//
// HTML 约定：<body data-size="xhs">，每一页是一个 <section class="page">。
// 输出：同目录下 out/<html 文件名>/01.png, 02.png ...；--pdf 额外输出 out/<名>.pdf。
// fonts/ 目录里的 .ttf .otf .woff .woff2 会自动注册：文件名就是 font-family 名，
// 文件名末尾加 -粗细数字（如 MyFont-700.ttf）可指定字重，默认 400。
// --guides 把安全区用红色半透明标出来，输出到 out/<名>-guides/，只用于检查，不要发布。

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localFontCss } from './fontlib.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const sizes = JSON.parse(await fs.readFile(path.join(root, 'sizes.json'), 'utf8'));

const localFontCssText = await localFontCss();

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const wantPdf = args.includes('--pdf');
const guides = args.includes('--guides');
const scale = Number(args.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1);

if (files.length === 0) {
  console.error('用法: node render.mjs <html...> [--pdf] [--guides] [--scale=2]');
  process.exit(1);
}

const browser = await chromium.launch();
let hadWarnings = false;

for (const file of files) {
  const abs = path.resolve(file);
  const name = path.basename(abs, '.html');
  const outRoot = path.join(path.dirname(abs), 'out');

  // 先用默认视口打开，读出 data-size 再按尺寸重开
  const probe = await browser.newPage();
  await probe.goto(pathToFileURL(abs).href);
  const sizeKey = await probe.evaluate(() => document.body.dataset.size);
  await probe.close();

  const size = sizes[sizeKey];
  if (!size) {
    console.error(`✗ ${file}: body 的 data-size="${sizeKey}" 不在 sizes.json 里`);
    hadWarnings = true;
    continue;
  }
  const [st, sr, sb, sl] = size.safe;

  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(abs).href, { waitUntil: 'networkidle' });
  if (localFontCssText) await page.addStyleTag({ content: localFontCssText });
  await page.addStyleTag({
    content: `:root{--w:${size.w}px;--h:${size.h}px;--safe-top:${st}px;--safe-right:${sr}px;--safe-bottom:${sb}px;--safe-left:${sl}px}
@page{size:${size.w}px ${size.h}px;margin:0}`,
  });
  if (guides) await page.evaluate(() => document.body.classList.add('guides'));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });

  const warnings = await page.evaluate(checkLayout, { safe: size.safe });
  const pages = await page.$$('.page');

  const dir = path.join(outRoot, guides ? `${name}-guides` : name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(dir, `${String(i + 1).padStart(2, '0')}.png`) });
  }

  // 总览图：所有页缩小拼在一张图上，自检时一次看完。放在 out/ 根下，不和要发布的图混在一起
  const sheetPath = path.join(outRoot, `${path.basename(dir)}-sheet.png`);
  await writeSheet(browser, dir, pages.length, size, sheetPath);

  if (wantPdf && !guides) {
    await page.pdf({
      path: path.join(outRoot, `${name}.pdf`),
      width: `${size.w}px`,
      height: `${size.h}px`,
      printBackground: true,
    });
  }

  console.log(`✓ ${file} → ${path.relative(process.cwd(), dir)}/ （${size.label}，${pages.length} 页，${size.w * scale}×${size.h * scale}）`);
  console.log(`  总览：${path.relative(process.cwd(), sheetPath)}`);
  if (pages.length > size.maxPages) {
    warnings.push(`共 ${pages.length} 页，超过 ${size.label} 的上限 ${size.maxPages} 页`);
  }
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  if (warnings.length) hadWarnings = true;

  await context.close();
}

await browser.close();
process.exit(hadWarnings ? 2 : 0);

async function writeSheet(browser, dir, count, size, outPath) {
  const cols = Math.min(count, 5);
  const thumbW = 600;
  const thumbH = Math.round((thumbW * size.h) / size.w);
  const gap = 24;
  const rows = Math.ceil(count / cols);
  const imgs = Array.from({ length: count }, (_, i) => {
    const src = pathToFileURL(path.join(dir, `${String(i + 1).padStart(2, '0')}.png`)).href;
    return `<figure><img src="${src}"><figcaption>${i + 1}</figcaption></figure>`;
  }).join('');
  const width = cols * thumbW + (cols + 1) * gap;
  const height = rows * (thumbH + 44) + (rows + 1) * gap;
  const page = await browser.newPage({ viewport: { width, height } });
  const tmp = outPath.replace(/\.png$/, '.html');
  await fs.writeFile(tmp, `<style>
    body{margin:0;background:#8a8a8a;display:grid;grid-template-columns:repeat(${cols},${thumbW}px);gap:${gap}px;padding:${gap}px;font:600 24px sans-serif;color:#fff}
    figure{margin:0} img{display:block;width:${thumbW}px;height:${thumbH}px} figcaption{height:44px;line-height:44px}
  </style>${imgs}`);
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: outPath });
  await page.close();
  await fs.rm(tmp);
}

// 在页面里运行：找出超出画布、被裁切、或压进安全区的文字
function checkLayout({ safe }) {
  const [st, sr, sb, sl] = safe;
  const out = [];
  const label = (el) => {
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return `<${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}> "${text.slice(0, 20)}${text.length > 20 ? '…' : ''}"`;
  };

  document.querySelectorAll('.page').forEach((pg, i) => {
    const n = i + 1;
    const box = pg.getBoundingClientRect();
    // 只检查直接包含文字的元素；加了 .deco 的装饰元素允许出血、压进遮挡区
    const textEls = [...pg.querySelectorAll('*')].filter((el) =>
      !el.closest('.deco') &&
      [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()),
    );
    for (const el of textEls) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
        out.push(`第 ${n} 页：${label(el)} 超出画布`);
        continue;
      }
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== 'visible') {
        out.push(`第 ${n} 页：${label(el)} 文字被裁切`);
      }
      if (st + sr + sb + sl > 0) {
        const inSafe =
          r.top >= box.top + st - 1 && r.bottom <= box.bottom - sb + 1 &&
          r.left >= box.left + sl - 1 && r.right <= box.right - sr + 1;
        if (!inSafe) out.push(`第 ${n} 页：${label(el)} 进入了平台 UI 遮挡区`);
      }
    }
  });
  return out;
}
