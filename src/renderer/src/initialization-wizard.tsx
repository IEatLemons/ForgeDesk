import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Layout,
  Radio,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  message
} from 'antd'
import {
  CheckCircleOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  LinkOutlined,
  ReloadOutlined,
  RocketOutlined
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { getErrorMessage } from './error-messages'
import { useForgeDeskStore } from './store'

type InitializationWizardProps = {
  onComplete: (projectId: string) => void
}

export function InitializationWizard({ onComplete }: InitializationWizardProps): JSX.Element {
  const createProject = useForgeDeskStore((state) => state.createProject)
  const createEmptyProject = useForgeDeskStore((state) => state.createEmptyProject)
  const [snapshot, setSnapshot] = useState<InitializationSnapshot | null>(null)
  const [sourceMode, setSourceMode] = useState<'existing' | 'new'>('existing')
  const [projectName, setProjectName] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [parentPath, setParentPath] = useState('')
  const [createdProjectId, setCreatedProjectId] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [refreshingCodex, setRefreshingCodex] = useState(false)
  const [error, setError] = useState('')

  async function loadSnapshot(): Promise<void> {
    if (!window.forgeDesk) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      setSnapshot(await window.forgeDesk.getInitializationSnapshot())
    } catch (loadError) {
      setError(getErrorMessage(loadError, '初始化检测失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
  }, [])

  async function selectExistingDirectory(): Promise<void> {
    if (!window.forgeDesk) return
    const selected = await window.forgeDesk.selectDirectory()
    if (!selected) return
    setWorkspacePath(selected)
    if (!projectName.trim()) {
      const nextName = selected.split(/[\\/]/).filter(Boolean).pop() ?? ''
      setProjectName(nextName)
    }
    setError('')
  }

  async function selectParentDirectory(): Promise<void> {
    if (!window.forgeDesk) return
    const selected = await window.forgeDesk.selectDirectory()
    if (selected) {
      setParentPath(selected)
      setError('')
    }
  }

  async function createProjectAndContinue(): Promise<void> {
    const name = projectName.trim()
    if (!name) {
      setError('请先填写项目名称')
      return
    }

    if (sourceMode === 'existing' && !workspacePath.trim()) {
      setError('请选择已有项目目录')
      return
    }

    if (sourceMode === 'new' && !parentPath.trim()) {
      setError('请选择新项目的父目录')
      return
    }

    setCreating(true)
    setError('')
    try {
      if (sourceMode === 'existing') {
        let repositories: ScannedRepository[] = []
        try {
          repositories = await window.forgeDesk.scanWorkspace(workspacePath.trim())
        } catch {
          // A plain folder is a valid project. Git can be initialized later.
        }
        await createProject(name, workspacePath.trim(), repositories)
      } else {
        await createEmptyProject(name, parentPath.trim())
      }

      const projectId = useForgeDeskStore.getState().selectedProjectId
      if (!projectId) throw new Error('项目已创建，但没有找到当前项目')
      setCreatedProjectId(projectId)
      setCurrentStep(1)
      message.success('项目已准备好')
    } catch (createError) {
      setError(getErrorMessage(createError, '创建项目失败'))
    } finally {
      setCreating(false)
    }
  }

  async function openCodex(): Promise<void> {
    if (!window.forgeDesk || !snapshot) return
    setRefreshingCodex(true)
    try {
      const result = await window.forgeDesk.openAiProvider({
        providerId: 'codex',
        projectPath: workspacePath || snapshot.currentProject?.workspacePath
      })
      if (result.mode === 'app') message.success('已打开 Codex 官方应用')
      else if (result.mode === 'cli') message.success('已在 ForgeDesk 终端中启动 Codex CLI')
      else message.info('未安装 Codex，已打开官方安装页面')
      await loadSnapshot()
    } catch (openError) {
      setError(getErrorMessage(openError, '打开 Codex 失败'))
    } finally {
      setRefreshingCodex(false)
    }
  }

  function finish(): void {
    if (createdProjectId) onComplete(createdProjectId)
  }

  if (loading) {
    return (
      <Layout className="initialization-shell">
        <div className="initialization-loading"><Spin size="large" /></div>
      </Layout>
    )
  }

  const codex = snapshot?.codex
  const currentPath = workspacePath || snapshot?.currentProject?.workspacePath || ''

  return (
    <Layout className="initialization-shell">
      <div className="initialization-card">
        <div className="initialization-brand">
          <div className="initialization-brand-mark"><RocketOutlined /></div>
          <div>
            <Typography.Title level={2}>欢迎使用 ForgeDesk</Typography.Title>
            <Typography.Paragraph type="secondary">
              先准备一个项目目录，之后你可以在一个地方管理项目和 AI 工具。
            </Typography.Paragraph>
          </div>
        </div>

        <Steps
          current={currentStep}
          items={[{ title: '准备项目' }, { title: '设置 AI 工具' }]}
          className="initialization-steps"
        />

        {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError('')} /> : null}

        {currentStep === 0 ? (
          <div className="initialization-step-content">
            <Typography.Title level={3}>先选择一个项目</Typography.Title>
            <Typography.Paragraph type="secondary">
              可以选择已经存在的文件夹，也可以创建一个新的空文件夹。没有 Git 仓库也可以继续。
            </Typography.Paragraph>
            <Radio.Group
              value={sourceMode}
              onChange={(event) => setSourceMode(event.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={[{ label: '已有目录', value: 'existing' }, { label: '新建空目录', value: 'new' }]}
            />
            <Row gutter={[16, 16]} className="initialization-choice-grid">
              <Col xs={24} md={12}>
                <Card className={sourceMode === 'existing' ? 'initialization-choice-card active' : 'initialization-choice-card'}>
                  <FolderOpenOutlined className="initialization-choice-icon" />
                  <Typography.Title level={4}>选择已有项目目录</Typography.Title>
                  <Typography.Paragraph type="secondary">ForgeDesk 会尝试扫描 Git 仓库，但普通文件夹也能作为项目。</Typography.Paragraph>
                  <Button icon={<FolderOpenOutlined />} onClick={() => void selectExistingDirectory()}>
                    选择目录
                  </Button>
                  {sourceMode === 'existing' && workspacePath ? <Typography.Text className="initialization-path">{workspacePath}</Typography.Text> : null}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className={sourceMode === 'new' ? 'initialization-choice-card active' : 'initialization-choice-card'}>
                  <FolderAddOutlined className="initialization-choice-icon" />
                  <Typography.Title level={4}>创建新的空项目</Typography.Title>
                  <Typography.Paragraph type="secondary">选择父目录和项目名称，ForgeDesk 只会创建这个新的空文件夹。</Typography.Paragraph>
                  <Button icon={<FolderAddOutlined />} onClick={() => void selectParentDirectory()}>
                    选择父目录
                  </Button>
                  {sourceMode === 'new' && parentPath ? <Typography.Text className="initialization-path">{parentPath}</Typography.Text> : null}
                </Card>
              </Col>
            </Row>
            <div className="initialization-form-row">
              <Typography.Text strong>项目名称</Typography.Text>
              <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如：我的网站" maxLength={80} />
            </div>
            <div className="initialization-actions">
              <Button type="primary" size="large" loading={creating} onClick={() => void createProjectAndContinue()}>
                创建项目并继续
              </Button>
            </div>
          </div>
        ) : (
          <div className="initialization-step-content">
            <Typography.Title level={3}>AI 工具准备好了</Typography.Title>
            <Typography.Paragraph type="secondary">
              Codex 不是进入 ForgeDesk 的必要条件。你可以现在打开，也可以稍后在“AI 工具”中设置。
            </Typography.Paragraph>
            <Card className="initialization-provider-card">
              <Space align="start" size={16}>
                <div className="initialization-provider-icon"><RocketOutlined /></div>
                <div className="initialization-provider-copy">
                  <Space wrap>
                    <Typography.Title level={4} style={{ margin: 0 }}>Codex</Typography.Title>
                    <Tag color={codex?.installed ? 'green' : 'default'}>{codex?.installed ? '已检测到' : '未安装'}</Tag>
                    {codex?.authenticated ? <Tag color="blue">已登录</Tag> : null}
                  </Space>
                  <Typography.Paragraph type="secondary">{codex?.message || '正在检测 Codex 环境。'}</Typography.Paragraph>
                  {codex?.version ? <Typography.Text type="secondary">版本：{codex.version}</Typography.Text> : null}
                  {codex?.command ? <Typography.Text type="secondary">命令：{codex.command}</Typography.Text> : null}
                </div>
              </Space>
              <div className="initialization-provider-actions">
                {codex?.installed ? (
                  <Button type="primary" icon={<LinkOutlined />} loading={refreshingCodex} onClick={() => void openCodex()}>
                    打开 Codex
                  </Button>
                ) : (
                  <Button icon={<DownloadOutlined />} onClick={() => window.forgeDesk?.openExternalUrl(codex?.installUrl || 'https://openai.com/codex/')}>
                    查看官方安装方式
                  </Button>
                )}
                <Button icon={<ReloadOutlined />} loading={refreshingCodex} onClick={() => void loadSnapshot()}>重新检测</Button>
              </div>
            </Card>
            <Alert
              type="info"
              showIcon
              icon={<CheckCircleOutlined />}
              message="项目已经可以使用"
              description={currentPath ? `当前项目：${currentPath}` : '项目已经创建完成。'}
            />
            <div className="initialization-actions">
              <Button size="large" onClick={finish}>稍后设置，进入项目</Button>
              <Button type="primary" size="large" onClick={finish}>完成初始化</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
