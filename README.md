<div align="center">

# 大学记账

**离线优先的大学生记账 PWA · 预算管理 · 三餐统计 · 数据保护**

[![在线体验](https://img.shields.io/badge/在线体验-GitHub%20Pages-2ea44f?style=for-the-badge)](https://cookyyykc.github.io/my-budget-app/)
[![PWA](https://img.shields.io/badge/PWA-iOS%20可安装-5a67d8?style=for-the-badge)](#安装到-iphone)
[![Offline](https://img.shields.io/badge/Offline-断网可用-0f766e?style=for-the-badge)](#断网也能用)
[![Vanilla JS](https://img.shields.io/badge/Vanilla%20JS-零依赖-f7df1e?style=for-the-badge&logo=javascript&logoColor=111)](#技术栈)

[在线体验](https://cookyyykc.github.io/my-budget-app/) · [功能](#功能) · [快速开始](#快速开始) · [项目结构](#项目结构) · [路线图](#路线图)

![大学记账首页](<screenshots/1-记账.png>)

</div>

## 项目简介

大学记账是一个面向学生日常场景设计的记账应用。它不需要后端，也不用安装原生 App：用 Safari 打开后添加到主屏幕，就能像普通 iOS App 一样全屏运行。所有账单保存在本机，弱网和断网状态下仍可继续记账。

项目重点不是「功能堆得多」，而是把记账场景做顺手：快速记一笔、忘记记了能补记、三餐预算分得清、数据不会因为清缓存或弱网莫名丢失。

## 功能

| 模块 | 说明 |
| --- | --- |
| 快速记账 | 大数字键盘、分类选择、两步到三步完成，支持连续记账、震动反馈和 Toast 提示 |
| 时间与补记 | 每笔记录包含日期和时间，改时间会自动匹配餐次；支持从预算条、明细页和日期按钮补记 |
| 预算管理 | 月预算、分类预算、三餐子预算；支持宽松、严格和结余滚存三种模式 |
| 三餐统计 | 早餐、午餐、晚餐分别统计总额、记录天数和日均；零食单列，不混入三餐合计 |
| 明细与编辑 | 时间倒序明细、按标签搜索；点开任意记录即可修改金额、分类、餐次、时间、备注 |
| 数据保护 | 主数据与冗余快照双写、JSON 完整备份与恢复、持久化存储申请、崩溃兜底导出 |
| 离线能力 | Service Worker 缓存界面，IndexedDB 离线队列暂存改动，恢复网络后自动同步本机备份库 |
| iOS 体验 | 可添加到主屏幕、全屏运行、适配安全区域、支持深色模式、原生风格底部导航 |

## 截图

| 记账 | 统计 |
| --- | --- |
| ![记账页](<screenshots/1-记账.png>) | ![统计页](<screenshots/2-统计.png>) |

| 明细与编辑 | 三餐预算 |
| --- | --- |
| ![明细页](<screenshots/5-明细.png>) | ![三餐预算](<screenshots/10-三餐子预算.png>) |

| 数据保护 | 深色模式 |
| --- | --- |
| ![数据保护](<screenshots/8-数据保护.png>) | ![深色模式](<screenshots/4-深色模式.png>) |

## 快速开始

### 本地运行

只需要 Node.js，无构建步骤、无第三方依赖。

```bash
git clone https://github.com/cookyyykc/my-budget-app.git
cd my-budget-app
node serve.mjs
```

终端会打印本机和局域网访问地址，浏览器直接打开即可。

### 安装到 iPhone

1. iPhone 与电脑连接同一个 Wi-Fi。
2. Safari 打开终端打印的局域网地址。
3. 点击分享按钮，选择 **添加到主屏幕**。
4. 从主屏幕图标启动，即可全屏、离线使用。

也可以直接打开线上版本：

**https://cookyyykc.github.io/my-budget-app/**

## 断网也能用

这个项目使用两层离线策略：

- **Service Worker**：缓存 HTML、CSS、JavaScript 和图标；网络超时后自动切换到缓存，避免校园网或弱网卡住。
- **IndexedDB 队列**：离线期间产生的记录先进入本机队列，恢复网络后自动写入第二份本机备份库；支持 Background Sync，并保留 iOS 的 online 事件兜底。

数据默认只保存在当前浏览器，不会上传服务器。换设备前请先在「我的 → 数据」中导出 JSON 备份。

## 技术栈

```text
HTML5 + CSS3 + JavaScript ES Modules
Service Worker + Web App Manifest
localStorage + IndexedDB
Pointer Events + Web Animations API
Node.js 静态服务器（仅本地开发）
```

没有框架，没有打包器，没有运行时依赖。部署到任意静态托管平台即可运行。

## 项目结构

```text
.
├── index.html              # 应用骨架
├── styles.css              # 设计系统与页面样式
├── manifest.webmanifest    # PWA 清单
├── sw.js                   # Service Worker 离线缓存与后台同步
├── js/
│   ├── app.js              # 启动、底部导航和页面路由
│   ├── store.js            # 数据模型、备份和统计口径
│   ├── views.js            # 四个页签的视图与交互
│   ├── components.js       # 图标、弹层、预算条、餐盘图
│   ├── format.js           # 金额与日期工具
│   └── sync-queue.js       # 离线队列与同步调度
├── icons/                  # PWA 与主屏幕图标
├── screenshots/            # README 展示截图
└── serve.mjs               # 本地静态服务器
```

## 统计口径

- 金额统一以「分」存储，避免浮点误差。
- 三餐合计 = 早餐 + 午餐 + 晚餐。
- 零食单列，不包含在三餐合计内。
- 餐饮合计 = 三餐 + 零食。
- 日均 = 该餐次总额 ÷ 有记录天数；天数为 0 时不显示日均。
- 预算滚存支持宽松、严格、结余滚存三种模式。

## 路线图

- [x] 快速记账、分类和备注
- [x] 月预算、分类预算、三餐预算
- [x] 统计图表、明细搜索和记录编辑
- [x] PWA、离线队列和数据备份
- [ ] 云同步与多设备登录
- [ ] 储蓄目标与奖助学金管理
- [ ] 记账提醒和隐私锁

## 说明

这是一个个人学习与实践项目，当前定位是本地优先的轻量记账工具。欢迎通过 Issue 反馈问题，或提交 Pull Request 一起完善。
