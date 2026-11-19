import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configurationTargets, getConfigurationTarget, isDeploymentAiReady } from './configuration-guidance.js'
import { captureConfigurationContext, openConfiguration, registerConfigurationNavigator } from './configuration-navigation.js'
import type { AiSettingsView } from './data.js'

describe('actionable configuration guidance', () => {
  it('routes prerequisites to the form that can resolve them', () => {
    const cases = [
      ['请先启用并配置 AI 设置', 'ai'], ['请先在公共设置里启用 AI 并填写 API Key', 'ai'],
      ['AI API Key 无效、已过期或没有权限，请在 AI 设置里更新 API Key 后重试。', 'ai'],
      ['请先启用并配置本地 Codex', 'ai'], ['Codex 尚未登录，请先登录', 'ai-accounts'],
      ['请先配置 Vercel Token', 'services'], ['请先配置 Railway Token', 'services'], ['请先配置平台 Token', 'services'],
      ['当前目标还没有绑定已同步的平台服务，请先同步', 'services'],
      ['请在项目运行配置中添加连接', 'services'],
      ['请先在全局设置里配置 Plane API Token', 'plane'], ['当前项目尚未绑定 Plane 项目，请先绑定', 'project-plane'],
      ['请先在 OA 设置里启用 Lark 文档浏览', 'oa'], ['请填写 GitHub Token', 'github'],
      ['请先选择 Codemagic Token', 'codemagic'], ['请先绑定 Codemagic App ID', 'release'],
      ['请先在当前项目的发布设置里启用并完成 Firebase 配置', 'release'],
      ['请先保存当前项目的 Cloudflare 配置', 'cloudflare'], ['当前仓库没有远端配置', 'repositories'],
      ['Git 构建需要配置远端仓库地址', 'repositories'],
      ['当前项目尚未配置仓库，请先配置仓库', 'repositories'], ['请先配置 Git 用户名和邮箱', 'git'], ['请先配置 SSH 私钥', 'private']
    ] as const
    for (const [text, target] of cases) assert.equal(getConfigurationTarget(new Error(text)), target, text)
    assert.equal(configurationTargets.services.scope, 'project')
    assert.equal(configurationTargets.ai.scope, 'global')
  })
  it('does not turn ordinary validation, provider errors or execution state into unrelated settings links', () => {
    for (const text of ['请选择要生成提交信息的文件', '请输入提交信息', '请先恢复归档任务', 'HTTP 401', 'AI 服务请求过于频繁，请稍后重试', 'Vercel 部署失败：构建命令退出 1', 'AI 已保存配置', '已配置 GitHub Token', '仓库读取失败']) assert.equal(getConfigurationTarget(text), null, text)
  })
  it('supports local CLI AI and requires complete remote settings before scanning', () => {
    const settings: AiSettingsView = { enabled: true, provider: 'openai-compatible', model: 'test', baseUrl: 'https://example.test', apiKey: '', apiKeyConfigured: true, temperature: 0.2 }
    assert.ok(isDeploymentAiReady(settings))
    assert.equal(isDeploymentAiReady({ ...settings, enabled: false }), false)
    assert.equal(isDeploymentAiReady({ ...settings, apiKeyConfigured: false }), false)
    assert.equal(isDeploymentAiReady({ ...settings, baseUrl: '' }), false)
    assert.equal(isDeploymentAiReady({ ...settings, model: '' }), false)
    assert.ok(isDeploymentAiReady({ ...settings, provider: 'codex-cli', apiKeyConfigured: false, baseUrl: '', model: '' }))
  })
  it('captures the original project for a prompt even after switching projects', () => {
    let projectId = 'a'
    const requests: unknown[] = []
    const dispose = registerConfigurationNavigator({ context: () => ({ projectId }), open: request => requests.push(request) })
    try {
      const original = captureConfigurationContext()
      projectId = 'b'
      openConfiguration('services', original)
      openConfiguration('repositories', { projectId: 'explicit' })
      assert.deepEqual(requests, [{ target: 'services', projectId: 'a' }, { target: 'repositories', projectId: 'explicit' }])
    } finally { dispose() }
    openConfiguration('ai')
    assert.equal(requests.length, 2)
  })
})
