# Railway 连接与 OAuth 登录

ForgeDesk 支持 API Token 和 Native OAuth 两种 Railway 认证方式。GraphQL 地址为 `https://backboard.railway.com/graphql/v2`。

## 项目内管理连接

进入 **项目 → 项目设置 → 运行配置 → 服务配置 → 平台连接与凭据**，点击 **配置 Railway Token / 连接**。默认使用 API Token，可切换 OAuth。每个 ForgeDesk 项目独立保存连接、同步服务和发布目标；同步后服务自动归入当前项目，无需到全局服务中心绑定。全局服务中心保留部署汇总，设置目录不再提供全局凭据入口。

已有项目绑定会自动迁移；曾在多个项目共用的连接和服务会拆为各项目自己的记录，并保留环境、域名、监控记录、部署缓存和已保存的发布目标。OAuth 副本保留 Client ID，但需要重新登录，避免两个项目共用会轮换的刷新令牌。尚未绑定任何项目的旧全局连接仍保留在本地数据库，需在目标项目重新配置。

## 注册 Native OAuth 应用

1. 由 Railway Workspace 管理员打开 **Workspace Settings → Developer → New OAuth App**。
2. 应用名称填写 ForgeDesk，类型选择 **Native / Public**。
3. 将 Redirect URI 精确设置为 `http://127.0.0.1:43827/oauth/railway/callback`。主机、端口、路径与末尾斜杠必须一致。
4. 复制 Client ID，在 ForgeDesk 当前项目的运行配置 / 服务配置中新增 Railway 连接，选择 **Railway OAuth 登录**，填写 Client ID 和连接名称。
5. 点击 **登录并保存**，在系统浏览器同意授权并选择项目。成功后在 ForgeDesk 点击同步。

Native 应用不使用 Client Secret。ForgeDesk 采用授权码流程、PKCE S256、state、nonce 和 ID Token 签名校验。发现地址为 `https://backboard.railway.com/oauth/.well-known/openid-configuration`，当前签名算法为 ES256。

请求的权限为 `openid email profile offline_access project:member`，并显式设置 `prompt=consent`。只能访问用户选择的项目，实际操作还受用户自身角色限制。重新点击登录并保存可以重新选择授权项目。

## 凭证与断开连接

访问令牌和刷新令牌只在主进程处理，使用 Electron safeStorage 加密后保存。系统无法提供安全加密（包括 Linux 的 basic_text 后端）时仅保存在内存，界面会提示重启后需要重新登录。到期前自动刷新，同一连接的并发请求共享一次刷新，轮换后的刷新令牌会一并保存。

**断开 OAuth** 清除本地凭证并保留已有服务和项目绑定；它不会删除 Railway 服务，也不撤销 Railway 端的应用授权。需要完全撤销时，在 Railway 的 Authorized Apps 中操作。**删除服务连接**仍按原有行为删除关联的本地服务记录。

## API Token

- Account Token 和 Workspace Token 使用 `Authorization: Bearer …`。Workspace Token 需要填写 Workspace ID。
- Project Token 使用 `Project-Access-Token`，只同步其绑定的项目环境。
- 旧连接自动按 API Token 处理，不需要重新配置。
- 构建日志使用 `buildLogs(deploymentId: …)`；运行日志使用 `deploymentLogs(deploymentId: …)`，限定到选中服务的部署。

## 常见问题

- **43827 被占用**：释放该端口后重新登录。ForgeDesk 不会变更已登记的回调地址。
- **拒绝授权、超时或取消**：重新点击登录并保存，每次都会创建新的授权会话。
- **需要重新登录**：授权已撤销、刷新令牌无效，或会话凭证无法恢复。重新授权即可保留原服务绑定继续使用。
- **`could not validate id_token_hint`**：若出现在 Codex Railway 插件连接页面，这是插件的授权流程错误，需要在插件连接端处理。ForgeDesk 的 Native 登录不发送 `id_token_hint`；本功能不代表已修复外部插件认证。

## 验证

`pnpm exec tsc --noEmit` 检查类型；`node scripts/run-tests.mjs railway-oauth service-provider-adapters service-monitoring project-service-ownership project-deployment service-config-guide service-monitor-view` 验证本地模拟授权与适配器。OAuth 测试需要允许监听 `127.0.0.1:43827`，不需要真实账号，也不会部署 Railway 服务。

真实验收需要已注册的 Native Client ID：完成浏览器授权、同步所选项目、读取状态和日志、重启恢复以及过期刷新验证。缺少该配置时不能宣称真实登录已验证。

2026-10-22 核对公开实时 Schema：`deploymentRollback(id: String!)` 返回 `Boolean!`，与 API Cookbook 中的对象示例存在差异。实现以实时 Schema 为准；18 种现有查询及部署操作已做本地 Schema 校验，校验过程只向 Railway 发送 introspection 查询，不发送部署操作。

参考：[Public API](https://docs.railway.com/integrations/api)、[注册应用](https://docs.railway.com/integrations/oauth/creating-an-app)、[Login & Tokens](https://docs.railway.com/integrations/oauth/login-and-tokens)、[授权项目](https://docs.railway.com/integrations/oauth/fetching-workspaces-or-projects)。
