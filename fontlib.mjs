// 本地字体共用逻辑：render.mjs 和 fonts.mjs 都用它。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fontDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const formats = { '.ttf': 'truetype', '.otf': 'opentype', '.woff': 'woff', '.woff2': 'woff2' };

// fonts/ 里的字体文件。MyFont-700.ttf 表示 family "MyFont"、字重 700，没写数字就是 400。
export async function listLocalFonts() {
  const names = await fs.readdir(fontDir).catch(() => []);
  return names
    .filter((f) => formats[path.extname(f).toLowerCase()])
    .map((f) => {
      const ext = path.extname(f);
      const m = path.basename(f, ext).match(/^(.+)-(\d{3})$/);
      const [family, weight] = m ? [m[1], m[2]] : [path.basename(f, ext), '400'];
      return { file: f, family, weight, url: pathToFileURL(path.join(fontDir, f)).href, format: formats[ext.toLowerCase()] };
    });
}

export async function localFontCss() {
  return (await listLocalFonts())
    .map((f) => `@font-face{font-family:"${f.family}";font-weight:${f.weight};src:url("${f.url}") format("${f.format}");font-display:block}`)
    .join('\n');
}
