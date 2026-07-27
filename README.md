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
