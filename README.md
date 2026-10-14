# postsmith

贴一段文字，AI 按内容现场设计版面，导出小红书、抖音、TikTok、X 尺寸的图片。

Paste text, get social media images. An AI coding agent designs a fresh layout for each post and renders it to platform-sized PNGs.

<p>
  <img src="docs/images/xhs-notebook.png" width="49%">
  <img src="docs/images/xhs-clean.png" width="49%">
</p>

## 快速开始

需要 Node 18 以上，以及 Claude Code、Codex 或 Antigravity 中的任意一个。

```bash
git clone <this repo> postsmith && cd postsmith
npm install
```

在项目目录里打开 AI 助手，说明要发哪里，再贴上文字：

> 这段做成小红书，6 页以内，用 notebook 风格
>
> （贴入文字）

图片会输出到 `posts/<日期-短名>/out/`。想改哪里直接说，比如"第二页标题大一点"。

出图后，AI 会根据图上的文字写好发布文案（标题、正文、话题标签），存在 `caption.md`，贴上去就能发。

**想用别的 AI 写文案？** 复制 [`prompts/copywriting.md`](prompts/copywriting.md) 的内容，在最后贴上原始素材，交给 ChatGPT、Gemini 等任意 AI。把它写好的文案贴回这里，AI 会照着排版；为了适配版面需要改字时，会告诉你改了哪里。

## 支持什么

**平台**：小红书 3:4，抖音图文 9:16 或 3:4，TikTok 9:16，X 横图 16:9 或竖图 4:5。

**风格**：`clean` 干净商务、`notebook` 手帐、`editorial` 杂志。不指定时 AI 按内容自己挑。

<p>
  <img src="docs/images/xhs-editorial.png" width="49%">
  <img src="docs/images/tiktok.png" width="24%">
</p>

## 个人偏好

在项目根目录建一个 `CLAUDE.local.md`（Codex 用 `AGENTS.override.md`），写下你的习惯，比如"主色用 #FF5A5F""每页右下角加我的账号名"。这个文件不进 git。

## 开发

想加风格、加平台尺寸、改渲染脚本，或者想了解它是怎么工作的，请看 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## License

MIT
