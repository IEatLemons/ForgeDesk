import { Alert, Button, Checkbox, Input, Modal, Space, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import type { CockpitImportPreview, CockpitImportResult } from '../../shared/cockpit-import'
import { getErrorMessage } from './error-messages'

export function CockpitImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => Promise<void> }): JSX.Element {
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<CockpitImportPreview | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [importApi, setImportApi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CockpitImportResult | null>(null)
  function changePath(value: string): void { setPath(value); setPreview(null); setSelectedIds([]); setImportApi(false); setResult(null); setError('') }
  async function readPreview(sourcePath = path): Promise<void> {
    setBusy(true); setError(''); setResult(null); setPreview(null); setSelectedIds([]); setImportApi(false)
    try {
      const value = await window.forgeDesk.previewCockpitImport(sourcePath || undefined)
      setPath(value.sourcePath); setPreview(value)
      setSelectedIds(value.accounts.filter(account => account.importable && !account.duplicate).map(account => account.id))
    } catch (error) { setError(getErrorMessage(error)) } finally { setBusy(false) }
  }
  async function importSelected(): Promise<void> {
    if (!preview) return
    setBusy(true); setError('')
    try {
      const value = await window.forgeDesk.importCockpitData({ sourcePath: preview.sourcePath, accountIds: selectedIds, importApiSettings: importApi })
      setResult(value); setPreview(null); setSelectedIds([]); setImportApi(false)
      await onImported()
    } catch (error) { setError(getErrorMessage(error)) } finally { setBusy(false) }
  }
  return <Modal title="从 Cockpit Tools 导入" open={open} width="min(920px, calc(100vw - 32px))" onCancel={() => { if (!busy) onClose() }} maskClosable={!busy} cancelButtonProps={{ disabled: busy }} okText="导入所选内容" cancelText="关闭" confirmLoading={busy} okButtonProps={{ disabled: !preview || !selectedIds.length && !importApi }} onOk={() => void importSelected()}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>支持本机 Cockpit 数据目录（默认 ~/.cockpit_tools）、旧版目录及账号导出 JSON。导入为 ForgeDesk 副本；保留现有账号、当前账号及 Cockpit 原文件。</Typography.Paragraph>
      <Input aria-label="Cockpit 数据路径" placeholder="留空自动查找，或填写数据目录 / 账号导出 JSON" value={path} disabled={busy} onChange={event => changePath(event.target.value)} />
      <Space wrap>
        <Button disabled={busy} onClick={() => void readPreview()}>读取预览</Button>
        <Button disabled={busy} onClick={() => void window.forgeDesk.selectDirectory().then(value => { if (value) changePath(value) }).catch(error => setError(getErrorMessage(error)))}>选择数据目录</Button>
        <Button disabled={busy} onClick={() => void window.forgeDesk.selectFile().then(value => { if (value) changePath(value) }).catch(error => setError(getErrorMessage(error)))}>选择导出文件</Button>
      </Space>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {result ? <Alert type={result.errors.length ? 'warning' : 'success'} showIcon message={`已导入 ${result.imported} 个账号，跳过 ${result.skipped} 个重复账号${result.apiSettingsImported ? '，API 配置已导入（保持停止）' : ''}`} description={result.errors.length ? result.errors.map((error, index) => <div key={index}>{error}</div>) : '可在账号卡片检查数据并切换账号。'} /> : null}
      {preview ? <>
        <Table size="small" rowKey="id" pagination={false} scroll={{ x: 650, y: 320 }} dataSource={preview.accounts} rowSelection={{ selectedRowKeys: selectedIds, onChange: keys => setSelectedIds(keys.map(String)), getCheckboxProps: account => ({ disabled: busy || !account.importable || account.duplicate }) }} columns={[
          { title: '账号', dataIndex: 'email', render: (_, account) => <Space direction="vertical" size={0}><Typography.Text>{account.email || account.name}</Typography.Text><Typography.Text type="secondary">{account.teamName}</Typography.Text></Space> },
          { title: '套餐', dataIndex: 'planType', render: value => value ? String(value).replaceAll('_', ' ').toUpperCase() : '未知' },
          { title: '订阅到期', dataIndex: 'subscriptionExpiresAt', render: value => value ? new Date(value).toLocaleString() : '未提供' },
          { title: '状态', render: (_, account) => account.error ? <Typography.Text type="danger">{account.error}</Typography.Text> : <Space wrap>{account.duplicate ? <Tag>已存在，将跳过</Tag> : <Tag color="green">可导入</Tag>}{account.current ? <Tag>来源当前账号</Tag> : null}</Space> }
        ]} />
        {preview.api ? <Checkbox checked={importApi} disabled={busy} onChange={event => setImportApi(event.target.checked)}>同时导入本地 API 端口 {preview.api.port}{preview.api.keyConfigured ? ' 和客户端密钥' : ''}，覆盖 ForgeDesk API 配置并保持停止</Checkbox> : null}
        {preview.warnings.map((warning, index) => <Alert type="info" showIcon key={index} message={warning} />)}
        <Typography.Text type="secondary">额度和订阅信息作为带时间的 Cockpit 快照导入，不代表实时结果。重复账号不会覆盖；导入不会切换账号或发起调用。</Typography.Text>
      </> : null}
    </Space>
  </Modal>
}
