export type NextjsPm2PackageManager = 'pnpm' | 'npm' | 'yarn'

export type NextjsPm2DeployConfigInput = {
  sshHost?: string
  remotePath?: string
  uploadPath?: string
  appName?: string
  port?: string | number
  startCommand?: string
  installCommand?: string
}

export type NextjsPm2DeployConfig = {
  sshHost: string
  remotePath: string
  uploadPath: string
  appName: string
  port: number
  startCommand: string
  installCommand: string
}

export type NextjsProjectPackageInfo = {
  scripts: Record<string, string>
  raw: Record<string, unknown>
}

export type NextjsPm2RemoteDeployScriptInput = {
  config: NextjsPm2DeployConfig
  packageManager: NextjsPm2PackageManager
  archiveName: string
  releaseName: string
  standalone: boolean
}

function getDependencyMap(raw: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = raw[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizePath(value: string): string {
  return value.replace(/\/+$/, '') || '/'
}

function assertRemotePath(value: string, label: string): string {
  const normalized = normalizePath(value.trim())

  if (!normalized || normalized === '.') {
    throw new Error(`请输入${label}`)
  }

  if (!normalized.startsWith('/')) {
    throw new Error(`${label}必须是服务器上的绝对路径`)
  }

  if (/\s/.test(normalized)) {
    throw new Error(`${label}不能包含空格`)
  }

  return normalized
}

export function sanitizeReleaseName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createNextjsPm2ArtifactName(repositoryName: string, version: string): string {
  const baseName = sanitizeReleaseName(`${repositoryName}-${version}`) || sanitizeReleaseName(`release-${version}`) || 'release'
  return `${baseName}.tar.gz`
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function isNextjsProject(packageInfo: NextjsProjectPackageInfo, hasNextConfig: boolean): boolean {
  const dependencies = getDependencyMap(packageInfo.raw, 'dependencies')
  const devDependencies = getDependencyMap(packageInfo.raw, 'devDependencies')
  const scripts = packageInfo.scripts

  return Boolean(
    dependencies.next ||
      devDependencies.next ||
      hasNextConfig ||
      /\bnext\s+build\b/.test(scripts.build ?? '') ||
      /\bnext\s+start\b/.test(scripts.start ?? '')
  )
}

export function normalizeNextjsPm2DeployConfig(input: NextjsPm2DeployConfigInput, repositoryName: string): NextjsPm2DeployConfig {
  const sshHost = input.sshHost?.trim() ?? ''

  if (!sshHost) {
    throw new Error('请输入 SSH 目标')
  }

  if (/\s/.test(sshHost)) {
    throw new Error('SSH 目标不能包含空格')
  }

  const appName = input.appName?.trim() || sanitizeReleaseName(repositoryName) || 'nextjs-app'
  const portValue = input.port === undefined || input.port === '' ? 3000 : Number(input.port)

  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    throw new Error('端口必须是 1 到 65535 之间的数字')
  }

  return {
    sshHost,
    remotePath: assertRemotePath(input.remotePath ?? '', '部署目录'),
    uploadPath: assertRemotePath(input.uploadPath || '/tmp/forgedesk-releases', '上传目录'),
    appName,
    port: portValue,
    startCommand: input.startCommand?.trim() ?? '',
    installCommand: input.installCommand?.trim() ?? ''
  }
}

export function createNextjsPm2RemotePrepareScript(config: NextjsPm2DeployConfig): string {
  return [
    'set -e',
    `mkdir -p ${shellQuote(config.uploadPath)} ${shellQuote(`${config.remotePath}/releases`)}`
  ].join('\n')
}

export function getDefaultNextjsPm2InstallCommand(packageManager: NextjsPm2PackageManager): string {
  if (packageManager === 'pnpm') {
    return 'pnpm install --prod --frozen-lockfile'
  }

  if (packageManager === 'yarn') {
    return 'yarn install --production --frozen-lockfile'
  }

  return 'npm ci --omit=dev || npm install --omit=dev'
}

export function createNextjsPm2RemoteDeployScript(input: NextjsPm2RemoteDeployScriptInput): string {
  const { config, packageManager, archiveName, releaseName, standalone } = input
  const archivePath = `${config.uploadPath}/${archiveName}`
  const releasePath = `${config.remotePath}/releases/${releaseName}`
  const installCommand = config.installCommand || getDefaultNextjsPm2InstallCommand(packageManager)

  return [
    'set -e',
    `APP_NAME=${shellQuote(config.appName)}`,
    `ARCHIVE_PATH=${shellQuote(archivePath)}`,
    `RELEASE_DIR=${shellQuote(releasePath)}`,
    `CURRENT_DIR=${shellQuote(`${config.remotePath}/current`)}`,
    `PORT=${shellQuote(String(config.port))}`,
    `PACKAGE_MANAGER=${shellQuote(packageManager)}`,
    `IS_STANDALONE=${standalone ? '1' : '0'}`,
    `INSTALL_COMMAND=${shellQuote(installCommand)}`,
    `START_COMMAND=${shellQuote(config.startCommand)}`,
    'mkdir -p "$(dirname "$RELEASE_DIR")"',
    'rm -rf "$RELEASE_DIR"',
    'mkdir -p "$RELEASE_DIR"',
    'tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"',
    'cd "$RELEASE_DIR"',
    'if [ "$IS_STANDALONE" != "1" ]; then',
    '  sh -lc "$INSTALL_COMMAND"',
    'fi',
    'ln -sfn "$RELEASE_DIR" "$CURRENT_DIR"',
    'cd "$CURRENT_DIR"',
    'export NODE_ENV=production',
    'export PORT="$PORT"',
    'if pm2 describe "$APP_NAME" >/dev/null 2>&1; then',
    '  pm2 reload "$APP_NAME" --update-env',
    'else',
    '  if [ -n "$START_COMMAND" ]; then',
    '    pm2 start sh --name "$APP_NAME" --cwd "$CURRENT_DIR" -- -lc "$START_COMMAND"',
    '  elif [ "$IS_STANDALONE" = "1" ]; then',
    '    pm2 start server.js --name "$APP_NAME" --cwd "$CURRENT_DIR" --update-env',
    '  elif [ "$PACKAGE_MANAGER" = "pnpm" ]; then',
    '    pm2 start pnpm --name "$APP_NAME" --cwd "$CURRENT_DIR" -- run start -- -p "$PORT"',
    '  elif [ "$PACKAGE_MANAGER" = "yarn" ]; then',
    '    pm2 start yarn --name "$APP_NAME" --cwd "$CURRENT_DIR" -- start -p "$PORT"',
    '  else',
    '    pm2 start npm --name "$APP_NAME" --cwd "$CURRENT_DIR" -- start -- -p "$PORT"',
    '  fi',
    'fi',
    'pm2 save'
  ].join('\n')
}
