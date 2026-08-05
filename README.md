# ForgeDesk

ForgeDesk is a local-first project management console for technical leads, founders, and independent developers.

It organizes work around projects first, then repositories, people, environments, deployments, cloud providers, and AI analysis.

## V1 Scope

- Project overview
- Local repository scanning
- Git status visibility
- company Gitea and GitHub CI/CD same-branch alignment checks
- Person and Git identity mapping
- Environment management
- Vercel and Railway provider placeholders
- AI project daily report scaffold

## Tech Stack

- Electron
- React
- TypeScript
- Ant Design
- SQLite
- simple-git
- chokidar
- Zustand
- ECharts

## Development

```bash
npm install
npm run dev
```

## 下载与安装

macOS 用户可以前往 [GitHub Releases](https://github.com/IEatLemons/ForgeDesk/releases) 下载最新安装包。目前发布的是 Apple Silicon（`arm64`）版本，下载 `.dmg` 后将 `ForgeDesk.app` 拖入“应用程序”目录即可。

### macOS 提示“应用已损坏，无法打开”？

这是 macOS Gatekeeper 对非 App Store 应用的安全提示。当前开源发布流程尚未接入 Apple Developer ID 签名和公证，部分 macOS 版本可能因此拦截应用。请确认安装包来自可信的 ForgeDesk Release 后，再按以下方式处理：

1. 打开“终端”，执行：

   ```bash
   sudo xattr -rd com.apple.quarantine "/Applications/ForgeDesk.app"
   ```

   如果应用没有放在“应用程序”目录，请将命令中的路径改成实际位置。

2. 再次启动应用。如果仍被拦截，请打开“系统设置 → 隐私与安全性”，点击“仍要打开”。

> 注意：上述命令会移除下载文件的 quarantine 属性，降低 macOS 对该应用的拦截保护。请勿对来源不明的应用执行。

### 应用自动更新

已安装的 ForgeDesk 会在启动后自动检查 GitHub Releases，并每小时轮询一次。新版会在后台下载，下载完成后在应用内提示“重启安装”。开发模式不会连接更新源；请使用打包后的 `.app` 测试更新流程。

发布新版本时，先把 `package.json` 的版本号改为目标版本并提交，再推送对应的 `v<version>` tag。GitHub Actions 会构建并发布 macOS arm64 的 `.dmg`、`.zip`、blockmap 和 `latest-mac.yml`，其中 `latest-mac.yml` 是 Electron 更新器必须的版本清单。

## Android APK

The Android build is a WebView shell around the renderer bundle. It is intended for mobile viewing and keeps the existing Electron desktop build unchanged. Build it with:

```bash
npm run package:android
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Electron-only features such as local Git operations, terminals, Docker, and SQLite-backed persistence remain desktop-only until they are ported to Android services.

The product document is stored at `docs/ForgeDesk 项目文档.pdf`.

## Lark 多维表格机器人

ForgeDesk 已支持接入独立的 Lark Bot Service：在“设置 → OA / Lark 文档”中填写 Bot Service 地址和 `ADMIN_TOKEN` 后，可以查看多维表格任务与通知记录，并执行立即同步、测试消息、立即提醒和运行配置修改。管理令牌只保存在主进程的本机设置文件中，渲染页面不会回显明文。

Bot Service 本身需要先按 Lark Bot 项目的 README 部署，并确保其 `/admin/api/*` 可从 ForgeDesk 所在机器访问。Lark 的事件回调仍然直接指向 Bot Service 的 `/lark/events`，不经过 ForgeDesk。

## License

MIT
