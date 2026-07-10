import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createNextjsPm2ArtifactName,
  createNextjsPm2RemoteDeployScript,
  createNextjsPm2RemotePrepareScript,
  isNextjsProject,
  normalizeNextjsPm2DeployConfig,
  shellQuote
} from './nextjs-pm2-release.js'

describe('nextjs pm2 release helpers', () => {
  it('detects Next.js projects from dependencies, config, or scripts', () => {
    assert.equal(isNextjsProject({ scripts: {}, raw: { dependencies: { next: '^15.0.0' } } }, false), true)
    assert.equal(isNextjsProject({ scripts: {}, raw: {} }, true), true)
    assert.equal(isNextjsProject({ scripts: { build: 'next build' }, raw: {} }, false), true)
    assert.equal(isNextjsProject({ scripts: { build: 'vite build' }, raw: {} }, false), false)
  })

  it('normalizes deploy config and defaults app name, upload path, and port', () => {
    const config = normalizeNextjsPm2DeployConfig({
      sshHost: 'deploy@example.com',
      remotePath: '/var/www/my-app/',
      appName: '',
      port: ''
    }, 'My App')

    assert.equal(config.sshHost, 'deploy@example.com')
    assert.equal(config.remotePath, '/var/www/my-app')
    assert.equal(config.uploadPath, '/tmp/forgedesk-releases')
    assert.equal(config.appName, 'My-App')
    assert.equal(config.port, 3000)
  })

  it('rejects unsafe remote targets and paths', () => {
    assert.throws(() => normalizeNextjsPm2DeployConfig({ sshHost: '', remotePath: '/srv/app' }, 'App'), /SSH/)
    assert.throws(() => normalizeNextjsPm2DeployConfig({ sshHost: 'deploy@example.com', remotePath: 'srv/app' }, 'App'), /绝对路径/)
    assert.throws(() => normalizeNextjsPm2DeployConfig({ sshHost: 'deploy@example.com', remotePath: '/srv/my app' }, 'App'), /空格/)
    assert.throws(() => normalizeNextjsPm2DeployConfig({ sshHost: 'deploy@example.com', remotePath: '/srv/app', port: 70000 }, 'App'), /端口/)
  })

  it('creates versioned artifact names and shell quotes remote script values', () => {
    assert.equal(createNextjsPm2ArtifactName('Customer Portal', '1.2.3'), 'Customer-Portal-1.2.3.tar.gz')
    assert.equal(shellQuote("it's ok"), "'it'\\''s ok'")
  })

  it('builds remote prepare and deploy scripts for PM2', () => {
    const config = normalizeNextjsPm2DeployConfig({
      sshHost: 'deploy@example.com',
      remotePath: '/var/www/customer-portal',
      uploadPath: '/tmp/releases',
      appName: 'customer-portal',
      port: 3100,
      startCommand: 'node server.js'
    }, 'Customer Portal')
    const prepareScript = createNextjsPm2RemotePrepareScript(config)
    const deployScript = createNextjsPm2RemoteDeployScript({
      config,
      packageManager: 'pnpm',
      archiveName: 'Customer-Portal-1.2.3.tar.gz',
      releaseName: 'Customer-Portal-1.2.3',
      standalone: true
    })

    assert.match(prepareScript, /mkdir -p '\/tmp\/releases'/)
    assert.match(deployScript, /ARCHIVE_PATH='\/tmp\/releases\/Customer-Portal-1\.2\.3\.tar\.gz'/)
    assert.match(deployScript, /pm2 start sh --name "\$APP_NAME"/)
    assert.match(deployScript, /pm2 save/)
  })
})
