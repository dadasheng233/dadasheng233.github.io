# 晚风小筑

一个可以直接用的个人博客：深色底、白色纸片式文章卡片、彩虹细线、滚轮动效，以及一只住在左下角的 Live2D 白猫。

视觉参考了 Hexo NexT 的 Muse 主题和[黑果小兵的博客](https://blog.daliansky.net/)，但 HTML、CSS、JavaScript、文章和插画都是重新写的。小猫使用 Tororo 模型，加载器是开源的 [live2d-widget](https://github.com/stevenjoezhang/live2d-widget)。

> 不知道代码在哪里？先看 **[REFERENCE.md](REFERENCE.md)**：里面有路由表、数据字段、构建函数、CSS 变量和「想改 X 去哪里找代码」的对照表。

## 直接看

```text
双击  启动博客.bat
```

或者：

```bash
cd blog
npm start
```

打开 `http://127.0.0.1:4200`。

> 不要直接双击 `public/index.html`。站内资源使用 `/assets/...` 绝对路径，Live2D 也需要 HTTP 服务。

## 已经做好的东西

**页面**

- 首页文章流 + 分页
- 首页 CET-4 单词卡片入口，显示总词数和 DAY 数
- 文章详情页：目录、代码复制、图片灯箱、标签、版权、前后篇
- CET-4 单词本：翻卡记忆、词表搜索、四选一测验、本地学习进度
- 数据结构可视化实验室：知识地图、完成度、二分查找动画、诊断视图
- CET-4 真题库：2024–2025 试卷 + 解析，PDF.js 在线阅读
- 归档、分类、标签、关于、404
- 全站搜索（标题 / 标签 / 分类 / 正文）
- RSS Atom、`sitemap.xml`、`robots.txt`
- 响应式导航和侧栏

**动画**

- 头图标题、副标题、导航逐项入场
- 文章卡片滚动到视口后上浮
- 卡片悬停抬起、封面缓慢放大、标题彩虹下划线
- 页面跳转时轻微淡出
- 顶部彩虹阅读进度条 + 页脚滚动百分比
- 侧栏滑入、遮罩淡入、按钮变形
- 搜索弹窗缩放、结果悬停、关键词高亮
- 图片灯箱、代码复制反馈
- 小猫：呼吸、眨眼、转头、随机动作、鼠标跟随、点击台词

所有动画都尊重系统的「减少动态效果」设置。

**小猫**

- 宽屏（>1180px）加载 Live2D 模型，模型、纹理和动作文件全部在本地
- 窄屏只显示静态猫图；手机端不显示
- WebGL 不可用或模型加载失败时，自动退回静态猫图
- 静态猫图默认可见，Live2D 就绪后自动淡出，所以不会出现「猫始终没出现」

## 目录

```text
blog/
├─ content/
│  ├─ site.json               站点名、作者、邮箱、链接
│  ├─ words.json              CET-4 单词数据
│  ├─ about.html              关于页正文
│  └─ posts/*.html            文章 + front matter
├─ theme/
│  ├─ layout.mjs              页面骨架、导航、侧栏、页脚
│  ├─ utils.mjs               转义、日期、slug
│  └─ assets/
│     ├─ css/site.css         全部样式与动效
│     ├─ js/site.js           搜索、灯箱、留言、标签筛选、转场
│     ├─ js/cat.js            Live2D 启动与静态猫兜底
│     ├─ js/words.js          单词卡、词表、测验
│     ├─ icons.svg            SVG 图标 sprite
│     └─ img/*.svg            头像、封面、favicon
├─ live2d/                    Tororo 模型与台词配置
├─ vendor/live2d/             live2d-widget 运行时（GPL-3.0）
├─ build.mjs                  静态生成器（零依赖）
├─ serve.mjs                  本地静态服务器
└─ public/                    生成结果，部署这个目录
```

## 写一篇文章

在 `content/posts/` 新建 `.html` 文件，开头放一段 JSON 作为 front matter：

```html
<!--meta
{
  "slug": "my-first-post",
  "title": "第一篇文章",
  "subtitle": "可选的一句话",
  "date": "2026-11-03",
  "updated": "2026-11-03",
  "category": "随笔",
  "tags": ["开始", "记录"],
  "cover": "/assets/img/cover-horizon.svg",
  "coverAlt": "封面描述",
  "excerpt": "显示在首页的一段摘要。",
  "featured": false,
  "views": "1.2k",
  "reading": 4
}
-->
<p>正文从这里开始，直接写 HTML。</p>
<h2 id="section">小节标题</h2>
```

- `slug` 决定地址：`/posts/my-first-post.html`
- `reading` 不填会自动按中文字数估算
- `cover` 不填就不显示封面
- 标题里的 `h2` / `h3` 会自动生成目录和锚点
- 构建：`npm run build`

摘要、分类、标签、搜索索引、RSS、归档和分页都会自动重新生成。

## 单词本

单词数据在 `content/words.json`，页面地址：

```text
http://127.0.0.1:4200/words.html
```

每个词：

```json
{
  "word": "nuisance",
  "phonetic": "",
  "pos": "",
  "meaning": "令人讨厌的东西，讨厌的人",
  "example": "",
  "translation": "",
  "tags": ["DAY 1", "第一章"]
}
```

页面有三种模式：

- 卡片：翻面看释义，按 `1/2/3` 标记不认识/模糊/认识
- 词表：按字母、状态、关键词筛选
- 测验：10 题四选一，错词会记录

首页第 1 页还会自动生成一张 `.home-word-card` 入口卡片，显示总词数和 DAY 数。文案和样式分别在 `build.mjs → renderHome()` 和 `theme/assets/css/site.css → .home-word-card`。

进度只存在浏览器 `localStorage`，换设备不同步。

## 改成你的

主要改 `content/site.json`：

```json
{
  "title": "你的博客名",
  "subtitle": "一句副标题",
  "author": "你的名字",
  "description": "站点描述",
  "url": "https://your-domain.com",
  "avatar": "/assets/img/avatar.svg",
  "email": "you@example.com",
  "github": "https://github.com/yourname"
}
```

- 头像：替换 `theme/assets/img/avatar.svg`（或把 `avatar` 指到一张 png/jpg）
- 封面：替换 `theme/assets/img/cover-*.svg`
- 颜色：`theme/assets/css/site.css` 顶部的 `:root` 变量
- 导航：`theme/layout.mjs` 里的 `NAV`
- 小猫台词：`live2d/waifu-tips.json`
- 小猫大小 / 位置：`site.css` 末尾的 `#waifu`、`#live2d`、`#waifu-tips`
- 关闭小猫：删掉 `theme/layout.mjs` 底部的 `cat.js` 引用，或让 `cat.js` 直接返回

## 配置地图（不知道改哪时用它）

页面右下角有一个笔形按钮，点开后是「配置地图」。也可以按 `Ctrl + Shift + E`，或者直接打开：

```text
http://127.0.0.1:4200/?edit-map=1
```

用法：

- 鼠标移到页面标题、导航、文章卡片、猫、页脚上，会浮出对应的文件和字段
- 右侧面板可以搜索「头像」「颜色」「猫」
- 点面板里的条目会滚动定位到页面元素
- 点页面元素只会提示路径，不会跳转；按 `C` 可以复制路径
- 它只是阅读辅助，**不会修改任何文件**

## 数据结构可视化实验室

可视化版（导航「学习」默认进入）：

```text
http://127.0.0.1:4200/visual.html?demo=1
```

文字诊断版 / 教师班级 / 实验设计：

```text
http://127.0.0.1:4200/learn.html?demo=1
http://127.0.0.1:4200/learn.html?demo=1&view=teacher
```

当前版本是“知识图谱可视化诊断”的 Demo：

- 10 个数据结构知识点，知识地图展示先修关系
- 节点大小表示课程权重，节点圆环表示完成度
- 总完成度环形图、章节完成度、知识点热力块
- 二分查找逐步动画：low / high / mid 指针、区间排除、找到目标
- 点击其他知识点显示“动画制作中”占位，后续按同一框架补齐
- 文字诊断版提供错因分布、前置知识、诊断结论、下一步建议
- 教师班级视图：30 名模拟学生、班级热力图、薄弱点、需关注学生
- 实验设计视图：30 人、4 周、A/B 对照、诊断效率与学习效果指标
- 学生答题进度保存在浏览器 localStorage
- 教师班级数据为模拟数据，真实对照实验尚未开始

数据在 `content/dsa.json`，可视化交互在 `theme/assets/js/visual.js`，文字诊断在 `theme/assets/js/dsa.js`。

这是学习平台的第一块试验田，不是完整平台；登录、题库后台、代码判题和知识图谱数据库都还没接。

## 陪伴博客 Demo

手机版原型：

```text
http://127.0.0.1:4200/assets/companion-demo.html
```

这是一个独立的移动端 Demo，不依赖博客布局：

- 单文件版：`http://127.0.0.1:4200/assets/companion-single.html`，可直接发给组员、双击打开
- 单文件版内嵌同一只猫的透明帧，用 CSS 做呼吸动画，不加载外部资源
- 实时 Live2D 版：`http://127.0.0.1:4200/assets/companion-demo.html`，需要服务器上的 `vendor/live2d` 和 `live2d` 资源
- 纸感 / 手写 / 奶油配色，参考 `小本子.html` 的气质
- 博客推荐作为首页主内容
- 心情打卡 + 七日心情条
- 番茄钟
- 今日待办
- 今日小记
- 小满宠物状态（陪伴 / 专注 / 鼓舞 / 安抚）
- 陪伴页接入博客同一只 Tororo Live2D 小猫；WebGL 不可用时回退到 CSS 小猫
- Live2D 模型版权属于原作者，公开部署前需确认许可
- 博客列表 / 搜索 / 分类
- 我的页面：模块开关、统计
- 数据只保存在 localStorage

后续可以接 Spring Boot 后端，并把同一套移动端页面套壳成 App。

## 真题库

2024–2025 四级真题和解析，列表页：

```text
http://127.0.0.1:4200/papers.html
```

阅读器：

```text
http://127.0.0.1:4200/paper.html?file=/assets/papers/2024-06/set1-paper.pdf
```

- 9 套真题，18 份 PDF，约 336MB
- PDF 文件在 `theme/assets/papers/`
- 索引在 `content/papers.json`
- 阅读器用本地 PDF.js，支持翻页、缩放、适合宽度、全屏、下载
- 听力音频暂未导入，因为音频总量约 1GB，加上 PDF 会超过 GitHub Pages 上限

增加试卷：

1. 把 PDF 放进 `theme/assets/papers/<年份-月份>/`
2. 在 `content/papers.json` 加一条
3. `npm run build`

## 部署到 GitHub Pages

这个项目已经带好 GitHub Actions 配置：`.github/workflows/pages.yml`。推送到 `main` 后会自动构建 `public/` 并部署。

### 1. 仓库名很重要

当前站点的资源路径是 `/assets/...` 这种根路径，所以推荐把仓库命名为：

```text
<你的 GitHub 用户名>.github.io
```

例如用户名是 `dadasheng`，仓库就叫 `dadasheng.github.io`，最终地址是：

```text
https://dadasheng.github.io/
```

这样不需要改任何路径。

如果你用普通项目仓库（比如 `my-blog`），地址会变成 `https://dadasheng.github.io/my-blog/`，当前绝对路径会找不到 CSS 和图片。遇到这种情况，先告诉我，我可以给它加 `base` 前缀支持。

### 2. 上传源码

进入 `blog` 目录，把**这个目录里的内容**作为仓库根目录，而不是把 `blog` 文件夹本身再套一层：

```bash
cd blog
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

`.gitignore` 已经忽略了 `public/`，只上传源码，构建交给 GitHub Actions。

### 3. 开启 Pages

1. 打开 GitHub 仓库的 **Settings → Pages**
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 回到 **Actions** 页面，等 `Deploy blog to GitHub Pages` 跑完
4. 打开 `https://你的用户名.github.io/`

### 4. 站点地址

Actions 工作流会自动把构建地址设为：

```text
https://<你的 GitHub 用户名>.github.io
```

所以仓库名为 `<用户名>.github.io` 时，RSS、canonical 和分享链接会自动正确。

如果你的仓库名不是这个，或者使用自定义域名，请修改 `.github/workflows/pages.yml` 里的：

```yaml
SITE_URL: https://${{ github.repository_owner }}.github.io
```

或者删掉 `SITE_URL` 这一段，然后改 `content/site.json` 里的 `url`。

### 5. 以后更新

改 `content/posts/`、`content/site.json` 或样式后：

```bash
git add .
git commit -m "new post"
git push
```

GitHub Actions 会自动重新构建并发布，不需要手动上传 `public/`。

也可以直接在 GitHub 网页上编辑 `content/posts/xxx.html`，提交后 Action 同样会重新部署。

注意：**不要直接改仓库里的 `public/`**，它每次都会被重新生成覆盖。

站点使用根路径（`/assets/...`）。如果要部署到子目录，需要给布局和 CSS 里的绝对路径加统一前缀。

## 关于小猫的授权

Tororo 模型是从原站 `blog.daliansky.net` 的公开资源中取下来做本地演示的。模型版权属于原作者，**公开部署前请先确认授权，或换成你有权使用的 Live2D 模型**。`live2d-widget` 采用 GPL-3.0，许可证放在 `vendor/live2d/LICENSE`。

具体来源和参考记录见 [CREDITS.md](CREDITS.md)。

## 技术说明

- 零第三方依赖。`build.mjs` 只使用 Node 内置模块，`site.js` 不依赖框架。
- 生成器在 `build.mjs` 里，约 500 行，负责：文章排序、分类/标签统计、目录、分页、首页卡片、RSS、搜索索引、站点地图。
- `.js .reveal` 才会隐藏卡片；如果 JavaScript 加载失败，内容仍然完整可读。
- 搜索索引在第一次打开搜索框时才请求，不拖慢首屏。
- 留言板是静态站演示，只写入浏览器的 `localStorage`，不会上传。需要真实评论时可以接 Giscus / Waline。

## 命令

```bash
npm run build   # 生成 public/
npm start       # 启动本地预览（4200）
npm run dev     # 先构建再启动
```

构建输出示例：

```text
2 posts / 2 categories / 6 tags / 1742 vocabulary words / 9 paper sets
1 home page(s), 2k words
```

## 已知取舍

- 文章是 HTML，不是 Markdown。这样不用装 Markdown 解析器，也方便直接塞入复杂组件；写纯文字时稍微啰嗦一点。
- 小猫的 8 段随机动作来自模型自身，不做额外编排。
- 免费静态托管通常没有服务端，留言和阅读量都是演示数据；阅读量在 front matter 里手写。
- 真题 PDF 目前只导入 2024–2025 的 9 套，共约 336MB；听力音频约 1GB，和 PDF 一起会超过 GitHub Pages 上限，暂未导入。
- 真题 PDF 由你提供，默认按个人学习用途使用；公开部署前请确认资料版权。
- PDF 阅读器使用 PDF.js，许可证在 `theme/assets/vendor/pdfjs/LICENSE`。
- 插画是 SVG 手绘的抽象场景，不是照片。想换成自己的照片，直接替换 cover 文件即可。

---

如果你把它改成自己的博客，记得把 `晚风`、`晚风小筑`、`hello@example.com` 和 GitHub 地址换掉。
