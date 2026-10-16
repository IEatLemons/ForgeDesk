import type { ReactNode } from 'react'
import { Button, Popover, Select, Tabs, Tooltip } from 'antd'
import { ArrowLeftOutlined, FilterOutlined, FolderOutlined } from '@ant-design/icons'
import type { Repository } from './data'
import { sortRepositoriesHierarchically } from './repository-hierarchy'
import { REPOSITORY_VIEWS, type RepositoryView } from './repository-workspace-view'

type Props = {
  repository: Repository
  repositories: Repository[]
  view: RepositoryView
  branchControl: ReactNode
  actions: ReactNode
  onBack: () => void
  onSelect: (id: string) => void
  onViewChange: (view: RepositoryView) => void
}

export function RepositoryWorkspaceHeader({ repository, repositories, view, branchControl, actions, onBack, onSelect, onViewChange }: Props): JSX.Element {
  return <header className="repository-workspace-header">
    <div className="repository-workspace-heading">
      <div className="repository-workspace-identity">
        <Tooltip title="返回仓库列表"><Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回仓库列表" onClick={onBack} /></Tooltip>
        {repositories.length > 1 ? <Select
          aria-label="切换代码仓库"
          className="repository-workspace-picker"
          variant="borderless"
          value={repository.id}
          onChange={onSelect}
          options={sortRepositoriesHierarchically(repositories).map(({ repository: item, depth }) => ({
            value: item.id,
            label: `${depth ? '↳ ' : ''}${item.name}${!item.available ? '（不可用）' : ''}`
          }))}
        /> : <h1>{repository.name}</h1>}
        <span className="repository-workspace-branch">{branchControl}</span>
      </div>
      <div className="repository-workspace-actions">{actions}</div>
    </div>
    <div className="repository-workspace-location" title={repository.localPath}><FolderOutlined /><span>{repository.localPath}</span></div>
    <Tabs className="repository-workspace-tabs" activeKey={view} onChange={key => onViewChange(key as RepositoryView)} items={REPOSITORY_VIEWS.map(item => ({ ...item }))} />
  </header>
}

export function RepositoryHistoryFilters({ compact, count, children }: { compact: boolean; count: number; children: ReactNode }): JSX.Element {
  if (!compact) return <>{children}</>
  return <Popover trigger="click" placement="bottomRight" title="筛选提交" content={<div className="repository-history-filters">{children}</div>}>
    <Button icon={<FilterOutlined />} type={count ? 'primary' : 'default'} ghost={count > 0}>筛选{count ? ` · ${count}` : ''}</Button>
  </Popover>
}
