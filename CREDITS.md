# Credits & references

这个项目不是对某个站点的整站爬取。版式、配色、代码、文案和 SVG 插画都是重新做的；下面是明确的外部参考和素材来源。

## 视觉参考

- [Hexo NexT](https://theme-next.js.org/) 的 Muse 主题：卡片式文章、居中页头、顶部导航的布局思路。
- [黑果小兵的部落阁](https://blog.daliansky.net/)：深色底 + 白色文章卡片 + 彩虹细线 + 左下角 Live2D 小猫的整体气质。

没有复制上述项目的 CSS、HTML 或文章正文。

## Live2D

- **Tororo 模型**：`live2d/tororo/`，取自 `https://blog.daliansky.net/live2dw/tororo/` 的公开资源，仅用于本地演示。模型版权属于原作者；公开部署前请确认许可，或替换成自己的模型。
- **[live2d-widget](https://github.com/stevenjoezhang/live2d-widget)**：`vendor/live2d/`，版本 1.0.1，GPL-3.0。许可证见 `vendor/live2d/LICENSE`。
- **Live2D Cubism 2 运行时**：`vendor/live2d/live2d.min.js`，随 live2d-widget 分发。

## 图标与插画

- `theme/assets/icons.svg`、`theme/assets/img/*.svg`：为本项目手写的 SVG。
- 卡通白猫头像与静态兜底猫图由参考图整理生成，仅作演示。

## 字体

不打包字体，使用系统字体栈：

- 中文衬线：Noto Serif SC / Source Han Serif SC / Songti SC / SimSun
- 中文无衬线：PingFang SC / Microsoft YaHei
- 等宽：JetBrains Mono / Cascadia Code / Consolas

## 代码

- 生成器、页面布局、交互和动效：本项目原创，MIT 风格使用（转载文章内容除外）。
- 第三方 `vendor/live2d/` 目录保留其原有许可证。
