import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message
} from 'antd'
import { CheckCircleOutlined, DeleteOutlined, DeploymentUnitOutlined, RobotOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import type {
  DeploymentProviderType,
  DeploymentSourceMode,
  Project,
  ProjectDeploymentConfig,
  ProjectDeploymentPreparation,
  ProjectDeploymentSuggestion,
  ProjectDeploymentTarget,
  ProjectDeploymentTask,
  ServiceConnection,
  ProjectService,
  Repository
} from './data'
import { getErrorMessage } from './error-messages'

type Props = {
  project: Project
  repositories: Repository[]
  open: boolean
}

const providerOptions: Array<{ value: DeploymentProviderType; label: string; description: string }> = [
  { value: 'vercel', label: 'Vercel', description: '前端、Next.js 和静态站点' },
  { value: 'railway', label: 'Railway', description: '已有 Railway 服务的持续部署' },
  { value: 'ssh-pm2', label: 'SSH / PM2', description: '本地构建后上传到自有服务器' },
  { value: 'docker-compose', label: 'Docker / Compose', description: '远程 Docker 主机更新容器' }
]

function providerLabel(provider: DeploymentProviderType): string {
  return providerOptions.find((item) => item.value === provider)?.label ?? provider
}

function createEmptyConfig(repositoryId: string, provider: DeploymentProviderType, sourceMode: DeploymentSourceMode): ProjectDeploymentConfig {
  return {
    repositoryId,
    provider,
    sourceMode,
    rootDirectory: '',
    branch: '',
    installCommand: '',
    buildCommand: '',
    outputDirectory: '',
    framework: '',
    packageManager: '',
    runtimeVersion: '',
    startCommand: '',
    port: '3000',
    healthPath: '/',
    remoteHost: '',
    remotePath: '',
    uploadPath: '/tmp/forgedesk-releases',
    appName: '',
    dockerContext: '.',
    dockerfile: 'Dockerfile',
    composeFile: '',
    composeService: '',
    envBindings: [],
    extra: {}
  }
}

function taskColor(status: ProjectDeploymentTask['status']): string {
  if (status === 'succeeded') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'cancelled') return 'orange'
  return 'blue'
}

function taskLabel(status: ProjectDeploymentTask['status']): string {
  if (status === 'succeeded') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'cancelled') return '已终止'
  return '进行中'
}

export function ProjectDeploymentPanel({ project, repositories, open }: Props): JSX.Element {
  const [provider, setProvider] = useState<DeploymentProviderType>('vercel')
  const [sourceMode, setSourceMode] = useState<DeploymentSourceMode>('git')
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? '')
  const [targetId, setTargetId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [connectionId, setConnectionId] = useState('')
  const [environmentName, setEnvironmentName] = useState('')
  const [config, setConfig] = useState<ProjectDeploymentConfig>(createEmptyConfig(repositoryId, provider, sourceMode))
  const [targets, setTargets] = useState<ProjectDeploymentTarget[]>([])
  const [services, setServices] = useState<ProjectService[]>([])
  const [connections, setConnections] = useState<ServiceConnection[]>([])
  const [tasks, setTasks] = useState<ProjectDeploymentTask[]>([])
  const [preparation, setPreparation] = useState<ProjectDeploymentPreparation | null>(null)
  const [suggestion, setSuggestion] = useState<ProjectDeploymentSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [step, setStep] = useState(0)

  const selectedRepository = repositories.find((item) => item.id === repositoryId) ?? repositories[0]
  const selectedTarget = targets.find((item) => item.id === targetId) ?? null
  const providerServices = services.filter((service) => service.provider === provider)
  const selectedService = providerServices.find((service) => service.id === serviceId) ?? null
  const environments = selectedService?.environments ?? []
  const runningTask = tasks.find((task) => task.status === 'running')

  const providerTargetOptions = useMemo(
    () => targets.filter((target) => target.provider === provider).map((target) => ({ label: `${target.displayName}${target.lastStatus ? ` · ${target.lastStatus}` : ''}`, value: target.id })),
    [provider, targets]
  )

  async function load(): Promise<void> {
    if (!window.forgeDesk) return
    setLoading(true)
    try {
      const [nextTargets, nextServices, nextConnections, nextTasks] = await Promise.all([
        window.forgeDesk.listProjectDeploymentTargets(project.id),
        window.forgeDesk.listProjectServices(project.id),
        window.forgeDesk.listServiceConnections(),
        window.forgeDesk.listProjectDeploymentTasks(project.id)
      ])
      setTargets(nextTargets)
      setServices(nextServices)
      setConnections(nextConnections)
      setTasks(nextTasks)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setRepositoryId((current) => repositories.some((item) => item.id === current) ? current : repositories[0]?.id ?? '')
    setStep(0)
    setSuggestion(null)
    setPreparation(null)
    load().catch((error) => message.error(getErrorMessage(error)))
  }, [open, project.id, repositories])

  useEffect(() => {
    if (!open || !repositoryId) return
    const nextTarget = targets.find((target) => target.id === targetId && target.provider === provider)
    setServiceId(nextTarget?.serviceId ?? '')
    setConnectionId(nextTarget?.connectionId ?? '')
    setEnvironmentName(nextTarget?.externalEnvironmentName ?? '')
    setConfig(nextTarget?.config ?? createEmptyConfig(repositoryId, provider, sourceMode))
    setSuggestion(null)
    setPreparation(null)
  }, [open, repositoryId, provider, sourceMode, targetId])

  useEffect(() => {
    if (!open || !runningTask || !window.forgeDesk) return
    const timer = window.setInterval(() => {
      window.forgeDesk.getProjectDeploymentTask(runningTask.id).then((task) => {
        if (!task) return
        setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)])
      }).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(timer)
  }, [open, runningTask?.id])

  function updateConfig(field: keyof ProjectDeploymentConfig, value: string | number | undefined): void {
    setConfig((current) => ({ ...current, [field]: value === undefined ? '' : String(value) }))
    setPreparation(null)
  }

  async function loadPreparation(): Promise<ProjectDeploymentPreparation | null> {
    if (!window.forgeDesk || !repositoryId) return null
    const result = await window.forgeDesk.prepareProjectDeployment({
      targetId: targetId || undefined,
      repositoryId,
      provider,
      sourceMode,
      config
    })
    setPreparation(result)
    setConfig(result.config)
    return result
  }

  async function useAi(): Promise<void> {
    if (!window.forgeDesk || !repositoryId) return
    setAnalyzing(true)
    try {
      const result = await window.forgeDesk.suggestProjectDeploymentConfig(repositoryId, { provider, sourceMode })
      setSuggestion(result)
      setConfig(result.config)
      message.success('AI 已生成发布配置草稿，请检查后继续')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setAnalyzing(false)
    }
  }

  function chooseService(nextServiceId: string): void {
    setServiceId(nextServiceId)
    const nextService = providerServices.find((item) => item.id === nextServiceId)
    setConnectionId(nextService?.connectionId ?? '')
    const nextEnvironment = nextService?.environments.find((item) => item.name === environmentName) ?? nextService?.environments[0]
    setEnvironmentName(nextEnvironment?.name ?? '')
    setPreparation(null)
  }

  async function saveTarget(): Promise<ProjectDeploymentTarget | null> {
    if (!window.forgeDesk || !selectedRepository) return null
    const service = providerServices.find((item) => item.id === serviceId)
    const environment = service?.environments.find((item) => item.name === environmentName)
    setSaving(true)
    try {
      const saved = await window.forgeDesk.saveProjectDeploymentTarget({
        id: selectedTarget?.id,
        projectId: project.id,
        repositoryId: selectedRepository.id,
        provider,
        serviceId,
        connectionId: service?.connectionId ?? connectionId,
        externalProjectId: service?.externalProjectId,
        externalProjectName: service?.externalProjectName,
        externalServiceId: service?.externalServiceId,
        externalServiceName: service?.name,
        externalEnvironmentId: environment?.externalEnvironmentId,
        externalEnvironmentName: environment?.name ?? environmentName,
        displayName: selectedTarget?.displayName || `${providerLabel(provider)} · ${service?.name || selectedRepository.name}`,
        status: service ? 'ready' : 'draft',
        config: { ...config, repositoryId: selectedRepository.id, provider, sourceMode }
      })
      setTargets((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setTargetId(saved.id)
      message.success('发布目标已保存')
      return saved
    } catch (error) {
      message.error(getErrorMessage(error))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function prepareAndNext(): Promise<void> {
    try {
      const result = await loadPreparation()
      if (!result) return
      setStep(2)
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  async function startDeployment(): Promise<void> {
    if (!window.forgeDesk || !selectedRepository) return
    setStarting(true)
    try {
      const result = preparation ?? await loadPreparation()
      if (!result) return
      if (result.issues.length > 0) {
        message.error(result.issues.join('\n'))
        return
      }
      const target = selectedTarget ?? await saveTarget()
      if (!target) return
      const task = await window.forgeDesk.startProjectDeploymentTask({
        projectId: project.id,
        targetId: target.id,
        config: { ...config, repositoryId: selectedRepository.id, provider, sourceMode }
      })
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)])
      setStep(3)
      message.success('项目发布任务已启动')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setStarting(false)
    }
  }

  async function quickPublishTarget(target: ProjectDeploymentTarget): Promise<void> {
    if (!window.forgeDesk) return
    const repository = repositories.find((item) => item.id === target.repositoryId)

    if (!repository) {
      message.error('这个发布目标绑定的仓库已经不存在')
      return
    }

    const targetConfig: ProjectDeploymentConfig = {
      ...target.config,
      repositoryId: target.repositoryId,
      provider: target.provider,
      sourceMode: target.config.sourceMode
    }

    setRepositoryId(target.repositoryId)
    setProvider(target.provider)
    setSourceMode(targetConfig.sourceMode)
    setTargetId(target.id)
    setConfig(targetConfig)
    setStarting(true)

    try {
      const prepared = await window.forgeDesk.prepareProjectDeployment({
        targetId: target.id,
        repositoryId: target.repositoryId,
        provider: target.provider,
        sourceMode: targetConfig.sourceMode,
        config: targetConfig
      })
      setPreparation(prepared)
      setConfig(prepared.config)

      if (prepared.issues.length > 0) {
        setStep(2)
        message.error('发布前预检未通过，请修正配置')
        return
      }

      Modal.confirm({
        title: `发布到 ${target.displayName}`,
        content: `将使用 ${repository.name} 的已保存配置执行本地构建并发布。确认继续吗？`,
        okText: '确认发布',
        cancelText: '取消',
        onOk: async () => {
          setStarting(true)
          try {
            const task = await window.forgeDesk.startProjectDeploymentTask({
              projectId: project.id,
              targetId: target.id,
              config: prepared.config
            })
            setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)])
            setStep(3)
            message.success('发布任务已启动')
          } catch (error) {
            message.error(getErrorMessage(error))
            throw error
          } finally {
            setStarting(false)
          }
        }
      })
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setStarting(false)
    }
  }

  async function cancelTask(task: ProjectDeploymentTask): Promise<void> {
    if (!window.forgeDesk) return
    try {
      const nextTask = await window.forgeDesk.cancelProjectDeploymentTask(task.id)
      setTasks((current) => [nextTask, ...current.filter((item) => item.id !== nextTask.id)])
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  async function removeTarget(target: ProjectDeploymentTarget): Promise<void> {
    if (!window.forgeDesk) return
    try {
      setTargets(await window.forgeDesk.deleteProjectDeploymentTarget(project.id, target.id))
      if (target.id === targetId) setTargetId('')
      message.success('发布目标已删除')
    } catch (error) {
      message.error(getErrorMessage(error))
    }
  }

  const currentIssues = preparation?.issues ?? []
  const currentWarnings = preparation?.warnings ?? []

  return (
    <Space direction="vertical" size={16} className="project-deployment-panel" style={{ width: '100%' }}>
      <Steps
        current={step}
        items={[{ title: '方式与目标' }, { title: 'AI 分析' }, { title: '配置与预检' }, { title: '发布任务' }]}
      />
      {loading ? <Spin /> : null}
      {step === 0 ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={4}>选择发布方式</Typography.Title>
            <Typography.Text type="secondary">先选择平台或服务器类型，后面的字段会根据方式自动变化。</Typography.Text>
          </div>
          {targets.length > 0 ? (
            <Card size="small" title="快速发布" extra={<Tag color="blue">使用已保存配置</Tag>}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Typography.Text type="secondary">选择一个已保存的服务器或平台目标，ForgeDesk 会先执行预检，再确认发布，无需重新填写配置。</Typography.Text>
                {targets.slice(0, 6).map((target) => (
                  <div className="project-deployment-quick-target" key={target.id}>
                    <Space direction="vertical" size={2}>
                      <Space size={8} wrap>
                        <Typography.Text strong>{target.displayName}</Typography.Text>
                        <Tag>{providerLabel(target.provider)}</Tag>
                        {target.lastStatus ? <Tag color={target.lastStatus === 'failed' ? 'red' : 'default'}>{target.lastStatus}</Tag> : null}
                      </Space>
                      <Typography.Text type="secondary">{repositories.find((item) => item.id === target.repositoryId)?.name || '仓库已移除'}</Typography.Text>
                    </Space>
                    <Button type="primary" ghost loading={starting && target.id === targetId} onClick={() => quickPublishTarget(target)}>
                      预检并发布
                    </Button>
                  </div>
                ))}
              </Space>
            </Card>
          ) : null}
          <Row gutter={[12, 12]}>
            {providerOptions.map((option) => (
              <Col xs={24} sm={12} key={option.value}>
                <Card hoverable size="small" title={option.label} onClick={() => { setProvider(option.value); setTargetId(''); setSourceMode(option.value === 'vercel' || option.value === 'railway' ? 'git' : 'local') }} className={provider === option.value ? 'is-selected' : ''}>
                  <Typography.Text type="secondary">{option.description}</Typography.Text>
                </Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Typography.Text strong>绑定仓库</Typography.Text>
              <Select style={{ width: '100%', marginTop: 8 }} value={repositoryId || undefined} options={repositories.map((repository) => ({ label: repository.name, value: repository.id }))} onChange={setRepositoryId} placeholder="选择要发布的仓库" />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text strong>执行模式</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={sourceMode}
                options={[
                  { label: '平台 Git 构建', value: 'git', disabled: provider === 'ssh-pm2' || provider === 'docker-compose' },
                  { label: '本地构建后上传', value: 'local', disabled: provider === 'railway' }
                ]}
                onChange={setSourceMode}
              />
            </Col>
          </Row>
          {(provider === 'vercel' || provider === 'railway') ? (
            <Row gutter={[12, 12]}>
              {(provider === 'vercel' || provider === 'railway') ? (
                <Col xs={24} md={8}>
                  <Typography.Text strong>平台连接</Typography.Text>
                  <Select
                    allowClear
                    style={{ width: '100%', marginTop: 8 }}
                    value={connectionId || undefined}
                    options={connections.filter((connection) => connection.provider === provider).map((connection) => ({ label: connection.name, value: connection.id }))}
                    onChange={(value) => setConnectionId(value ?? '')}
                    placeholder="选择平台连接"
                  />
                </Col>
              ) : null}
              {(provider === 'vercel' || provider === 'railway') ? (
                <Col xs={24} md={8}>
                  <Typography.Text strong>已有发布目标</Typography.Text>
                  <Select allowClear style={{ width: '100%', marginTop: 8 }} value={targetId || undefined} options={providerTargetOptions} onChange={(value) => setTargetId(value ?? '')} placeholder="可选，选择已保存目标" />
                </Col>
              ) : null}
              {(provider === 'vercel' || provider === 'railway') ? (
                <Col xs={24} md={8}>
                  <Typography.Text strong>已同步服务</Typography.Text>
                  <Select allowClear style={{ width: '100%', marginTop: 8 }} value={serviceId || undefined} options={providerServices.map((service) => ({ label: `${service.externalProjectName || service.externalProjectId} / ${service.name}`, value: service.id }))} onChange={chooseService} placeholder="已有服务（可选）" />
                </Col>
              ) : null}
            </Row>
          ) : null}
          {(provider === 'vercel' || provider === 'railway') ? (
            <>
              <Typography.Text type="secondary">目标层级：平台连接 → 已同步服务 → 环境。请先在项目设置 / 服务配置中绑定已有的 Vercel 或 Railway 项目；同一个 ForgeDesk 项目可以绑定多个平台项目。</Typography.Text>
            </>
          ) : null}
          {serviceId && environments.length > 0 ? (
            <Select value={environmentName || undefined} options={environments.map((environment) => ({ label: environment.name, value: environment.name }))} onChange={setEnvironmentName} placeholder="选择环境" />
          ) : null}
          <Space>
            <Button type="primary" icon={<RobotOutlined />} disabled={!repositoryId} onClick={() => setStep(1)}>继续，让 AI 分析</Button>
            {targets.filter((target) => target.provider === provider).map((target) => <Button key={target.id} danger size="small" icon={<DeleteOutlined />} onClick={() => removeTarget(target)}>{target.displayName}</Button>)}
          </Space>
        </Space>
      ) : null}
      {step === 1 ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message="AI 只会生成配置草稿" description="ForgeDesk 会读取构建相关文件和有限源码片段，自动过滤密钥、Token、证书和环境变量值。AI 不会自动保存或发布。" />
          <Button type="primary" icon={<RobotOutlined />} loading={analyzing} onClick={useAi}>扫描项目并填写配置</Button>
          {suggestion ? (
            <>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="识别置信度">{Math.round(suggestion.confidence * 100)}%</Descriptions.Item>
                <Descriptions.Item label="依据文件">{suggestion.sources.length} 个</Descriptions.Item>
                <Descriptions.Item label="判断理由" span={2}>{suggestion.reasons.join('；') || '无'}</Descriptions.Item>
              </Descriptions>
              {suggestion.warnings.length > 0 ? <Alert type="warning" showIcon message={suggestion.warnings.join('；')} /> : null}
              <Button type="primary" onClick={() => setStep(2)}>查看并修改配置</Button>
            </>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击上面的按钮，让 AI 根据项目资料生成发布配置" />}
          <Button onClick={() => setStep(0)}>返回选择目标</Button>
        </Space>
      ) : null}
      {step === 2 ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message={`${providerLabel(provider)} 发布配置`} description="配置可以全部手动修改。保存目标只保存配置，不会触发线上操作。" />
          {preparation?.capabilities.platformManagedFields.length ? (
            <Alert
              type="warning"
              showIcon
              message="部分字段由平台管理"
              description={`当前 Provider 不保证这些字段生效：${preparation.capabilities.platformManagedFields.join('、')}。请以平台项目设置为准。`}
            />
          ) : null}
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}><Typography.Text strong>Root Directory</Typography.Text><Input value={config.rootDirectory} onChange={(event) => updateConfig('rootDirectory', event.target.value)} placeholder="例如 apps/web" /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Branch</Typography.Text><Input value={config.branch} onChange={(event) => updateConfig('branch', event.target.value)} placeholder="main" /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Framework</Typography.Text><Input value={config.framework} onChange={(event) => updateConfig('framework', event.target.value)} placeholder="nextjs / vite" /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Install Command</Typography.Text><Input value={config.installCommand} onChange={(event) => updateConfig('installCommand', event.target.value)} /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Build Command</Typography.Text><Input value={config.buildCommand} onChange={(event) => updateConfig('buildCommand', event.target.value)} /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Output Directory</Typography.Text><Input value={config.outputDirectory} onChange={(event) => updateConfig('outputDirectory', event.target.value)} placeholder="dist" /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Package Manager</Typography.Text><Select style={{ width: '100%' }} value={config.packageManager || undefined} options={['pnpm', 'npm', 'yarn', 'bun'].map((value) => ({ label: value, value }))} onChange={(value) => updateConfig('packageManager', value)} /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Runtime / Node</Typography.Text><Input value={config.runtimeVersion} onChange={(event) => updateConfig('runtimeVersion', event.target.value)} placeholder="22" /></Col>
            <Col xs={24} md={8}><Typography.Text strong>Start Command</Typography.Text><Input value={config.startCommand} onChange={(event) => updateConfig('startCommand', event.target.value)} placeholder="pm2 start ..." /></Col>
          </Row>
          {provider === 'ssh-pm2' ? <><Divider orientation="left">SSH / PM2</Divider><Row gutter={[12, 0]}><Col xs={24} md={8}><Typography.Text strong>远程主机</Typography.Text><Input value={config.remoteHost} onChange={(event) => updateConfig('remoteHost', event.target.value)} placeholder="deploy@example.com" /></Col><Col xs={24} md={8}><Typography.Text strong>部署目录</Typography.Text><Input value={config.remotePath} onChange={(event) => updateConfig('remotePath', event.target.value)} /></Col><Col xs={24} md={8}><Typography.Text strong>应用名</Typography.Text><Input value={config.appName} onChange={(event) => updateConfig('appName', event.target.value)} /></Col></Row></> : null}
          {provider === 'docker-compose' ? <><Divider orientation="left">Docker / Compose</Divider><Row gutter={[12, 0]}><Col xs={24} md={8}><Typography.Text strong>远程主机</Typography.Text><Input value={config.remoteHost} onChange={(event) => updateConfig('remoteHost', event.target.value)} /></Col><Col xs={24} md={8}><Typography.Text strong>远程目录</Typography.Text><Input value={config.remotePath} onChange={(event) => updateConfig('remotePath', event.target.value)} /></Col><Col xs={24} md={8}><Typography.Text strong>Compose 文件</Typography.Text><Input value={config.composeFile} onChange={(event) => updateConfig('composeFile', event.target.value)} placeholder="docker-compose.yml" /></Col><Col xs={24} md={8}><Typography.Text strong>Compose 服务</Typography.Text><Input value={config.composeService} onChange={(event) => updateConfig('composeService', event.target.value)} /></Col><Col xs={24} md={8}><Typography.Text strong>Dockerfile</Typography.Text><Input value={config.dockerfile} onChange={(event) => updateConfig('dockerfile', event.target.value)} /></Col><Col xs={24} md={8}><Typography.Text strong>端口</Typography.Text><InputNumber style={{ width: '100%' }} value={Number(config.port) || undefined} onChange={(value) => updateConfig('port', value ?? '')} /></Col></Row></> : null}
          <Space wrap>
            <Button onClick={() => setStep(1)}>返回 AI 分析</Button>
            <Button icon={<CheckCircleOutlined />} loading={loading} onClick={loadPreparation}>运行预检</Button>
            <Button icon={<SaveOutlined />} loading={saving} onClick={saveTarget}>保存目标</Button>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={starting} onClick={startDeployment}>确认并发布</Button>
          </Space>
          {currentIssues.length > 0 ? <Alert type="error" showIcon message="预检未通过" description={currentIssues.join('；')} /> : null}
          {currentWarnings.length > 0 ? <Alert type="warning" showIcon message="发布前提醒" description={currentWarnings.join('；')} /> : null}
          {preparation ? <Descriptions size="small" bordered column={2}><Descriptions.Item label="执行预览" span={2}>{preparation.previewCommand}</Descriptions.Item><Descriptions.Item label="目标能力">{preparation.capabilities.configFields.join('、')}</Descriptions.Item><Descriptions.Item label="平台">{preparation.capabilities.label}</Descriptions.Item></Descriptions> : null}
        </Space>
      ) : null}
      {step === 3 ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type={runningTask ? 'info' : 'success'} showIcon message={runningTask ? '发布任务正在执行' : '发布任务已完成或已结束'} description={runningTask?.hint || '可在下方查看最近任务。'} />
          <Button icon={<DeploymentUnitOutlined />} onClick={() => setStep(0)}>配置另一个发布目标</Button>
        </Space>
      ) : null}
      <Divider orientation="left">最近发布任务</Divider>
      {tasks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有项目发布任务" /> : tasks.slice(0, 8).map((task) => (
        <Card key={task.id} size="small">
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            <Space wrap>
              <Typography.Text strong>{task.targetName}</Typography.Text>
              <Tag color={taskColor(task.status)}>{taskLabel(task.status)}</Tag>
              <Tag>{providerLabel(task.provider)}</Tag>
              <Typography.Text type="secondary">{task.phase}</Typography.Text>
            </Space>
            <Progress percent={task.phaseTotal ? Math.round((task.phaseIndex / task.phaseTotal) * 100) : 0} status={task.status === 'failed' ? 'exception' : task.status === 'succeeded' ? 'success' : 'active'} />
            {task.externalDeploymentUrl ? <Typography.Link href={task.externalDeploymentUrl} target="_blank">打开线上地址</Typography.Link> : null}
            {task.error ? <Alert type="error" showIcon message={task.error} /> : null}
            {task.status === 'running' ? <Button size="small" danger onClick={() => cancelTask(task)}>终止任务</Button> : null}
            <Typography.Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开日志' }} copyable>{task.log || '暂无日志'}</Typography.Paragraph>
          </Space>
        </Card>
      ))}
    </Space>
  )
}
