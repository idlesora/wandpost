# 开发指南

给想改造、扩展或贡献 postsmith 的人。只想用的话，看 [README](../README.md) 就够了。

改动框架时，哪些文档要一起更新，见 [CLAUDE.md](../CLAUDE.md) 里的"改框架时同步文档"一节。AI 助手改框架时也照这张表做。

## 工作原理

整个项目没有构建步骤，也没有运行时框架。一篇帖子从文字到图片要经过三步：

1. **AI 写 HTML**：照 `CLAUDE.md` 的流程，为每个平台尺寸写一个 HTML 文件。版式是现写的，颜色、字体、字号都取自主题变量。
2. **`render.mjs` 渲染**：用 Playwright 打开 HTML，按 `data-size` 查 `sizes.json` 设置视口，把尺寸和安全区作为 CSS 变量注入，等字体加载完，检查版面，再把每个 `.page` 截成一张 PNG，最后拼一张总览图。
3. **AI 看图自检**：读总览图和单页原图，改 HTML，重新渲染，直到满意。

所以，想改 AI 的做法就改 `CLAUDE.md`，想改视觉规范就改 `styles/`，想改导出就改 `render.mjs`。三者互不依赖。

## 目录

```
CLAUDE.md          AI 的工作流程
AGENTS.md          → CLAUDE.md（Codex、Antigravity）
render.mjs         HTML → PNG / PDF
sizes.json         平台尺寸
fonts/             你自己的字体文件，不进 git
fonts.json         推荐字体清单
fonts.mjs          检测电脑上有哪些推荐字体
fontlib.mjs        fonts/ 目录的读取和注册，render.mjs 和 fonts.mjs 共用
styles/            基础样式和主题
examples/          示例（源文件）
prompts/           文案提示词（也是文案规则的唯一出处）
posts/             你自己的帖子，不进 git
CLAUDE.local.md    你的个人偏好，不进 git（可选）
```

字体从 Google Fonts 和 jsDelivr 加载，渲染时需要联网。`fonts/` 里的本地字体不需要联网。

## 手动渲染

```bash
node render.mjs posts/xxx/xhs.html               # PNG，每页一张
node render.mjs posts/xxx/xhs.html --pdf         # 另外导出 PDF
node render.mjs posts/xxx/tiktok.html --guides   # 标出 9:16 的遮挡区
node render.mjs posts/xxx/xhs.html --scale=2     # 2 倍分辨率
```

HTML 约定：`<body data-size="xhs">`，每页一个 `<section class="page">`。脚本会检查文字有没有超出画布、被裁切，或者进入遮挡区，并在 `out/` 下生成一张总览图。

## 加一套风格

1. 复制 `styles/themes/clean.css`，改名为 `<名字>.css`。
2. 改 `:root` 里的变量。版式代码都依赖这几组变量，每一个都要定义：
   - 颜色：`--bg` `--fg` `--muted` `--line` `--accent`
   - 字体：`--font-head` `--font-body`（可选 `--font-num`）`--fw-head`
   - 字号：`--fs-hero` `--fs-h1` `--fs-h2` `--fs-body` `--fs-small`。在 1080 宽的画布上，正文不小于 34px
   - 间距：`--pad` `--radius`
3. 改文件顶部的注释，写清这套风格的气质、适合什么内容、该做和不该做什么。AI 动手前会读这段注释，它对出图效果的影响不比变量小。
4. 字体可以在文件开头用 `@import` 引入在线字体，也可以用 `@font-face` 加载放在仓库里的字体文件。用系统字体时要写好后备字体，否则别人电脑上渲染出来的效果会不一样。
5. 多语言：主题要按 `<html lang>` 切换字体。在文件末尾为 `ja` `ko` 各写一段 `:root:where(:lang(ja)) { --font-head: …; --font-body: … }`，拉丁字母语言（法语、西语、德语等）用的字体如果不支持大写重音字母（É À），也要单独写一段。用 `:where()` 是为了让帖子自己的 `<style>` 还能覆盖它。参考现有主题的末尾。
6. 在 `CLAUDE.md` 的风格列表和 README 里各加一行。

主题里除了变量，还可以带一组可复用的装饰类，比如 `cream-note` 的 `.mark` `.circle` `.sticker` `.pill` `.item`，`blue-paper` 的 `.sheet` `.big` `.wave` `.tag` `.pill` `.item`。写在主题文件里，帖子的 HTML 直接用，不要放进 `base.css`。`examples/cream-note/` 和 `examples/blue-paper/` 是这两套主题的用法示例。

品牌专属的私有风格，建议 fork 之后放在自己的仓库里。

## 加一个平台尺寸

在 `sizes.json` 里加一项：

```json
"ig-45": { "label": "Instagram 4:5", "w": 1080, "h": 1350, "maxPages": 20, "safe": [0, 0, 0, 0] }
```

`safe` 依次是上、右、下、左被平台界面挡住的像素。HTML 里写 `data-size="ig-45"` 就能用。最后记得同步更新 `CLAUDE.md` 和 README 里的尺寸表。

## 改渲染脚本

`render.mjs` 依赖的 HTML 约定：

- `<body data-size="...">` 决定画布尺寸
- 每个 `<section class="page">` 输出一张图
- 带 `.deco` 的元素不参与版面检查，比如出血的背景大字
- 9:16 画面的文字放在 `.safe` 容器里

退出码：`0` 表示正常，`2` 表示渲染成功但有版面警告，`1` 表示参数错误。AI 靠退出码和警告文字决定要不要返工，所以改动时要保持警告的格式（`第 N 页：<元素> "文字" 问题`）。

## 验证改动

项目没有单元测试。改了 `render.mjs`、`base.css` 或主题之后，用示例回归一遍：

```bash
node render.mjs examples/*/*.html
```

确认没有新增警告，再打开 `examples/*/out/*-sheet.png`，和 `docs/images/` 里的效果图比对。效果图需要更新时，从 `out/` 复制过去。

## 贡献示例

在 `examples/<名字>/` 下放 `content.md`（原文，第一行写平台和要求）和 HTML 源文件，不要提交 `out/`。示例内容需要是你有权公开的文字。

## 改工作流程

只改 `CLAUDE.md`，`AGENTS.md` 会自动跟着变。Codex 默认只读取 32 KiB 以内的说明，所以 `CLAUDE.md` 要保持精简，个案经验放进对应的主题注释或示例里。

## 本地字体

把 `.ttf` `.otf` `.woff` `.woff2` 放进 `fonts/`，`render.mjs` 渲染时会自动注册，不用改主题，也不用联网。文件名就是 `font-family` 的名字：`MyFont.ttf` 在 CSS 里写 `font-family: "MyFont"`。同一个字体有多个字重时，文件名末尾加三位数字，比如 `MyFont-700.ttf`，没写默认 400。

想让所有帖子都用它，在 `CLAUDE.local.md` 里写“标题用 MyFont”；想只换某个主题，在 HTML 的 `<style>` 里覆盖 `--font-head` `--font-body`。如果文件名和主题里的字体同名（比如 `LXGW WenKai.ttf`），本地文件会替换在线版本。字体文件的授权要自己确认，`fonts/` 不进 git，不会随仓库公开。

### 推荐字体清单

`fonts.json` 是推荐字体的候选清单，按语言分 `zh` `ja` `ko` `en` 四组，法语、西语、德语等拉丁字母语言用 `en` 组。每一项有 `family`（CSS 名）、`label`（中文名）、`role` `vibe`（用途和气质）、`kind`（来源）、`use`（什么内容、什么位置适合用）、`themes`（适合的风格）、`probe`（系统里可能用的别名）、`stack`（带后备字体的完整字体栈）、`get`（下载或官网地址）。

`kind` 有三种：`online` 是 Google Fonts、jsDelivr 上的在线字体，多一个 `import`（样式表地址），渲染时联网就能用；`system` 是操作系统自带，多一个 `platform`，只在对应系统上有，`stack` 必须带后备字体；`download` 是要自己下载安装或放进 `fonts/` 的字体。新增在线字体时，先用 `curl` 确认 `import` 地址能返回 200，并确认字重参数是这款字体真有的，否则 Google Fonts 会整条请求失败。

`node fonts.mjs` 在 Chromium 里用 canvas 量同一段文字的宽度，和后备字体比较，来判断每款字体能不能用，所以本机、`fonts/`、系统里的字体结果和渲染时的实际情况一致。`kind` 是 `online` 的字体不在本机，`fonts.mjs` 直接按可用处理，标 `[在线，需联网]` 并列出 `@import`。加 `--json` 输出 JSON。AI 排版前会跑它，按 `use` 和风格从可用的候选里挑合适的，没有合适的就保持主题默认，见 `CLAUDE.md` 的"字体"一节。新增推荐字体只需要往 `fonts.json` 加一项。
