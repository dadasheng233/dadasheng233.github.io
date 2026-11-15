# 晚风小筑 · 后端

Spring Boot 3.4 + Java 21 + H2（默认）/ MySQL。负责四件事：

1. **账号**：注册、登录、退出、当前用户，BCrypt 密码 + HttpOnly Session Cookie。
2. **学习进度云同步**：单词本、数据结构诊断的 localStorage 进度按账号存到服务器。
3. **后台发文**：在网页里新建/编辑/删除 `content/posts/*.html`，一键运行 `node build.mjs` 重新生成站点。
4. **408 题库**：导入题库、在线练习、错题本、正确率统计。

静态页面仍然由根目录的 `build.mjs` 生成；后端只是额外提供 `/api/**`，并把 `public/` 一起托管，所以开发时只开 8080 一个端口就够了。

## 启动

需要 **JDK 17+（推荐 21）** 和 Maven。

```text
双击  G:\newwork\blog\启动后端.bat
```

或命令行：

```bash
cd blog
npm run build          # 先生成 public/（第一次或改了文章后）
npm run server         # 等价于 cd server && mvn spring-boot:run
```

打开 <http://127.0.0.1:8080>。

也可以继续用 `npm start` 在 4200 看纯静态预览；登录相关请求会自动发到 8080（见 `theme/assets/js/account.js` 里的 API 推断）。

> 第一次启动 Maven 要下载依赖，会写进 `server/.m2repo/`（已 gitignore），之后秒开。

## 默认管理员

| 用户名 | 密码 |
| --- | --- |
| `admin` | `wanfeng-408` |

第一次启动时自动创建。**部署到公网前一定要改**：

```bash
set BLOG_ADMIN_PASSWORD=换成你自己的密码
```

PowerShell：

```powershell
$env:BLOG_ADMIN_PASSWORD = "换成你自己的密码"
npm run server
```

也可以直接改 `server/src/main/resources/application.yml` 里的 `app.admin`。

首次启动还会导入一套 20 题的「408 基础自测（示例题库）」，在练习页可以直接看到；不想要就在后台删掉。

## 配置

`server/src/main/resources/application.yml`：

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `server.port` | `8080` | 端口，可用 `SERVER_PORT` 覆盖 |
| `spring.datasource.url` | `jdbc:h2:file:./data/blog` | 数据文件在 `server/data/` |
| `app.public-dir` | `../public` | 静态站目录，找不到会自动试 `public/` |
| `app.content-dir` | `../content` | 文章、题库源文件目录 |
| `app.site-dir` | `..` | `build.mjs` 所在目录 |
| `app.node-command` | `node` | 构建时的 Node 命令 |
| `app.admin.*` | `admin / wanfeng-408` | 初始管理员 |
| `app.cors.allowed-origins` | 本地 4200/8080 | 预览端口跨域用 |

### 换 MySQL

```bash
CREATE DATABASE wanfeng_blog DEFAULT CHARACTER SET utf8mb4;
```

```bash
# PowerShell
$env:MYSQL_URL="jdbc:mysql://127.0.0.1:3306/wanfeng_blog?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD="你的密码"
cd server
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

表结构在 `schema-mysql.sql`，启动时自动建表（`CREATE TABLE IF NOT EXISTS`）。

## 接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 公开 | `{username, password, displayName}`，注册后自动登录 |
| POST | `/api/auth/login` | 公开 | `{username, password}` |
| POST | `/api/auth/logout` | 公开 | 退出并销毁 Session |
| GET | `/api/auth/me` | 公开 | `{authenticated, user}` |
| GET | `/api/progress` | 登录 | 当前账号全部进度 |
| GET | `/api/progress/{kind}` | 登录 | 某一类进度，`kind` 如 `words` / `dsa` |
| PUT | `/api/progress/{kind}` | 登录 | 覆盖保存任意 JSON（≤512KB） |
| DELETE | `/api/progress/{kind}` | 登录 | 删除这类进度 |
| GET | `/api/questions/sets` | 公开 | 已发布题库列表 |
| GET | `/api/questions/sets/{id}` | 公开 | 题库详情（不含答案） |
| POST | `/api/questions/{id}/answer` | 公开 | 提交答案，登录时自动记录 |
| GET | `/api/practice/wrong-book` | 登录 | 错题本 |
| GET | `/api/practice/stats` | 登录 | 正确率、分科统计 |
| GET | `/api/practice/recent` | 登录 | 最近作答 |
| GET/POST/PUT/DELETE | `/api/admin/posts/**` | 管理员 | 文章增删改查 |
| POST | `/api/admin/build` | 管理员 | 运行 `node build.mjs` |
| GET | `/api/admin/questions/sets` | 管理员 | 含隐藏题库 |
| POST | `/api/admin/questions/import` | 管理员 | 导入题库 |
| PATCH | `/api/admin/questions/sets/{id}/publish` | 管理员 | 发布 / 隐藏 |
| DELETE | `/api/admin/questions/sets/{id}` | 管理员 | 删除题库 |

Session Cookie 名是 `BLOG_SESSION`，`HttpOnly` + `SameSite=Lax`，默认 7 天。

## 408 题库格式

后台「408 题库 → 导入题库」支持粘贴 JSON 或选择 `.json` 文件：

```json
{
  "title": "2024 年 408 真题 · 数据结构",
  "subject": "ds",
  "year": 2024,
  "source": "王道",
  "description": "第一轮刷题用",
  "questions": [
    {
      "type": "single",
      "stem": "题干，支持 HTML 之外的纯文本。",
      "options": [
        { "key": "A", "text": "选项 A" },
        { "key": "B", "text": "选项 B" },
        { "key": "C", "text": "选项 C" },
        { "key": "D", "text": "选项 D" }
      ],
      "answer": "A",
      "analysis": "解析。",
      "difficulty": 2,
      "knowledge": "顺序表"
    }
  ]
}
```

- `subject`：`ds` 数据结构 / `co` 计算机组成原理 / `os` 操作系统 / `cn` 计算机网络
- `type`：`single` 单选 / `multiple` 多选（答案如 `"AC"`）/ `judge` 判断
- `answer` 必须在选项编号里；单选只能一个字母
- 一次最多 500 题，单套题库超过就分多套导入

答案只存在服务器，练习时不会下发给浏览器；提交后由后端判分并返回解析。

## 数据与备份

- 数据库：`server/data/blog.mv.db`（H2 单文件），直接复制就是备份。
- 想重置：停止后端，删掉 `server/data/`，再启动即可重新建库、重建管理员和示例题库。
- 文章：`content/posts/*.html`，后台保存的就是它们；删除会移到 `content/backups/`。

## 打包部署

```bash
cd server
mvn clean package -DskipTests
java -jar target/blog-server.jar --app.public-dir=../public --app.content-dir=../content --app.site-dir=..
```

前提是同一台机器上有 `public/`（先 `npm run build`）和 `content/`，因为后台发文和构建依赖它们。

注意：

- **GitHub Pages 只能托管静态文件，跑不了这个后端。** 纯静态部署时登录/同步/题库都会不可用，页面会提示连不上后端。
- 要在公网用账号，需要一台能跑 Java 的服务器（VPS / 云服务器 / Render 等），前面套 Nginx + HTTPS；HTTPS 下把 `server.servlet.session.cookie.secure` 设为 `true`。
- 如果前端和后端不同源，在 `content/site.json` 加 `"apiBase": "https://api.example.com"`，`build.mjs` 会把它写进 `<meta name="blog-api">`，前端据此请求。
- 公网部署前一定要改默认管理员密码，并考虑关闭公开注册（目前所有 `/api/auth/register` 都开放）。

## 目录

```text
server/
├─ pom.xml
├─ .mvn/maven.config            依赖下载到 .m2repo/，不污染全局 ~/.m2
├─ start.cmd                    双击启动（自动找 JDK 21/17）
└─ src/main/
   ├─ java/com/wanfeng/blog/
   │  ├─ auth/                  账号、Session
   │  ├─ progress/              进度云同步
   │  ├─ admin/                 文章文件读写 + 构建
   │  ├─ question/              408 题库、判分、错题本
   │  ├─ config/                安全、静态资源、初始化
   │  └─ web/                   404 页面
   └─ resources/
      ├─ application.yml
      ├─ schema-h2.sql
      ├─ schema-mysql.sql
      └─ seed/408-sample.json
```
