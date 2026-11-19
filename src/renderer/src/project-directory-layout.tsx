import { forwardRef, type ReactNode } from 'react'
import { Typography } from 'antd'

type Props = {
  title: string
  actions: ReactNode
  filters: ReactNode
  summary: ReactNode
  toolbar: ReactNode
  notice: ReactNode
  dialogs: ReactNode
  children: ReactNode
}

// The page frame and controls remain mounted when the result presentation changes.
export const ProjectDirectoryLayout = forwardRef<HTMLElement, Props>(function ProjectDirectoryLayout(props, ref) {
  return <section ref={ref} className="workspace-section project-workspace workspace-production-project project-directory-page" aria-label="项目列表页面">
    <div className="section-heading project-directory-heading">
      <div><Typography.Title level={2}>{props.title}</Typography.Title><Typography.Text type="secondary">集中跟进任务交付、开发动态与线上运行，先处理需要你关注的项目。</Typography.Text></div>
      {props.actions}
    </div>
    <div className="project-directory-controls" aria-label="项目公共筛选与摘要">
      {props.filters}
      {props.summary}
      {props.toolbar}
      {props.notice}
    </div>
    <div className="project-directory-results" aria-label="项目展示内容">{props.children}</div>
    {props.dialogs}
  </section>
})
