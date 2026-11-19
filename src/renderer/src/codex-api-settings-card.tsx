import { Button, Card, Form, Input, InputNumber, Space, Tag, Typography } from 'antd'
import { CopyOutlined, KeyOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { message } from './app-message'
import { getErrorMessage } from './error-messages'

export function CodexApiSettingsCard({ service, onRefresh, onConnected }: {
  service: CodexApiServiceView | null
  onRefresh: () => Promise<void>
  onConnected?: () => void | Promise<unknown>
}): JSX.Element {
  const [form] = Form.useForm<{ port: number; model: string }>()
  const [action, setAction] = useState('')
  useEffect(() => { if (service) form.setFieldsValue({ port: service.port, model: service.model }) }, [service?.port, service?.model, form])
  async function run(action: 'save' | 'start' | 'stop' | 'rotate' | 'copy' | 'health'): Promise<void> {
    setAction(action)
    try {
      if (action === 'copy') {
        await window.forgeDesk.copyCodexApiKey()
        message.success('客户端 API Key 已复制')
      } else if (action === 'health') {
        const result = await window.forgeDesk.checkCodexApiService()
        if (result.ok) message.success(result.message)
        else message.warning(result.message)
      } else {
        if (action === 'save') await window.forgeDesk.saveCodexApiServiceSettings(await form.validateFields())
        if (action === 'start') await window.forgeDesk.startCodexApiService(await form.validateFields())
        if (action === 'stop') await window.forgeDesk.stopCodexApiService()
        if (action === 'rotate') await window.forgeDesk.rotateCodexApiKey()
        await onRefresh()
        if (action === 'start' || action === 'rotate') await onConnected?.()
        message.success(action === 'save' ? 'API 配置已保存，服务保持停止' : action === 'start' ? 'API 服务已启动并接入 ForgeDesk' : action === 'stop' ? 'API 服务已停止' : '客户端密钥已轮换')
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && 'errorFields' in error)) message.error(getErrorMessage(error))
    } finally { setAction('') }
  }
  return <Card className="codex-api-settings-card" title={<Space wrap>本地 API 服务<Tag color={service?.running ? 'green' : 'default'}>{service?.running ? '运行中' : '已停止'}</Tag></Space>} extra={<Button icon={<ReloadOutlined />} onClick={() => void onRefresh().catch(error => message.error(getErrorMessage(error)))}>刷新</Button>}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text type="secondary">提供 OpenAI 兼容接口；仅监听本机，使用当前 Codex 账号。启动时接入 ForgeDesk AI。</Typography.Text>
      <div className="codex-api-endpoint"><Typography.Text strong>访问地址</Typography.Text><Typography.Text code copyable={Boolean(service?.baseUrl)}>{service?.baseUrl || '尚未配置'}</Typography.Text></div>
      <div className="codex-api-endpoint"><Typography.Text strong>客户端密钥</Typography.Text><Typography.Text code>{service?.apiKeyMasked || '首次保存或启动时生成'}</Typography.Text><Button size="small" aria-label="复制客户端 API Key" icon={<CopyOutlined />} disabled={!service?.apiKeyConfigured || Boolean(action)} loading={action === 'copy'} onClick={() => void run('copy')}>复制</Button></div>
      <Space wrap><Typography.Text>服务成员：{service?.account.email || '当前账号未登录'} · 当前账号 {service?.account.planType || '套餐未识别'}</Typography.Text><Button type="link" size="small" onClick={() => document.getElementById('codex-account-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>管理账号</Button></Space>
      <Form form={form} layout="vertical" className="codex-api-config-form" disabled={service?.running || Boolean(action)}>
        <Form.Item name="port" label="监听端口" rules={[{ required: true, message: '请输入端口' }, { type: 'integer', min: 1, max: 65535, message: '端口应为 1–65535 的整数' }]}><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="model" label="默认模型" rules={[{ required: true, whitespace: true, message: '请输入默认模型' }]}><Input /></Form.Item>
      </Form>
      {service?.running ? <Typography.Text type="secondary">停止服务后可修改端口和默认模型。</Typography.Text> : null}
      <Space wrap>
        <Button disabled={service?.running || Boolean(action)} loading={action === 'save'} onClick={() => void run('save')}>保存 API 配置</Button>
        {service?.running ? <Button icon={<StopOutlined />} disabled={Boolean(action)} loading={action === 'stop'} onClick={() => void run('stop')}>停止服务</Button> : <Button type="primary" icon={<PlayCircleOutlined />} disabled={Boolean(action) || !service?.account.available} loading={action === 'start'} onClick={() => void run('start')}>启动并接入 ForgeDesk</Button>}
        <Button icon={<KeyOutlined />} disabled={!service?.apiKeyConfigured || Boolean(action)} loading={action === 'rotate'} onClick={() => void run('rotate')}>轮换客户端密钥</Button>
        <Button disabled={!service?.running || Boolean(action)} loading={action === 'health'} onClick={() => void run('health')}>检查连接</Button>
      </Space>
      <Typography.Text type="secondary">Codex 登录凭据不会返回页面。账号池、代理及自动轮换目前不支持；服务跟随当前账号。</Typography.Text>
    </Space>
  </Card>
}
