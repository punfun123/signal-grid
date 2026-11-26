# SIGNAL GRID

A Community-Powered Global Intelligence Network

The World Never Stops. Stay Connected.

网站界面固定为英文。默认入口为全球情报仪表盘，使用深色主题、Global 视图和最近 7 天。地图、面板布局、新闻聚合、直播播放器和自托管 API 继承自 World Monitor。上游版本为 2.11.8，基准提交为 [15db6d39b7a0edff498b9f1417b81d5196d26c3f](https://github.com/koala73/worldmonitor/tree/15db6d39b7a0edff498b9f1417b81d5196d26c3f)。

## 本地运行

使用 Node.js 24。从项目根目录执行以下命令。开发服务器直接使用上游 RSS、RPC 和 bootstrap 处理器。

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

默认端口为 3000。编辑 `.env.local` 可填写 `.env.grid.example` 中的 Redis REST 连接与可选数据源凭证。配置缓存后，在另一个终端运行 `npm run seed:grid -- --watch`。采集脚本继续使用上游的重试、锁、缓存、来源记录和过期策略。仅需更新一次时使用 `npm run seed:grid`。

本次交付的本机预览端口为 4317。该预览运行独立的 Redis 及上游 Redis REST 代理。宿主网络要求显式使用已有 HTTPS 代理的情况下，可对 Node 24 设置 `NODE_USE_ENV_PROXY=1`，并将本机地址加入 `NO_PROXY`。浏览器使用同一网络的正常代理设置。

## 品牌与代币

`src/config/brand.config.ts` 集中管理品牌、代币和源码入口。`public/brand/` 包含原创 SVG 标志和独立图标。Favicon、分享图及 PWA 图标在 `public/favico/`。

| 配置 | 用途 |
| --- | --- |
| `VITE_GRID_CONTRACT_ADDRESS` | 实际合约地址。未填时导航栏显示高亮的 `CA PENDING` 徽标 |
| `VITE_GRID_X_URL` | 官方 X 链接。图标一直显示，配置地址后可点击 |
| `VITE_GRID_CHART_URL` | 已确认的代币行情页面。CA 与链接均填入后显示 |
| `VITE_GRID_PUBLIC_ORIGIN` | 页面 canonical 和分享图片的站点 origin |
| `VITE_GRID_SOURCE_CODE_URL` | 对应当前运行版本的公开源码仓库或下载地址 |
| `GRID_PUBLIC_ORIGIN` | 同一站点的服务端 CORS origin |

品牌值在重新构建后生效。公开的浏览器变量只填写地址和链接。数据源密钥保存在服务端环境变量。

## 数据覆盖

| 数据 | 上游与运行条件 |
| --- | --- |
| 地图底图与边界 | 原版 MapLibre、deck.gl 和地球渲染器，随包的边界数据，OpenFreeMap 或自管 PMTiles |
| 地震、灾害、天气 | USGS、NRCan、GDACS、NASA EONET 和原版各气象源，通过 Redis 采集和过期控制 |
| 新闻 | 原版 RSS digest，带媒体、发布时间、原文链接与覆盖状态 |
| 新闻直播与摄像头 | 在浏览器使用官方 HLS 或 YouTube 播放器。播放器识别到实时信号后显示 LIVE，关闭或失去可用源时显示相应状态 |
| 加密行情 | 原版 CoinPaprika 采集，CoinGecko 作为回退。报价带供应商时间时显示该时间，过期快照标为缓存 |
| 股票、黄金、原油与外汇 | 保留原版行情面板。需要运营方获准使用的 Alpha Vantage、Finnhub、FRED 或 EIA 等数据源，覆盖由供应商和对应采集任务决定 |
| 冲突、制裁、网络中断及交通 | 保留原版公开图层和接口。完整事件覆盖可能需要 ACLED、UCDP、Cloudflare Radar、OpenSky、AISStream 或独立中继。上游已退役的 `iranAttacks` 图层遵循上游停用状态 |

不同媒体、网卡和地区的访问权限由供应商决定。公开部署前按实际用法核对 RSS、行情、摄像头和 HLS 的提供方条款。公开部署需要独立运营的缓存、数据采集与授权。各来源的服务状态可通过 `/api/health?compact=1` 检查。

## Vercel

Vercel 使用 Node.js 24 和 `npm run build:vercel`。构建将原版 API 处理器打包到同一个函数并保留原 URL，根路径进入 `/dashboard`。配置独立 Redis REST、会话密钥、站点和对应源码地址。刷新任务运行在能访问该 Redis 的独立运行环境，持续运行的 AIS 或其他中继可以按需连接。Vercel 可用配额与中继部署依据实际套餐和流量。

生产域名为 [signal-grid-one.vercel.app](https://signal-grid-one.vercel.app)，对应源码在 [punfun123/signal-grid](https://github.com/punfun123/signal-grid)。`production-data.yml` 配置为每 15 分钟请求一次数据刷新，也支持手动触发。任务通过 GitHub Actions secrets 连接生产 Redis。GitHub 运行器无法可靠查询 YouTube 频道的直播状态，生产采集跳过此查询。播放器继续使用各媒体的官方 HLS 或 YouTube 嵌入。上游 GitHub 工作流保存在 `.github/upstream-workflows/`。

## Docker 自托管

从 `.env.grid.example` 复制到 `.env`，为 `REDIS_TOKEN`、`REDIS_PASSWORD`、`WM_SESSION_SECRET` 和 `RELAY_SHARED_SECRET` 各生成一个独立随机值，例如重复执行 `openssl rand -hex 32`。从源码构建本项目镜像。

```sh
docker compose up -d --build
npm ci
npm run seed:grid -- --watch
```

默认访问 `http://127.0.0.1:3000`。Compose 包含原版 nginx、Node API、Redis REST、Redis 和 AIS 中继。其它采集任务参见 [上游自托管参考](SELF_HOSTING.md)。对应源码压缩包可由站点公开提供，也可以指向提供本次构建对应源码的 HTTPS 地址。

## 开源

World Monitor 由 Elie Habib 开发，版权归原作者。此次修改遵循 [AGPL-3.0-only](LICENSE)。仪表盘页脚提供源码与上游归属。交付的源码包包括应用、API、配置、品牌与构建脚本。部署时保留许可和归属，并通过页脚提供该运行版本的对应源码。

## 本地验收

验收日期为 2026 年 11 月 26 日（新加坡时间）。实测覆盖以下路径。

- 桌面和 390 px 移动端页面。验证默认深色、Global、7 天、地图缩放、图层、时间与地区切换，以及 2D／3D 地图。
- 半岛电视台英语、CBS News、Bloomberg 和 DW 在原版播放器内实际解码播放。测试了暂停、继续、静音与退出全屏。
- 摄像头验证了地区切换、单窗／多窗和全屏。纽约画面实际解码，YouTube 的实时确认状态在验收窗口内仍显示连接中。
- RSS 接口样本覆盖 18 个分类、145 家媒体、334 条带来源的报道，覆盖状态为部分可用。地震接口返回 89 条真实记录，快速 bootstrap 返回 50 条天气警报。加密报价接口返回 10 种资产，BTC、ETH、SOL 均带供应商更新时间。
- 用临时本地测试值验证了 CA 的完整复制，以及 X 与图表链接。交付站点的配置保持空值。
- 浏览器验收期间未观察到模型、嵌入或模型服务请求。摘要、聊天、预测、部件代理与本地模型入口均返回 404。
- 通过生产构建、API 类型检查、架构边界检查和 118 项原版直播逻辑测试。本地验收使用原生 Node 和 Redis。Docker 配置见自托管章节。
