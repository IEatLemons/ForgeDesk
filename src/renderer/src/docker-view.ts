import type { DockerContainerSummary, DockerImageSummary, DockerSnapshot } from './data'
import type { TerminalOpenRequest } from './terminal-panel-events'

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning'

export type DockerDashboardSummary = {
  imageCount: number
  containerCount: number
  runningContainerCount: number
  notedResourceCount: number
}

export type DockerStatusMeta = {
  label: string
  color: string
  badgeStatus: BadgeStatus
}

export type DockerWatchStatusMeta = {
  label: string
  color: string
}

export type DockerContainerFilterOptions = {
  onlyRunning?: boolean
}

export type DockerTableColumnLayout = {
  key: string
  width: number
}

export type DockerTableLayout = {
  minWidth: number
  columns: DockerTableColumnLayout[]
}

export type DockerImageNoteTargetOption = {
  label: string
  value: string
}

export type DockerImageRootTerminalRequest = Pick<TerminalOpenRequest, 'startupCommand' | 'title'>

function includesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase())
}

function matchesQuery(values: string[], query: string): boolean {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return true
  }

  return values.some((value) => includesText(value, normalizedQuery))
}

export function createDockerDashboardSummary(snapshot: DockerSnapshot): DockerDashboardSummary {
  return {
    imageCount: snapshot.images.length,
    containerCount: snapshot.containers.length,
    runningContainerCount: snapshot.containers.filter((container) => container.state.toLowerCase() === 'running').length,
    notedResourceCount: snapshot.notes.length
  }
}

export function filterDockerContainers(
  containers: DockerContainerSummary[],
  query: string,
  options: DockerContainerFilterOptions = {}
): DockerContainerSummary[] {
  return containers.filter((container) => {
    if (options.onlyRunning && container.state.trim().toLowerCase() !== 'running') {
      return false
    }

    return matchesQuery(
      [
        container.displayName,
        container.note?.notes ?? '',
        container.name,
        container.image,
        container.id,
        container.shortId,
        container.state,
        container.status,
        container.ports
      ],
      query
    )
  })
}

export function filterDockerImages(images: DockerImageSummary[], query: string): DockerImageSummary[] {
  return images.filter((image) =>
    matchesQuery(
      [
        image.displayName,
        image.note?.notes ?? '',
        image.reference,
        image.repository,
        image.tag,
        image.digest,
        image.id,
        image.shortId,
        image.size
      ],
      query
    )
  )
}

export function getDockerImageNoteTargetOptions(image: DockerImageSummary): DockerImageNoteTargetOption[] {
  const options: DockerImageNoteTargetOption[] = []

  if (image.tagResourceKey) {
    options.push({ label: `按仓库:标签 ${image.reference}`, value: image.tagResourceKey })
  }

  options.push({ label: `按 Image ID ${image.shortId}`, value: image.imageIdResourceKey })

  return options
}

export function getDockerImageDefaultNoteResourceKey(image: DockerImageSummary): string {
  return image.tagResourceKey || image.imageIdResourceKey
}

function shellQuoteArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./~-]+$/.test(value)) {
    return value
  }

  return `'${value.replace(/'/g, "'\\''")}'`
}

function getDockerImageRunTarget(image: DockerImageSummary): string {
  return image.tagResourceKey ? image.reference : image.id
}

export function createDockerImageRootTerminalRequest(image: DockerImageSummary): DockerImageRootTerminalRequest {
  const target = getDockerImageRunTarget(image)
  const titleTarget = image.tagResourceKey ? image.reference : image.shortId
  const args = ['docker', 'run', '--rm', '-it', '-u', 'root', '--entrypoint', '/bin/sh', target]

  return {
    title: `root · ${titleTarget}`,
    startupCommand: `${args.map(shellQuoteArg).join(' ')}\r`
  }
}

export function getDockerContainerStatusMeta(state: string, status: string): DockerStatusMeta {
  const normalizedState = state.trim().toLowerCase()
  const fallbackLabel = status.trim() || 'unknown'

  if (normalizedState === 'running') {
    return { label: 'running', color: 'green', badgeStatus: 'success' }
  }

  if (normalizedState === 'paused') {
    return { label: 'paused', color: 'gold', badgeStatus: 'warning' }
  }

  if (normalizedState === 'restarting') {
    return { label: 'restarting', color: 'blue', badgeStatus: 'processing' }
  }

  if (normalizedState === 'dead') {
    return { label: 'dead', color: 'red', badgeStatus: 'error' }
  }

  if (normalizedState === 'created' || (!normalizedState && fallbackLabel.toLowerCase().includes('created'))) {
    return { label: normalizedState || fallbackLabel, color: 'blue', badgeStatus: 'processing' }
  }

  if (normalizedState === 'exited') {
    return { label: 'exited', color: 'default', badgeStatus: 'default' }
  }

  return { label: normalizedState || fallbackLabel, color: 'default', badgeStatus: 'default' }
}

export function getDockerContainerTableLayout(): DockerTableLayout {
  const columns: DockerTableColumnLayout[] = [
    { key: 'container', width: 230 },
    { key: 'state', width: 150 },
    { key: 'image', width: 320 },
    { key: 'runtime', width: 170 },
    { key: 'noteActions', width: 250 }
  ]

  return {
    minWidth: columns.reduce((total, column) => total + column.width, 0),
    columns
  }
}

export function getDockerImageTableLayout(): DockerTableLayout {
  const columns: DockerTableColumnLayout[] = [
    { key: 'image', width: 280 },
    { key: 'repository', width: 200 },
    { key: 'tag', width: 140 },
    { key: 'id', width: 150 },
    { key: 'digest', width: 260 },
    { key: 'size', width: 110 },
    { key: 'created', width: 190 },
    { key: 'actions', width: 330 }
  ]

  return {
    minWidth: columns.reduce((total, column) => total + column.width, 0),
    columns
  }
}

export function getDockerWatchStatusMeta({
  watching,
  watchError,
  errorMessage
}: {
  watching: boolean
  watchError: string
  errorMessage: string
}): DockerWatchStatusMeta {
  if (errorMessage.trim()) {
    return { label: 'Docker 异常', color: 'red' }
  }

  if (watching) {
    return { label: '监听中', color: 'green' }
  }

  if (watchError.trim()) {
    return { label: '监听异常', color: 'red' }
  }

  return { label: '未监听', color: 'default' }
}
