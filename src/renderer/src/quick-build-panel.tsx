import { memo, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Alert, Button, Descriptions, Drawer, Segmented, Space, Switch, Table, Tag, Typography, message } from 'antd'
import type { QuickBuildStage } from '../../shared/quick-build'
import { createQuickBuildLogDownload, getQuickBuildLogOutput } from './quick-build-view'
import type { QuickBuildLogChannel, QuickBuildLogTask } from './quick-build-view'

type Props = {
  open: boolean; onClose: () => void; onForce: () => void; onCancel: () => void; onRestart: () => void
  task: QuickBuildLogTask & { message?: string; artifactPath?: string; architecture?: string; elapsedMs?: number; reused?: boolean; stages?: QuickBuildStage[] }
}
const logChannels: { label: string; value: QuickBuildLogChannel }[] = [{ label: '全部日志', value: 'log' }, { label: '标准输出', value: 'stdout' }, { label: '错误输出', value: 'stderr' }]
const emptyStages: QuickBuildStage[] = []
const columns = [
  { title: '阶段', dataIndex: 'title', key: 'title' },
  { title: '状态', key: 'status', render: (_: unknown, stage: QuickBuildStage) => <Tag color={stage.status === 'failed' ? 'error' : stage.status === 'running' ? 'processing' : 'success'}>{stage.status === 'running' ? '执行中' : stage.status === 'failed' ? '失败' : stage.cacheHit ? '复用 / 验证通过' : '完成'}</Tag> },
  { title: '耗时', key: 'elapsed', render: (_: unknown, stage: QuickBuildStage) => stage.status === 'running' ? '—' : `${(stage.elapsedMs / 1000).toFixed(2)}s` }
]
export const QuickBuildPanel = memo(function QuickBuildPanel({ open, task, onClose, onForce, onCancel, onRestart }: Props) {
  const [channel, setChannel] = useState<QuickBuildLogChannel>('log')
  const [follow, setFollow] = useState(true)
  const logRef = useRef<HTMLPreElement>(null)
  const liveOutput = open ? getQuickBuildLogOutput(task, channel) : ''
  const output = useDeferredValue(liveOutput)
  useEffect(() => {
    if (open && follow && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [open, follow, output, channel])

  async function copyOutput(): Promise<void> {
    try { await navigator.clipboard.writeText(liveOutput); message.success('已复制当前日志') }
    catch { message.error('复制失败，可使用导出日志保存输出') }
  }
  function exportOutput(): void {
    const { fileName, content } = createQuickBuildLogDownload(task, channel)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = fileName
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <Drawer title="本机快速构建 · 阶段与耗时" open={open} onClose={onClose} width="min(800px, 100vw)" extra={<Space><Button disabled={task.status === 'running'} onClick={onForce}>强制完整重建</Button>{task.status === 'running' ? <Button danger onClick={onCancel}>终止构建</Button> : task.status === 'success' && task.artifactPath ? <Button type="primary" onClick={onRestart}>重启到此版本</Button> : null}</Space>}>
    <Alert showIcon type={task.status === 'error' ? 'error' : task.status === 'success' ? 'success' : 'info'} message={task.message || '尚未执行'} description="仅生成本机试用 .app，不生成安装包、不发布；失败时保留上次成功版本。" />
    <Descriptions column={1} size="small" style={{ marginBlock: 16 }} items={[{ key: 'command', label: '命令', children: task.command }, { key: 'cwd', label: '源码', children: task.cwd }, { key: 'arch', label: '架构', children: task.architecture || '随本机' }, { key: 'artifact', label: '本次产物', children: task.artifactPath || '尚未登记成功产物' }, { key: 'total', label: '总耗时', children: task.elapsedMs == null ? '—' : `${(task.elapsedMs / 1000).toFixed(2)}s${task.reused ? ' · 复用上次成功应用' : ''}` }]} />
    <Table<QuickBuildStage> size="small" rowKey="id" columns={columns} dataSource={task.stages ?? emptyStages} pagination={false} />
    <Typography.Title level={5}>详细编译日志</Typography.Title>
    <div className="quick-build-log-toolbar">
      <Segmented<QuickBuildLogChannel> aria-label="编译日志通道" options={logChannels} value={channel} onChange={setChannel} />
      <Space wrap>
        <Space size={6}><Switch size="small" checked={follow} onChange={setFollow} aria-label="跟随最新输出" /><span>跟随输出</span></Space>
        <Button size="small" disabled={!liveOutput} onClick={() => void copyOutput()}>复制日志</Button>
        <Button size="small" disabled={!liveOutput} onClick={exportOutput}>导出日志</Button>
      </Space>
    </div>
    <Typography.Paragraph type="secondary" className="quick-build-log-hint">显示当前任务保留的输出，不再仅截取最近一条；超出缓冲上限时仅保留末尾。关闭面板不会停止构建。</Typography.Paragraph>
    <pre ref={logRef} className="quick-build-log-output" tabIndex={0} aria-label="详细编译日志输出">{output || (channel === 'stderr' ? '暂无错误输出' : task.status === 'running' ? '等待编译输出…' : '暂无编译输出')}</pre>
  </Drawer>
})
