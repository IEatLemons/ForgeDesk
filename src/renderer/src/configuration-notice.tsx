import { Alert, Button } from 'antd'
import { getErrorMessage } from './error-messages'
import { configurationTargets, getConfigurationTarget } from './configuration-guidance'
import { captureConfigurationContext, openConfiguration } from './configuration-navigation'

export function ConfigurationNotice({ error, projectId, repositoryId, title }: { error: unknown; projectId?: string; repositoryId?: string; title?: string }): JSX.Element {
  const target = getConfigurationTarget(error)
  const context = { ...captureConfigurationContext(), ...(projectId ? { projectId } : {}), ...(repositoryId ? { repositoryId } : {}) }
  return <Alert showIcon type={target ? 'warning' : 'error'} message={title || (target ? `${configurationTargets[target].title}尚未就绪` : '操作未完成')} description={getErrorMessage(error)} action={target ? <Button onClick={() => openConfiguration(target, context)}>{configurationTargets[target].action}</Button> : undefined} />
}
