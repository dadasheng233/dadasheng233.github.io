# 晚风小筑 · 技术参考手册

> 这不是教程，是**查代码用的参考文档**。
> 如果你只想改内容，直接看 [第 3 节](#3-数据模型) 和 [第 9 节](#9-想改-x去哪里找代码)。

版本：`1.0` · 对应项目：`blog/`

## 目录

- [0. 30 秒版：代码到底在哪](#0-30-秒版代码到底在哪)
- [1. 目录地图](#1-目录地图)
- [2. 运行方式](#2-运行方式)
- [3. 数据模型](#3-数据模型)
- [4. 路由 / 页面接口](#4-路由--页面接口)
- [5. 构建 API](#5-构建-api)
- [6. 主题 / 布局 API](#6-主题--布局-api)
- [7. 客户端 JS 参考](#7-客户端-js-参考)
- [8. CSS 参考](#8-css-参考)
- [9. 想改 X，去哪里找代码](#9-想改-x去哪里找代码)
- [10. 常用改动配方](#10-常用改动配方)
- [11. 排错表](#11-排错表)
- [12. 约定和边界](#12-约定和边界)
- [13. 最小可用心智模型](#13-最小可用心智模型)

**怎么读：**

- 只想写文章：看 0、3、9
- 只想改颜色/外观：看 8、9
- 想知道构建怎么工作：看 5、6
- 想改搜索/灯箱/猫：看 7
- 部署出问题：看 11

---

## 0. 30 秒版：代码到底在哪

这个项目只有四层：

```text
content/      你写的数据：站点信息、文章、关于页
theme/        页面长什么样：布局、CSS、JS、图片
build.mjs     把 content + theme 变成 public 的生成器
public/       生成结果，不要手改
```

记住这张表就够了：

| 你想改 | 去哪个文件 |
|---|---|
| 站名、作者、邮箱、GitHub、页脚 | `content/site.json` |
| 文章 | `content/posts/*.html` |
| 关于页 | `content/about.html` |
| 四级单词 | `content/words.json` |
| 单词页面交互 | `theme/assets/js/words.js` |
| 首页 CET-4 入口卡片 | `build.mjs → renderHome()` + `.home-word-card` |
| 头像、封面、照片 | `theme/assets/img/` |
| 颜色、宽度、字体 | `theme/assets/css/site.css` 的 `:root` |
| 小猫台词 | `live2d/waifu-tips.json` |
| 导航、页头、侧栏、页脚结构 | `theme/layout.mjs` |
| 搜索、灯箱、页面转场 | `theme/assets/js/site.js` |
| 评论 | `build.mjs → renderPostPage()` + `content/site.json → comments` |
| 配置地图 | `theme/assets/js/edit-map.js` |
| 构建、分页、RSS、站点地图 | `build.mjs` |
| 部署 | `.github/workflows/pages.yml` |

**不要改：**

- `public/`：每次构建重新生成
- `vendor/live2d/`：第三方 Live2D 引擎
- `theme/utils.mjs`：构建辅助函数
- `serve.mjs`：本地预览服务器

---

## 1. 目录地图

```text
blog/
├─ content/                        输入：内容
│  ├─ site.json                    站点配置
│  ├─ words.json                   CET-4 单词数据
│  ├─ about.html                   关于页正文
│  └─ posts/                       文章
│     ├─ hello-live2d.html
│     ├─ newP.html
│     └─ ...
│
├─ theme/                          输入：外观
│  ├─ layout.mjs                   页面骨架
│  ├─ utils.mjs                    转义/日期/slug
│  └─ assets/
│     ├─ css/site.css              全部样式和动效
│     ├─ js/site.js                全站交互
│     ├─ js/cat.js                 Live2D 启动/兜底
│     ├─ js/edit-map.js            配置地图
│     ├─ js/words.js               单词本交互
│     ├─ icons.svg                 SVG 图标 sprite
│     ├─ icons.html                图标预览页
│     └─ img/                      头像、封面、照片
│
├─ live2d/                         小猫模型和台词
│  ├─ waifu-tips.json
│  └─ tororo/
│
├─ vendor/live2d/                  第三方 Live2D 运行时
├─ build.mjs                       静态生成器
├─ serve.mjs                       本地预览服务器
├─ tools/check-links.mjs           内部链接检查
├─ package.json
├─ README.md
├─ REFERENCE.md                    本文件
├─ CREDITS.md
├─ 启动博客.bat
│
├─ .github/workflows/pages.yml     GitHub Pages 部署
├─ .gitignore
└─ public/                         输出：生成结果，不手改
```

---

## 2. 运行方式

```bash
cd blog

npm run build     # 生成 public/
npm start         # 本地预览，端口 4200
npm run dev       # 构建 + 预览
npm run check     # 检查内部链接和资源
```

- 本地地址：`http://127.0.0.1:4200`
- 配置地图：`http://127.0.0.1:4200/?edit-map=1`
- 图标预览：`http://127.0.0.1:4200/assets/icons.html`

构建要求：Node.js 18+。项目没有 npm 依赖，不需要 `npm install`。

---

## 3. 数据模型

### 3.1 `content/site.json`

| 字段 | 类型 | 必填 | 作用 |
|---|---|---|---|
| `title` | string | 是 | 站名、页头标题、浏览器标题 |
| `subtitle` | string | 否 | 页头副标题 |
| `author` | string | 是 | 侧栏作者、文章版权署名 |
| `description` | string | 否 | 站点描述、meta description |
| `url` | string | 是 | 线上域名，构建 RSS/canonical 用 |
| `avatar` | string | 否 | 侧栏头像路径 |
| `favicon` | string | 否 | favicon 路径 |
| `since` | string | 否 | 建站日期，用来算“本站已经写了 N 天” |
| `email` | string | 否 | 联系邮箱 |
| `github` | string | 否 | GitHub 地址 |
| `rss` | string | 否 | RSS 路径，默认 `/atom.xml` |
| `footer` | string | 否 | 页脚文案 |
| `keywords` | string | 否 | meta keywords |
| `links` | array | 否 | 侧栏社交链接，元素为 `{name,url,icon}` |
| `blogroll` | array | 否 | 侧栏友链，元素为 `{name,url}` |
| `comments` | object | 否 | 评论配置，当前支持 `{provider,repo,issueTerm,theme}` |

示例：

```json
{
  "title": "欢迎来到我们的世界",
  "subtitle": "代码、生活，以及一些无用之美",
  "author": "dadasheng",
  "url": "https://dadasheng233.github.io",
  "avatar": "/assets/img/avatar.svg",
  "github": "https://github.com/dadasheng233",
  "comments": {
    "provider": "utterances",
    "repo": "dadasheng233/dadasheng233.github.io",
    "issueTerm": "pathname",
    "theme": "github-light"
  }
}
```

### 3.2 文章 front matter

每篇文章是一个 HTML 文件，开头是一段 HTML 注释包着的 JSON：

```html
<!--meta
{
  "slug": "my-post",
  "title": "标题",
  "date": "2026-11-08",
  "category": "随笔",
  "tags": ["记录", "生活"],
  "cover": "/assets/img/my-cover.png",
  "excerpt": "首页摘要"
}
-->
<p>正文</p>
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `slug` | string | 是 | 决定 URL：`/posts/<slug>.html`，必须唯一 |
| `title` | string | 是 | 文章标题 |
| `subtitle` | string | 否 | 标题下的一句小字 |
| `date` | string | 是 | `YYYY-MM-DD` |
| `updated` | string | 否 | `YYYY-MM-DD` |
| `category` | string | 是 | 单个分类 |
| `tags` | string[] | 否 | 标签数组 |
| `cover` | string | 否 | 封面图路径 |
| `coverAlt` | string | 否 | 封面 alt |
| `excerpt` | string | 否 | 首页摘要；不填自动截取正文 |
| `featured` | boolean | 否 | 首页第一张卡片是否带顶部彩虹线 |
| `views` | string | 否 | 手写阅读量，如 `"1.2k"` |
| `reading` | number | 否 | 阅读分钟数；不填自动估算 |

正文里可以使用：

```html
<h2 id="section">小节</h2>
<h3 id="sub">小节</h3>
<p>段落</p>
<ul><li>列表</li></ul>
<blockquote><p>引用</p></blockquote>
<pre><code class="language-js">const x = 1;</code></pre>
<figure class="post-figure">
  <img src="/assets/img/a.png" alt="说明" loading="lazy">
  <figcaption>图片说明</figcaption>
</figure>
```

`h2` / `h3` 会自动生成目录和锚点。

### 3.3 构建后的 Post 对象

`build.mjs` 读取 front matter 后，会把文章整理成下面的对象，供各页面模板使用：

| 字段 | 说明 |
|---|---|
| `slug` | URL 短名 |
| `path` | `/posts/<slug>.html` |
| `title` / `subtitle` | 标题 |
| `date` / `updated` | 日期 |
| `category` | 分类名 |
| `categoryId` | 分类锚点，如 `cat-0` |
| `tags` | 标签名数组 |
| `tagInfos` | 标签对象数组，含 `id` / `name` / `count` |
| `cover` / `coverAlt` | 封面 |
| `excerpt` | 摘要 |
| `views` | 阅读量 |
| `reading` | 阅读分钟 |
| `words` | 去空白后的字数 |
| `body` | 处理过锚点的正文 HTML |
| `toc` | `{level,id,text}[]` |
| `featured` | 是否精选 |

### 3.4 分类和标签

分类和标签**不是手写配置**，而是构建时从所有文章里汇总出来的。

- 分类：从每篇文章的 `category` 字段汇总
- 标签：从每篇文章的 `tags` 数组汇总
- 数量、排序、锚点、颜色都由 `build.mjs` 生成

修改文章的分类/标签后，重新构建即可。

### 3.5 `content/words.json`

CET-4 单词本的数据。数组，每个元素：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `word` | string | 是 | 英文单词，也是进度记录的 key |
| `phonetic` | string | 否 | 音标 |
| `pos` | string | 否 | 词性，如 `v.` |
| `meaning` | string | 是 | 中文释义 |
| `example` | string | 否 | 英文例句 |
| `translation` | string | 否 | 例句翻译 |
| `tags` | string[] | 否 | `DAY 1`、`第一章`、`高频` 等 |

```json
{
  "word": "nuisance",
  "phonetic": "",
  "pos": "",
  "meaning": "令人讨厌的东西，讨厌的人",
  "example": "",
  "translation": "",
  "tags": ["DAY 1", "第一章", "高频"]
}
```

构建时会：

1. 读取 `content/words.json`
2. 清洗字段
3. 复制成 `public/words.json`
4. 生成 `/words.html`
5. 在首页第 1 页插入 `.home-word-card` 入口，显示总词数和 DAY 数

学习进度不写回这个文件，只存在浏览器 localStorage。

---

## 4. 路由 / 页面接口

这个站点没有后端 API，只有静态 GET 路由。下面用 REST 文档的方式列出。

| 方法 | 路径 | 返回 | 代码 |
|---|---|---|---|
| GET | `/` | 首页第 1 页 | `build.mjs → renderHome()` |
| GET | `/page/:n/` | 首页第 n 页 | `build.mjs → renderHome()` |
| GET | `/posts/:slug.html` | 文章详情 | `build.mjs → renderPostPage()` |
| GET | `/archives.html` | 归档 | `build.mjs → renderArchives()` |
| GET | `/categories.html` | 分类 | `build.mjs → renderCategories()` |
| GET | `/tags.html` | 标签 | `build.mjs → renderTags()` |
| GET | `/words.html` | CET-4 单词本 | `build.mjs → renderWords()` + `words.js` |
| GET | `/words.json` | 单词数据 | `content/words.json` |
| GET | `/about.html` | 关于 | `build.mjs → renderAbout()` |
| GET | `/404.html` | 404 页面 | `build.mjs → render404()` |
| GET | `/search.json` | 搜索索引 | `build.mjs → main()` |
| GET | `/atom.xml` | RSS Atom | `build.mjs → renderAtom()` |
| GET | `/sitemap.xml` | 站点地图 | `build.mjs → renderSitemap()` |
| GET | `/robots.txt` | 爬虫规则 | `build.mjs → main()` |
| GET | `/assets/*` | CSS/JS/图片/图标 | `theme/assets/` |
| GET | `/live2d/*` | 小猫模型和台词 | `live2d/` |
| GET | `/vendor/live2d/*` | Live2D 运行时 | `vendor/live2d/` |
| GET | `/?edit-map=1` | 首页 + 自动打开配置地图 | `theme/assets/js/edit-map.js` |
| GET | `/words.html?tab=list` | 单词本直接打开词表 | `theme/assets/js/words.js` |
| GET | `/words.html?tab=quiz` | 单词本直接打开测验 | `theme/assets/js/words.js` |

没有 POST / PUT / DELETE。搜索、标签筛选都在浏览器里完成；评论通过 Utterances iframe 写入 GitHub Issues。

### 4.1 页面内部锚点

| 锚点 | 作用 |
|---|---|
| `#search` | 打开搜索弹层 |
| `#cat-0`、`#cat-1` | 分类页的分类区块 |
| `#tag-0`、`#tag-1` | 标签页的标签筛选 |
| `#post-<slug>` | 首页卡片锚点 |

### 4.2 `GET /search.json`

响应是一个数组：

```json
[
  {
    "title": "把一只小猫请进博客",
    "url": "/posts/hello-live2d.html",
    "date": "2026-10-28",
    "category": "技术",
    "tags": ["Live2D", "前端", "动画", "博客"],
    "excerpt": "首页摘要……",
    "content": "正文纯文本，最多 1600 字"
  }
]
```

搜索在浏览器里读取这个文件并打分，不会发请求到服务器。

### 4.3 `GET /atom.xml`

标准 Atom feed，包含标题、链接、发布时间、分类、摘要。生成逻辑在 `build.mjs → renderAtom()`。

### 4.4 HTTP 行为（本地服务器）

`serve.mjs` 的行为：

- 只接受 `GET` / `HEAD`
- `Cache-Control: no-store`
- 目录自动找 `index.html`
- 找不到给 `404.html`
- 阻止路径穿越
- 端口 `4200`，可用 `PORT=xxxx npm start` 覆盖

GitHub Pages 由 CDN 托管，缓存行为由 GitHub 控制。

---

## 5. 构建 API

入口：

```bash
node build.mjs
```

`build.mjs` 内部函数：

| 函数 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `readJson(path)` | 文件路径 | object | 读 JSON |
| `estimateReading(text)` | 纯文本 | number | 估算阅读分钟 |
| `processBody(html, slug)` | 正文 HTML | `{body, toc}` | 给 h2/h3 加 id、生成目录 |
| `renderToc(toc)` | toc 数组 | HTML | 文章目录 |
| `renderPostCard(post)` | Post | HTML | 首页卡片 |
| `pageUrl(n)` | 页码 | string | `/` 或 `/page/n/` |
| `pageFile(n)` | 页码 | string | 输出文件路径 |
| `renderPagination(current,total)` | 页码 | HTML | 分页 |
| `renderPostPage(post,ctx)` | Post/上下文 | HTML | 文章页 |
| `renderHome(posts,current,total,site,stats)` | 文章切片 | HTML | 首页 + 第 1 页 CET 卡片 + 分页 |
| `renderArchives(posts,site,stats)` | 全部文章 | HTML | 归档页 |
| `renderCategories(categories,site,stats)` | 分类 | HTML | 分类页 |
| `renderTags(tags,posts,site,stats)` | 标签 | HTML | 标签页 |
| `renderAbout(site,stats)` | 配置 | HTML | 关于页 |
| `render404(site,stats)` | 配置 | HTML | 404 |
| `renderAtom(posts,site)` | 文章 | XML | RSS |
| `renderSitemap(site,pages)` | 页面列表 | XML | 站点地图 |
| `main()` | 无 | Promise | 总流程 |

### 构建流程

```text
读 site.json
  ↓
读 content/posts/*.html
  ↓
解析 front matter
  ↓
按日期倒序
  ↓
汇总分类、标签
  ↓
处理 h2/h3 锚点和目录
  ↓
统计字数 / 阅读时间
  ↓
清空 public/
  ↓
复制 theme/assets、vendor/live2d、live2d
  ↓
生成首页、文章、归档、分类、标签、关于、404
  ↓
生成 search.json、atom.xml、sitemap.xml、robots.txt
```

### 可调常量

| 常量 | 位置 | 默认 | 作用 |
|---|---|---|---|
| `PAGE_SIZE` | `build.mjs` 顶部 | `4` | 首页每页文章数 |
| `CATEGORY_COLORS` | `build.mjs` 顶部 | 6 色 | 分类卡片强调色 |
| `SITE_URL` | 环境变量 | 无 | 覆盖 `site.json` 的 `url`，GitHub Actions 用 |

---

## 6. 主题 / 布局 API

`theme/layout.mjs` 导出：

| 函数 | 作用 |
|---|---|
| `icon(name, className)` | 输出 `<svg><use href="/assets/icons.svg#...">` |
| `header(site, active)` | 页头 + 导航 |
| `sidebar(site, stats)` | 右侧栏 |
| `footer(site, stats)` | 页脚 |
| `floatingControls()` | 配置地图、侧栏、回到顶部按钮 |
| `searchModal()` | 搜索弹层 |
| `lightbox()` | 图片灯箱 |
| `renderPage({site,page,content,stats})` | 套完整 HTML 骨架 |

`NAV` 数组在 `layout.mjs` 顶部，导航项格式：

```js
{ key: 'home', label: '首页', href: '/', icon: 'i-home' }
```

加导航项时：

1. 在 `NAV` 里加一项
2. 在 `icons.svg` 里加一个同名 symbol（可选）
3. 创建对应页面或路由
4. 重新构建

`theme/utils.mjs` 提供：

| 函数 | 作用 |
|---|---|
| `escapeHtml` | HTML 转义 |
| `stripTags` | 去标签取纯文本 |
| `slugify` | 从标题生成锚点 |
| `dateParts` | 拆分日期 |
| `formatDate` | `YYYY-MM-DD` |
| `isoDateTime` | 带时区的 ISO 时间 |
| `toAbsolute` | 拼接完整 URL |

---

## 7. 客户端 JS 参考

### 7.1 `site.js`

没有导出 API，靠 DOM 约定工作。

| 功能 | DOM 钩子 | 说明 |
|---|---|---|
| 页面加载条 | `#pace` | 加载时 68% → 100% |
| 滚动入场 | `.reveal` | IntersectionObserver 加 `.is-in` |
| 阅读进度 | `#reading-progress` | 顶部彩虹条 |
| 滚动百分比 | `#scroll-percent` | 页脚数字 |
| 回到顶部 | `#back-to-top` | 滚动 520px 后出现 |
| 移动导航 | `.nav-toggle` + `body.nav-open` | 767px 以下 |
| 侧栏 | `#sidebar`、`#sidebar-toggle`、`#sidebar-dimmer` | `body.sidebar-open` |
| 搜索 | `#search-modal`、`#search-input`、`#search-results` | 读取 `/search.json` |
| 代码复制 | `.post-body pre > code` | 自动包 `.code-block` |
| 图片灯箱 | `.post-body img` + `#lightbox` | 点击放大 |
| 评论 | `.comments` + Utterances iframe | GitHub Issues，不在 `site.js` 里 |
| 标签筛选 | `#tag-cloud`、`#tag-results` | 只改显示 |
| 页面转场 | 站内 `<a>` | 180ms 淡出 |

评论由 `build.mjs → renderPostPage()` 插入 Utterances 脚本，仓库配置在 `content/site.json → comments`。访客需要 GitHub 账号；留言会变成仓库的 GitHub Issue。

sessionStorage：

```text
edit-map-open               配置地图是否打开
```

### 7.2 `cat.js`

启动条件：

- 浏览器宽度 > 1180px
- 没有开启 `prefers-reduced-motion`
- WebGL 可用

状态 class：

| class | 含义 |
|---|---|
| `cat-loading` | 模型加载中，不显示兜底猫 |
| `cat-ready` | Live2D 已就绪 |
| `cat-fallback-mode` | 使用静态猫图 |

配置在 `initWidget()`：

```js
{
  waifuPath: '/live2d/waifu-tips.json',
  cubism2Path: '/vendor/live2d/live2d.min.js',
  logLevel: 'warn',
  drag: false
}
```

超时 10 秒仍没有模型，自动显示静态猫图。

### 7.3 `edit-map.js`

配置地图。`ENTRIES` 数组的每一项：

```js
{
  id: 'site-title',
  group: '站点信息',
  label: '站点标题',
  file: 'content/site.json',
  field: 'title',
  note: '说明',
  selectors: ['.site-title']
}
```

- `selectors` 为空：只能复制路径，不能定位页面元素
- 有 `selectors`：悬停高亮、点击提示、面板定位
- 快捷键：`Ctrl/Cmd + Shift + E`
- 悬停时按 `C` 复制路径
- 配置地图只读，不修改文件

### 7.4 `words.js`

单词本页面的全部交互：

| 功能 | 关键选择器/键 | 说明 |
|---|---|---|
| 读取单词 | `/words.json` | 页面加载后 fetch |
| 翻卡 | `#word-card`、`Space` | 点击或空格翻面 |
| 记忆程度 | `[data-word-mark]`、`1/2/3` | 不认识/模糊/认识 |
| 发音 | `#word-audio` | Web Speech API |
| 随机/前后 | `#word-shuffle`、`#word-prev`、`#word-next` | 卡片切换 |
| 词表 | `#word-list`、`#word-search`、`#word-letter`、`#word-status` | 搜索、字母、状态筛选 |
| 分页 | `#word-pager` | 每页 15 条 |
| 测验 | `#word-quiz` | 10 题四选一 |
| 页面 tab | `?tab=cards/list/quiz` | 可直接打开指定模式 |

localStorage：

```text
wanfeng:words:progress      { "word": "known" | "fuzzy" | "unknown" }
wanfeng:words:wrong         错词数组
```

单词数据不写回，换设备不会同步。

---

## 8. CSS 参考

### 8.1 变量

文件：`theme/assets/css/site.css` 顶部 `:root`

| 变量 | 默认 | 作用 |
|---|---|---|
| `--paper` | `#fffdfa` | 卡片背景 |
| `--ink` | `#1b1b1f` | 主文字 |
| `--muted` | `#918d94` | 次要文字 |
| `--line` | `#e9e4dc` | 分割线 |
| `--orange` | `#f79533` | 强调色 1 |
| `--coral` | `#ef4e7b` | 主强调色 |
| `--violet` | `#a166ab` | 强调色 2 |
| `--teal` | `#07b39b` | 强调色 3 |
| `--rainbow` | 8 色渐变 | 顶部彩虹线 |
| `--serif` | 中文衬线栈 | 标题和正文 |
| `--sans` | 中文无衬线栈 | 导航、meta |
| `--mono` | 等宽栈 | 代码 |
| `--max` | `960px` | 内容最大宽度 |

### 8.2 状态 class

| class | 挂在 | 作用 |
|---|---|---|
| `.js` | `<html>` | JS 可用 |
| `.no-js` | `<html>` | JS 不可用 |
| `.is-in` | `.reveal` | 入场动画完成 |
| `.is-open` | 搜索/灯箱/面板 | 打开状态 |
| `.is-active` | 菜单/标签 | 当前项 |
| `.nav-open` | `<body>` | 移动导航展开 |
| `.sidebar-open` | `<body>` | 侧栏展开 |
| `.edit-map-active` | `<body>` | 配置地图开启 |
| `.page-leaving` | `<body>` | 页面跳转淡出 |
| `.cat-loading` | `<body>` | 猫模型加载中 |
| `.cat-ready` | `<body>` | Live2D 就绪 |
| `.cat-fallback-mode` | `<body>` | 使用静态猫 |

### 8.3 断点

| 断点 | 变化 |
|---|---|
| `1180px` | 不加载 Live2D，只显示静态猫 |
| `1080px` | 内容宽度 820px |
| `860px` | 内容宽度 720px，分类两列 |
| `767px` | 移动端：导航折叠、单列、文章卡片贴边 |
| `420px` | 更小标题、隐藏部分 meta |

### 8.4 动画

| 名称 | 位置 | 作用 |
|---|---|---|
| `header-in` | CSS | 页头淡入下移 |
| `nav-in` | CSS | 导航逐项出现 |
| `page-in` / `page-out` | CSS | 页面进出 |
| `fadeUp` | CSS | 卡片上浮 |
| `heart-beat` | CSS | 页脚爱心 |
| `cat-breathe` | CSS | 静态猫呼吸 |
| `map-focus` | CSS | 配置地图定位闪烁 |
| `waifu-shake` | `vendor/live2d/waifu.css` | 小猫气泡轻微抖动 |

---

## 9. 想改 X，去哪里找代码

| 想改 | 文件 | 关键函数/选择器 |
|---|---|---|
| 站名 | `content/site.json` | `title` |
| 副标题 | `content/site.json` | `subtitle` |
| 作者 | `content/site.json` | `author` |
| 页头结构 | `theme/layout.mjs` | `header()` |
| 导航项 | `theme/layout.mjs` | `NAV` |
| 页脚 | `theme/layout.mjs` | `footer()` |
| 侧栏 | `theme/layout.mjs` | `sidebar()` |
| 首页卡片 | `build.mjs` | `renderPostCard()` |
| 文章页 | `build.mjs` | `renderPostPage()` |
| 分页 | `build.mjs` | `PAGE_SIZE` / `renderPagination()` |
| 目录 | `build.mjs` | `processBody()` / `renderToc()` |
| 归档 | `build.mjs` | `renderArchives()` |
| 分类 | `build.mjs` | `renderCategories()` |
| 标签 | `build.mjs` | `renderTags()` |
| 单词数据 | `content/words.json` | `word` / `meaning` / `example` |
| 单词本页面 | `build.mjs` + `theme/assets/js/words.js` | `renderWords()` / 卡片 / 词表 / 测验 |
| 首页 CET 卡片 | `build.mjs → renderHome()` | `.home-word-card`，仅第 1 页 |
| 首页 CET 文案/颜色 | `theme/assets/css/site.css` | `.home-word-card` / `.home-word-*` |
| RSS | `build.mjs` | `renderAtom()` |
| 站点地图 | `build.mjs` | `renderSitemap()` |
| 搜索 | `theme/assets/js/site.js` | `search` 段 + `layout.mjs → searchModal()` |
| 搜索索引 | `build.mjs` | `searchIndex` |
| 灯箱 | `theme/assets/js/site.js` | `lightbox` 段 + `layout.mjs → lightbox()` |
| 评论 | `build.mjs` + `content/site.json` | `renderPostPage()` 的 `.comments` / `comments` 配置 |
| 页面转场 | `theme/assets/js/site.js` | `page transition` 段 |
| 配置地图 | `theme/assets/js/edit-map.js` | `ENTRIES` / `buildTargets()` |
| 小猫启动 | `theme/assets/js/cat.js` | `boot()` / `initWidget()` |
| 小猫台词 | `live2d/waifu-tips.json` | `message` / `mouseover` |
| 小猫大小 | `theme/assets/css/site.css` | `#waifu` / `#live2d` |
| 颜色 | `theme/assets/css/site.css` | `:root` |
| 卡片样式 | `theme/assets/css/site.css` | `.post` / `.post-cover` |
| 首页 CET 卡片 | `theme/assets/css/site.css` | `.home-word-card` / `.home-word-icon` / `.home-word-action` |
| 正文排版 | `theme/assets/css/site.css` | `.post-body` |
| 图标 | `theme/assets/icons.svg` | `<symbol id="...">` |
| 图标预览 | `theme/assets/icons.html` | 打开看全部 |
| 部署 | `.github/workflows/pages.yml` | GitHub Actions |
| 本地服务器 | `serve.mjs` | 端口 4200 |

---

## 10. 常用改动配方

### 改站名和作者

```text
content/site.json → title / author / description / url
content/about.html → 自我介绍里写死的名字
theme/layout.mjs → 如果有写死的文案
```

### 加一篇文章

1. 在 `content/posts/` 新建 `my-post.html`
2. 写 front matter 和正文
3. `npm run build`
4. 本地刷新 4200

### 加一张图片

1. 放到 `theme/assets/img/my-photo.png`
2. 文章里写 `<img src="/assets/img/my-photo.png" alt="...">`
3. `npm run build`

### 换封面

改文章 front matter：

```json
"cover": "/assets/img/my-cover.png",
"coverAlt": "封面描述"
```

### 改首页 CET 卡片

卡片只出现在首页第 1 页，位置在文章列表上方。

- 文案 / 链接：`build.mjs → renderHome()` 里的 `.home-word-card`
- 总词数 / DAY 数：来自 `stats.vocabulary` 和 `stats.vocabularyDays`
- 样式：`theme/assets/css/site.css` 的 `.home-word-card` / `.home-word-*`
- 不想显示：删掉 `renderHome()` 里的 `current === 1 ? ...` 整段

### 改主色

只改 `theme/assets/css/site.css` 的 `:root`：

```css
--coral: #d94f70;
--violet: #8a5ea8;
```

不要到处搜颜色替换。

### 改小猫台词

改 `live2d/waifu-tips.json`：

- `message.default`：平时随机说
- `message.hoverBody`：鼠标放身上
- `message.tapBody`：点击身体
- `mouseover`：悬停页面元素的台词

### 关闭小猫

删掉 `theme/layout.mjs` 里的：

```html
<script type="module" src="/assets/js/cat.js"></script>
```

或者让 `cat.js` 的 `boot()` 直接 return。

### 改每页文章数

改 `build.mjs` 顶部：

```js
const PAGE_SIZE = 4;
```

### 加导航项

改 `theme/layout.mjs` 的 `NAV`，然后加对应页面/路由。

### 改文章页版权

改 `build.mjs → renderPostPage()` 里的 `post-copyright` 段。

---

## 11. 排错表

| 现象 | 原因 | 处理 |
|---|---|---|
| `npm run build` 报 JSON 错 | front matter 多了逗号/用了中文引号 | 检查 `<!--meta ... -->` 里的 JSON |
| 首页没有新文章 | 没重新构建 | `npm run build` |
| 改了样式没变化 | 改的是 `public/` | 改 `theme/` 后重新构建 |
| 图片 404 | 图片不在 `theme/assets/img/` 或路径写错 | 用 `/assets/img/xxx.png` |
| GitHub Pages 显示 README | Pages Source 还在用 branch/Jekyll | Settings → Pages → Source 选 GitHub Actions |
| GitHub Pages 样式丢失 | 部署在子目录，绝对路径失效 | 用 `<用户名>.github.io` 或加 base 前缀 |
| 小猫不出现 | 窗口 <1180px / 减少动态效果 / WebGL 不可用 | 拉宽窗口；看 Console；会显示静态猫 |
| 评论框空白/提示未安装 | Utterances App 没授权仓库，或 GitHub 被阻断 | 安装 utterances App；检查 `site.json → comments.repo` |
| 评论在别的浏览器看不到 | 旧版本是 localStorage 本地演示 | 现在的评论写入 GitHub Issues，不再用 localStorage |
| 搜索没结果 | `search.json` 没生成或请求失败 | 重新构建；看 Network |
| 端口被占用 | 已有服务器在 4200 | 关掉旧窗口，或 `PORT=4201 npm start` |
| `git push` 失败 | SSH/凭据问题 | 当前仓库已配 `core.sshCommand` 到系统 OpenSSH |
| 页面转场后 404 | 部署子路径 / 链接错误 | 检查 URL 和 base |

---

## 12. 约定和边界

### 命名

- 文章 slug：小写英文/数字/短横线，例如 `my-first-post`
- 图片：小写英文/数字/短横线，避免空格
- CSS：组件用 `.block` / `.block-element`，状态用 `.is-*`
- JS：DOM 钩子用 `id` 或 `data-*`，不要靠容易变的标签名

### 不要手改

| 路径 | 原因 |
|---|---|
| `public/` | 构建产物，会被清空重建 |
| `vendor/live2d/` | 第三方 GPL 代码 |
| `node_modules/` | 没有依赖，不应该出现 |
| `build.mjs` 的 `main()` 流程 | 除非你知道自己在改生成器 |

### 第三方

- `live2d-widget`：GPL-3.0，许可证在 `vendor/live2d/LICENSE`
- Tororo 模型：版权不属于本项目，公开部署前确认授权
- 详见 `CREDITS.md`

---

## 13. 最小可用心智模型

如果你只记一件事，记这个：

```text
content/ 决定「写什么」
theme/   决定「长什么样、怎么交互」
build.mjs 决定「怎么拼成 public/」
public/  是结果，不手改
```

再加一条：

```text
改完源文件 → npm run build → 刷新 4200
要上线 → git add -A && git commit && git push
```
