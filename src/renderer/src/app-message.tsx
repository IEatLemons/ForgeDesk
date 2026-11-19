import { Button, Space, message as antMessage } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { configurationTargets, getConfigurationTarget } from './configuration-guidance'
import { captureConfigurationContext, openConfiguration } from './configuration-navigation'

type Level = 'error' | 'warning' | 'info'
function actionable(level: Level): typeof antMessage.error {
  return (content, duration, onClose) => {
    const options = content && typeof content === 'object' && 'content' in content ? content : null
    const text = typeof content === 'string' ? content : typeof options?.content === 'string' ? options.content : ''
    const target = getConfigurationTarget(text)
    if (!target) return antMessage[level](content, duration, onClose)
    const context = captureConfigurationContext()
    const key = options?.key ?? `configuration:${target}:${context.projectId || 'global'}`
    return antMessage[level]({
      ...options, key, duration: 0, onClose: options?.onClose ?? onClose,
      content: <Space wrap className="configuration-message"><span>{text}</span><Button type="link" size="small" onClick={() => { antMessage.destroy(key); openConfiguration(target, context) }}>{configurationTargets[target].action}</Button><Button type="text" size="small" aria-label="关闭配置提示" icon={<CloseOutlined />} onClick={() => antMessage.destroy(key)} /></Space>
    })
  }
}

// Keep ordinary feedback and the Ant Design return handles intact. Only known
// configuration prerequisites get a persistent, actionable notice.
export const message: typeof antMessage = { ...antMessage, error: actionable('error'), warning: actionable('warning'), info: actionable('info') }
